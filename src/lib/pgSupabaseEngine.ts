import { Pool } from 'pg';
import { createHmac, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

let _pool: Pool | null = null;

export function isPgConfigured(): boolean {
    return !!process.env.DATABASE_URL;
}

export function getPgPool(): Pool {
    if (!_pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not configured');
        }
        _pool = new Pool({
            connectionString,
            max: 15,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return _pool;
}

const JWT_SECRET = process.env.GFQ_JWT_SECRET || process.env.ORACLE_SIGNING_SECRET || 'gfq-self-hosted-pg16-jwt-secret-2026';

export interface JwtUserPayload {
    sub: string;
    email: string;
    role: string;
    user_metadata: Record<string, unknown>;
    exp: number;
}

export function signJwt(payload: Omit<JwtUserPayload, 'exp'>, expiresInSec = 86400 * 7): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expiresInSec,
    })).toString('base64url');
    const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): JwtUserPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, sig] = parts;
        const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (sig !== expected) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtUserPayload;
        if (!payload.sub || (payload.exp && payload.exp < Math.floor(Date.now() / 1000))) return null;
        return payload;
    } catch {
        return null;
    }
}

const ALLOWED_TABLES = new Set([
    'profiles',
    'jobs',
    'quotes',
    'messages',
    'agent_configs',
    'agent_actions',
    'agent_instructions',
    'notifications',
    'vendor_profiles',
    'estimating_templates',
    'team_members',
    'vendor_reviews',
    'verification_requests',
    'projects',
    'project_phases',
    'community_projects',
    'donations',
    'community_project_updates',
    'ledger_entries',
    'saved_searches',
    'api_keys',
    'poll_runs',
    'item_listings',
    'oracle_events',
    'job_briefs',
    'job_updates',
    'bid_threads',
    'bid_messages',
    'ranked_quotes',
    'escrow_accounts',
    'escrow_milestones',
    'verifiable_receipts',
    'disputes',
    'payment_records',
]);

const FK_RELATIONS: Record<string, Record<string, { table: string; localCol: string; foreignCol: string }>> = {
    team_members: {
        vendor_profiles: { table: 'vendor_profiles', localCol: 'vendor_profile_id', foreignCol: 'id' },
    },
    project_phases: {
        projects: { table: 'projects', localCol: 'project_id', foreignCol: 'id' },
    },
    ranked_quotes: {
        bid_threads: { table: 'bid_threads', localCol: 'thread_id', foreignCol: 'id' },
    },
};

function validIdent(name: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid SQL identifier: ${name}`);
    }
    return `"${name}"`;
}

function parseFilterValue(op: string, rawVal: string, params: unknown[]): string {
    switch (op) {
        case 'eq':
            params.push(rawVal);
            return `= $${params.length}`;
        case 'neq':
            params.push(rawVal);
            return `<> $${params.length}`;
        case 'gt':
            params.push(rawVal);
            return `> $${params.length}`;
        case 'gte':
            params.push(rawVal);
            return `>= $${params.length}`;
        case 'lt':
            params.push(rawVal);
            return `< $${params.length}`;
        case 'lte':
            params.push(rawVal);
            return `<= $${params.length}`;
        case 'ilike':
            params.push(rawVal.replace(/\*/g, '%'));
            return `ILIKE $${params.length}`;
        case 'like':
            params.push(rawVal.replace(/\*/g, '%'));
            return `LIKE $${params.length}`;
        case 'is': {
            const lower = rawVal.toLowerCase();
            if (lower === 'null') return 'IS NULL';
            if (lower === 'true') return 'IS TRUE';
            if (lower === 'false') return 'IS FALSE';
            if (lower === 'not.null') return 'IS NOT NULL';
            throw new Error(`Unsupported IS value: ${rawVal}`);
        }
        case 'in': {
            const inner = rawVal.replace(/^\(/, '').replace(/\)$/, '');
            if (!inner.trim()) {
                return '= ANY(ARRAY[]::text[])';
            }
            const items = inner.split(',').map(s => s.trim().replace(/^"(.*)"$/, '$1'));
            params.push(items);
            return `::text = ANY($${params.length}::text[])`;
        }
        default:
            throw new Error(`Unsupported filter operator: ${op}`);
    }
}

function splitTopLevelCommas(input: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of input) {
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            if (cur.trim()) out.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function parseOrClause(rawOr: string, tableAlias: string, params: unknown[]): string {
    const inner = rawOr.replace(/^\(/, '').replace(/\)$/, '');
    const parts = splitTopLevelCommas(inner);
    const sqlParts: string[] = [];
    for (const part of parts) {
        const firstDot = part.indexOf('.');
        const secondDot = part.indexOf('.', firstDot + 1);
        if (firstDot === -1 || secondDot === -1) continue;
        const col = part.slice(0, firstDot);
        const op = part.slice(firstDot + 1, secondDot);
        const val = part.slice(secondDot + 1);
        const cond = parseFilterValue(op, val, params);
        sqlParts.push(`${tableAlias}.${validIdent(col)}${cond.startsWith('::') ? cond : ' ' + cond}`);
    }
    return sqlParts.length > 0 ? `(${sqlParts.join(' OR ')})` : 'TRUE';
}

function buildAuthUserResponse(row: Record<string, unknown>) {
    const meta = (row.raw_user_meta_data || {}) as Record<string, unknown>;
    return {
        id: row.id as string,
        aud: 'authenticated',
        role: 'authenticated',
        email: row.email as string,
        email_confirmed_at: row.email_confirmed_at || row.created_at,
        user_metadata: meta,
        app_metadata: { provider: 'email', providers: ['email'] },
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
    };
}

export async function handleSupabaseRequest(
    urlStr: string,
    method: string,
    headers: Record<string, string>,
    bodyText?: string | null,
    bodyBuffer?: Buffer | null,
): Promise<{ status: number; headers: Record<string, string>; body: string | Buffer }> {
    const url = new URL(urlStr, 'http://localhost:5000');
    const pathname = url.pathname.replace(/^\/api\/supabase/, '');
    const pool = getPgPool();

    // -----------------------------------------------------------------------
    // 1. AUTH ENDPOINTS (/auth/v1/*)
    // -----------------------------------------------------------------------
    if (pathname.startsWith('/auth/v1/')) {
        const subPath = pathname.slice('/auth/v1'.length);

        if (subPath === '/signup' && method === 'POST') {
            const body = JSON.parse(bodyText || '{}');
            const email = String(body.email || '').trim().toLowerCase();
            const password = String(body.password || '');
            const meta = (body.data || body.options?.data || {}) as Record<string, unknown>;
            if (!email || !password) {
                return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Email and password are required' }) };
            }
            try {
                const existing = await pool.query('SELECT id FROM auth.users WHERE lower(email) = $1', [email]);
                if (existing.rows.length > 0) {
                    return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'User already registered' }) };
                }
                const ins = await pool.query(
                    `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
                     VALUES ($1, crypt($2, gen_salt('bf')), $3::jsonb)
                     RETURNING *`,
                    [email, password, JSON.stringify(meta)]
                );
                const userRow = ins.rows[0];
                const user = buildAuthUserResponse(userRow);
                const accessToken = signJwt({
                    sub: user.id,
                    email: user.email,
                    role: String(meta.role || 'USER'),
                    user_metadata: meta,
                });
                const session = {
                    access_token: accessToken,
                    token_type: 'bearer',
                    expires_in: 86400 * 7,
                    expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
                    refresh_token: accessToken,
                    user,
                };
                return {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ ...session, session }),
                };
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Signup failed';
                return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: msg }) };
            }
        }

        if (subPath === '/token' && method === 'POST') {
            const grantType = url.searchParams.get('grant_type') || 'password';
            const body = JSON.parse(bodyText || '{}');

            if (grantType === 'refresh_token' && body.refresh_token) {
                const payload = verifyJwt(String(body.refresh_token));
                if (!payload) {
                    return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid refresh token' }) };
                }
                const res = await pool.query('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
                if (res.rows.length === 0) {
                    return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'invalid_grant', error_description: 'User not found' }) };
                }
                const user = buildAuthUserResponse(res.rows[0]);
                const accessToken = signJwt({
                    sub: user.id,
                    email: user.email,
                    role: payload.role,
                    user_metadata: user.user_metadata,
                });
                return {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        access_token: accessToken,
                        token_type: 'bearer',
                        expires_in: 86400 * 7,
                        expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
                        refresh_token: accessToken,
                        user,
                    }),
                };
            }

            const email = String(body.email || '').trim().toLowerCase();
            const password = String(body.password || '');
            const res = await pool.query(
                `SELECT * FROM auth.users WHERE lower(email) = $1 AND encrypted_password = crypt($2, encrypted_password)`,
                [email, password]
            );
            if (res.rows.length === 0) {
                return {
                    status: 400,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials' }),
                };
            }
            const userRow = res.rows[0];
            const user = buildAuthUserResponse(userRow);
            const accessToken = signJwt({
                sub: user.id,
                email: user.email,
                role: String(user.user_metadata?.role || 'USER'),
                user_metadata: user.user_metadata,
            });
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    access_token: accessToken,
                    token_type: 'bearer',
                    expires_in: 86400 * 7,
                    expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
                    refresh_token: accessToken,
                    user,
                }),
            };
        }

        if (subPath === '/user' && method === 'GET') {
            const authHeader = headers['authorization'] || headers['Authorization'] || '';
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
            const payload = verifyJwt(token);
            if (!payload) {
                return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Invalid token' }) };
            }
            const res = await pool.query('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
            if (res.rows.length === 0) {
                return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'User not found' }) };
            }
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(buildAuthUserResponse(res.rows[0])),
            };
        }

        if (subPath === '/logout' || subPath === '/recover') {
            return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) };
        }

        return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) };
    }

    // -----------------------------------------------------------------------
    // 2. STORAGE ENDPOINTS (/storage/v1/*)
    // -----------------------------------------------------------------------
    if (pathname.startsWith('/storage/v1/')) {
        const subPath = pathname.slice('/storage/v1'.length);
        const uploadRoot = path.join(process.cwd(), 'public', 'uploads');

        if (subPath.startsWith('/object/public/') && method === 'GET') {
            const rel = subPath.slice('/object/public/'.length);
            const safeRel = rel.split('/').filter(p => p && p !== '..' && p !== '.').join('/');
            const filePath = path.join(uploadRoot, safeRel);
            if (!fs.existsSync(filePath)) {
                return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
            return { status: 200, headers: { 'content-type': mime }, body: fs.readFileSync(filePath) };
        }

        if (subPath.startsWith('/object/') && (method === 'POST' || method === 'PUT')) {
            const rel = subPath.slice('/object/'.length);
            const safeRel = rel.split('/').filter(p => p && p !== '..' && p !== '.').join('/');
            const filePath = path.join(uploadRoot, safeRel);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            const buf = bodyBuffer || Buffer.from(bodyText || '', 'binary');
            fs.writeFileSync(filePath, buf);
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ Key: safeRel, Id: randomUUID() }),
            };
        }

        if (subPath.startsWith('/object/') && method === 'DELETE') {
            return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Deleted' }) };
        }
    }

    // -----------------------------------------------------------------------
    // 3. RPC ENDPOINTS (/rest/v1/rpc/<fn>)
    // -----------------------------------------------------------------------
    if (pathname.startsWith('/rest/v1/rpc/')) {
        const fnName = pathname.slice('/rest/v1/rpc/'.length);
        const args = JSON.parse(bodyText || '{}');
        try {
            if (fnName === 'local_jobs_by_distance') {
                const res = await pool.query(
                    `SELECT * FROM public.local_jobs_by_distance($1,$2,$3,$4,$5,$6,$7)`,
                    [
                        args.viewer_lat,
                        args.viewer_lng,
                        args.radius_filter ?? 25,
                        args.industry_filter ?? null,
                        args.urgency_filter ?? null,
                        args.page_offset ?? 0,
                        args.page_limit ?? 12,
                    ]
                );
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows) };
            }
            if (fnName === 'process_donation') {
                const res = await pool.query(
                    `SELECT public.process_donation($1,$2,$3,$4,$5,$6,$7) AS id`,
                    [
                        args.p_project_id,
                        args.p_donor_id ?? null,
                        args.p_donor_name ?? 'Anonymous',
                        args.p_amount,
                        args.p_is_anonymous ?? false,
                        args.p_tx_hash ?? null,
                        args.p_message ?? null,
                    ]
                );
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows[0]?.id) };
            }
            if (fnName === 'record_community_expense') {
                const res = await pool.query(
                    `SELECT public.record_community_expense($1,$2,$3,$4) AS result`,
                    [args.p_project_id, args.p_creator_id, args.p_amount, args.p_description]
                );
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows[0]?.result) };
            }
            if (fnName === 'submit_vendor_review') {
                const res = await pool.query(
                    `SELECT * FROM public.submit_vendor_review($1,$2,$3,$4,$5,$6)`,
                    [
                        args.p_vendor_profile_id,
                        args.p_reviewer_id,
                        args.p_reviewer_name,
                        args.p_job_id ?? null,
                        args.p_rating,
                        args.p_comment ?? '',
                    ]
                );
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows[0] || null) };
            }
            return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `RPC ${fnName} not found` }) };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'RPC failed';
            return { status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: msg, code: 'P0001' }) };
        }
    }

    // -----------------------------------------------------------------------
    // 4. POSTGREST TABLE ENDPOINTS (/rest/v1/<table>)
    // -----------------------------------------------------------------------
    if (pathname.startsWith('/rest/v1/')) {
        const table = pathname.slice('/rest/v1/'.length).split('/')[0];
        if (!ALLOWED_TABLES.has(table)) {
            return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `Table ${table} not found`, code: '42P01' }) };
        }

        const prefer = (headers['prefer'] || headers['Prefer'] || '').toLowerCase();
        const accept = (headers['accept'] || headers['Accept'] || '').toLowerCase();
        const isSingleObject = accept.includes('application/vnd.pgrst.object+json');
        const wantCount = prefer.includes('count=exact');
        const returnRep = prefer.includes('return=representation') || isSingleObject;

        try {
            const params: unknown[] = [];
            const whereClauses: string[] = [];
            let joinSql = '';
            let joinSelectCols = '';

            const selectParam = url.searchParams.get('select') || '*';
            const joinMatch = selectParam.match(/([a-zA-Z0-9_]+)!inner\(([^)]+)\)/);
            if (joinMatch) {
                const relName = joinMatch[1];
                const relCols = joinMatch[2].split(',').map(c => c.trim()).filter(Boolean);
                const relMeta = FK_RELATIONS[table]?.[relName];
                if (relMeta) {
                    joinSql = `INNER JOIN public.${validIdent(relMeta.table)} AS jrel ON t.${validIdent(relMeta.localCol)} = jrel.${validIdent(relMeta.foreignCol)}`;
                    const jsonBuildPairs = relCols.map(c => `'${c}', jrel.${validIdent(c)}`).join(', ');
                    joinSelectCols = `, json_build_object(${jsonBuildPairs}) AS ${validIdent(relName)}`;
                }
            }

            for (const [key, val] of url.searchParams.entries()) {
                if (['select', 'order', 'limit', 'offset', 'on_conflict', ' columns'].includes(key)) continue;
                if (key === 'or') {
                    whereClauses.push(parseOrClause(val, 't', params));
                    continue;
                }
                const dotIdx = val.indexOf('.');
                if (dotIdx === -1) continue;
                const op = val.slice(0, dotIdx);
                const rawVal = val.slice(dotIdx + 1);

                if (key.includes('.')) {
                    const [, relCol] = key.split('.');
                    const cond = parseFilterValue(op, rawVal, params);
                    whereClauses.push(`jrel.${validIdent(relCol)}${cond.startsWith('::') ? cond : ' ' + cond}`);
                } else {
                    const cond = parseFilterValue(op, rawVal, params);
                    whereClauses.push(`t.${validIdent(key)}${cond.startsWith('::') ? cond : ' ' + cond}`);
                }
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // --- GET / HEAD ---
            if (method === 'GET' || method === 'HEAD') {
                let orderSql = '';
                const orderParam = url.searchParams.get('order');
                if (orderParam) {
                    const orderParts = orderParam.split(',').map(part => {
                        const [col, dir] = part.trim().split('.');
                        const d = dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
                        return `t.${validIdent(col)} ${d}`;
                    });
                    if (orderParts.length > 0) orderSql = `ORDER BY ${orderParts.join(', ')}`;
                }

                let limitNum: number | null = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null;
                let offsetNum: number | null = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : null;

                const rangeHeader = headers['range'] || headers['Range'];
                if (rangeHeader && /^\d+-\d+$/.test(rangeHeader.replace(/^items=/, ''))) {
                    const [startStr, endStr] = rangeHeader.replace(/^items=/, '').split('-');
                    const start = Number(startStr);
                    const end = Number(endStr);
                    offsetNum = start;
                    limitNum = end - start + 1;
                }

                let totalCount = 0;
                if (wantCount || method === 'HEAD') {
                    const countRes = await pool.query(
                        `SELECT count(*)::int AS cnt FROM public.${validIdent(table)} AS t ${joinSql} ${whereSql}`,
                        params
                    );
                    totalCount = countRes.rows[0]?.cnt ?? 0;
                }

                if (method === 'HEAD') {
                    return {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                            'content-range': `*/${totalCount}`,
                        },
                        body: '',
                    };
                }

                const limitSql = limitNum != null && Number.isFinite(limitNum) ? `LIMIT ${Math.max(0, Math.floor(limitNum))}` : '';
                const offsetSql = offsetNum != null && Number.isFinite(offsetNum) ? `OFFSET ${Math.max(0, Math.floor(offsetNum))}` : '';

                const querySql = `SELECT t.*${joinSelectCols} FROM public.${validIdent(table)} AS t ${joinSql} ${whereSql} ${orderSql} ${limitSql} ${offsetSql}`;
                const res = await pool.query(querySql, params);

                const resHeaders: Record<string, string> = { 'content-type': 'application/json' };
                if (wantCount) {
                    const rangeEnd = Math.max(0, res.rows.length - 1);
                    resHeaders['content-range'] = res.rows.length > 0 ? `0-${rangeEnd}/${totalCount}` : `*/${totalCount}`;
                }

                if (isSingleObject) {
                    if (res.rows.length !== 1) {
                        return {
                            status: 406,
                            headers: resHeaders,
                            body: JSON.stringify({
                                code: 'PGRST116',
                                details: `The result contains ${res.rows.length} rows`,
                                hint: null,
                                message: 'JSON object requested, multiple (or no) rows returned',
                            }),
                        };
                    }
                    return { status: 200, headers: resHeaders, body: JSON.stringify(res.rows[0]) };
                }

                return { status: 200, headers: resHeaders, body: JSON.stringify(res.rows) };
            }

            // --- POST (INSERT / UPSERT) ---
            if (method === 'POST') {
                const rawPayload = JSON.parse(bodyText || '{}');
                const rows = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
                if (rows.length === 0) {
                    return { status: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify([]) };
                }
                const cols = Object.keys(rows[0]).filter(k => rows[0][k] !== undefined);
                const colIdents = cols.map(validIdent).join(', ');
                const valueGroups: string[] = [];
                const insParams: unknown[] = [];

                for (const row of rows) {
                    const placeholders: string[] = [];
                    for (const col of cols) {
                        const v = row[col];
                        insParams.push(
                            v !== null && typeof v === 'object' && !Array.isArray(v)
                                ? JSON.stringify(v)
                                : v
                        );
                        placeholders.push(`$${insParams.length}`);
                    }
                    valueGroups.push(`(${placeholders.join(', ')})`);
                }

                let conflictSql = '';
                const onConflict = url.searchParams.get('on_conflict');
                if (prefer.includes('resolution=merge-duplicates') || onConflict) {
                    const conflictCol = onConflict || 'id';
                    const updateSet = cols
                        .filter(c => c !== conflictCol)
                        .map(c => `${validIdent(c)} = EXCLUDED.${validIdent(c)}`)
                        .join(', ');
                    conflictSql = updateSet
                        ? `ON CONFLICT (${validIdent(conflictCol)}) DO UPDATE SET ${updateSet}`
                        : `ON CONFLICT (${validIdent(conflictCol)}) DO NOTHING`;
                }

                const insSql = `INSERT INTO public.${validIdent(table)} (${colIdents}) VALUES ${valueGroups.join(', ')} ${conflictSql} RETURNING *`;
                const res = await pool.query(insSql, insParams);

                if (isSingleObject) {
                    return { status: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows[0] || null) };
                }
                return { status: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify(returnRep ? res.rows : res.rows) };
            }

            // --- PATCH (UPDATE) ---
            if (method === 'PATCH') {
                const updates = JSON.parse(bodyText || '{}') as Record<string, unknown>;
                const updateCols = Object.keys(updates).filter(k => updates[k] !== undefined);
                if (updateCols.length === 0) {
                    return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(isSingleObject ? null : []) };
                }

                const setClauses: string[] = [];
                for (const col of updateCols) {
                    const v = updates[col];
                    params.push(
                        v !== null && typeof v === 'object' && !Array.isArray(v)
                            ? JSON.stringify(v)
                            : v
                    );
                    setClauses.push(`${validIdent(col)} = $${params.length}`);
                }

                const updSql = `UPDATE public.${validIdent(table)} AS t SET ${setClauses.join(', ')} ${whereSql} RETURNING *`;
                const res = await pool.query(updSql, params);

                if (isSingleObject) {
                    if (res.rows.length === 0) {
                        return {
                            status: 406,
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ code: 'PGRST116', message: 'No rows updated' }),
                        };
                    }
                    return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows[0]) };
                }
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows) };
            }

            // --- DELETE ---
            if (method === 'DELETE') {
                const delSql = `DELETE FROM public.${validIdent(table)} AS t ${whereSql} RETURNING *`;
                const res = await pool.query(delSql, params);
                return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(res.rows) };
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Database query error';
            console.error(`[pgSupabaseEngine] ${method} ${pathname} error:`, msg);
            return {
                status: 400,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message: msg, code: '40000' }),
            };
        }
    }

    return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
}
