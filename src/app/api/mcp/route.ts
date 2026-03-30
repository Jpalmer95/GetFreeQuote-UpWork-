import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { mapJobRow, mapAgentConfigRow, JobRow, AgentConfigRow } from '@/services/serverMappers';

const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'bidflow-mcp';
const SERVER_VERSION = '1.0.0';

function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

const RATE_LIMIT_PER_MINUTE = 60;

async function authenticateApiKey(request: NextRequest): Promise<
    { userId: string; scopes: string[]; keyId: string } | { rateLimited: true } | null
> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith('bfk_')) return null;

    const hash = hashKey(rawKey);

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, scopes, revoked_at, request_count, last_used_at')
        .eq('key_hash', hash)
        .is('revoked_at', null)
        .maybeSingle();

    if (error || !data) return null;

    const now = new Date();
    const lastUsed = data.last_used_at ? new Date(data.last_used_at) : null;
    const isNewMinute = !lastUsed || now.getTime() - lastUsed.getTime() > 60_000;
    const newCount = isNewMinute ? 1 : (data.request_count ?? 0) + 1;

    if (!isNewMinute && (data.request_count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
        return { rateLimited: true };
    }

    supabaseAdmin
        .from('api_keys')
        .update({
            last_used_at: now.toISOString(),
            request_count: newCount,
        })
        .eq('id', data.id)
        .then(() => {});

    return { userId: data.user_id, scopes: data.scopes || ['read'], keyId: data.id };
}

interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

const TOOLS: McpTool[] = [
    {
        name: 'list_jobs',
        description: 'Returns open marketplace jobs available for bidding. Supports filters for industry, location, budget range, and posted date. Use mine=true to see only your own jobs.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], description: 'Filter by job status. Default: OPEN.' },
                mine: { type: 'boolean', description: 'If true, return only your own jobs. Default: false (all open jobs).' },
                industry: { type: 'string', description: 'Filter by industry vertical (e.g. "Home Services").' },
                location: { type: 'string', description: 'Filter by location (partial match).' },
                posted_after: { type: 'string', description: 'ISO 8601 date — only return jobs posted after this date.' },
                budget_min: { type: 'number', description: 'Minimum budget in USD (inclusive).' },
                budget_max: { type: 'number', description: 'Maximum budget in USD (inclusive).' },
                limit: { type: 'integer', description: 'Max results (1–50, default 20).', minimum: 1, maximum: 50 },
            },
        },
    },
    {
        name: 'get_job',
        description: 'Returns full detail for a single job including scope, attachments summary, and quote count.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'UUID of the job.' },
            },
            required: ['job_id'],
        },
    },
    {
        name: 'list_quotes',
        description: 'Returns quotes submitted by (vendor) or received by (client) the authenticated user, optionally filtered by job.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'Optional: filter quotes by job ID.' },
                status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED'], description: 'Filter by quote status.' },
            },
        },
    },
    {
        name: 'submit_quote',
        description: 'Creates a new quote on a job. The authenticated user must have a vendor profile.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'UUID of the job to quote on.' },
                amount: { type: 'number', description: 'Quote amount in USD.' },
                estimated_days: { type: 'integer', description: 'Estimated completion in days.' },
                details: { type: 'string', description: 'Scope of work and cost breakdown.' },
            },
            required: ['job_id', 'amount', 'estimated_days', 'details'],
        },
    },
    {
        name: 'update_quote',
        description: 'Revises a pending quote. Only the quote submitter (vendor) may update their own quote.',
        inputSchema: {
            type: 'object',
            properties: {
                quote_id: { type: 'string', description: 'UUID of the quote to update.' },
                amount: { type: 'number', description: 'New quote amount in USD.' },
                estimated_days: { type: 'integer', description: 'New estimated completion in days.' },
                details: { type: 'string', description: 'Updated scope of work and breakdown.' },
            },
            required: ['quote_id'],
        },
    },
    {
        name: 'get_notifications',
        description: 'Returns notifications for the authenticated user (unread only by default).',
        inputSchema: {
            type: 'object',
            properties: {
                unread_only: { type: 'boolean', description: 'If true (default), only return unread notifications.' },
                limit: { type: 'integer', description: 'Max results (1–50, default 20).', minimum: 1, maximum: 50 },
            },
        },
    },
    {
        name: 'mark_notifications_read',
        description: 'Marks one specific notification (by id) or all notifications as read.',
        inputSchema: {
            type: 'object',
            properties: {
                notification_id: { type: 'string', description: 'UUID of a specific notification to mark read. Omit to mark all as read.' },
            },
        },
    },
    {
        name: 'get_agent_actions',
        description: 'Returns the agent action log (activity feed) for the authenticated account.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'integer', description: 'Max results (1–100, default 50).', minimum: 1, maximum: 100 },
                offset: { type: 'integer', description: 'Pagination offset (default 0).', minimum: 0 },
                job_id: { type: 'string', description: 'Optional: filter by job ID.' },
            },
        },
    },
    {
        name: 'post_agent_instruction',
        description: 'Records a plain-language instruction for the AI agent. Same as the in-app "Instruct My Agent" input.',
        inputSchema: {
            type: 'object',
            properties: {
                instruction: { type: 'string', description: 'Instruction text for the agent (max 1000 chars).', maxLength: 1000 },
            },
            required: ['instruction'],
        },
    },
];

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolErr(message: string, code = 'error'): ToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify({ error: message, code }) }],
        isError: true,
    };
}

async function handleTool(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
    scopes: string[],
): Promise<ToolResult> {
    const hasWrite = scopes.includes('write');

    switch (toolName) {
        case 'list_jobs': {
            const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
            const status = (args.status as string) || 'OPEN';
            const mineOnly = args.mine === true;

            let query = supabaseAdmin
                .from('jobs')
                .select('*')
                .eq('status', status)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (mineOnly) {
                query = query.eq('user_id', userId);
            } else {
                query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
            }

            if (args.industry) query = query.eq('industry_vertical', args.industry as string);
            if (args.location) query = query.ilike('location', `%${args.location as string}%`);
            if (args.posted_after) query = query.gte('created_at', args.posted_after as string);
            if (args.budget_min !== undefined) query = query.gte('budget_min', Number(args.budget_min));
            if (args.budget_max !== undefined) query = query.lte('budget_max', Number(args.budget_max));

            const { data, error } = await query;
            if (error) return toolErr(error.message);

            const jobs = (data || []).map((r) => ({
                ...mapJobRow(r as JobRow),
                isOwner: r.user_id === userId,
            }));
            return ok({ jobs, count: jobs.length, status_filter: status, mine: mineOnly });
        }

        case 'get_job': {
            const jobId = args.job_id as string;
            const { data: jobRow, error } = await supabaseAdmin
                .from('jobs')
                .select('*')
                .eq('id', jobId)
                .maybeSingle();

            if (error) return toolErr(error.message);
            if (!jobRow) return toolErr('Job not found', 'not_found');

            const isOwner = jobRow.user_id === userId;
            const isVisible = isOwner || jobRow.is_public === true;

            if (!isVisible) return toolErr('Job not found or access denied', 'not_found');

            const job = mapJobRow(jobRow as JobRow);

            const quotesQuery = supabaseAdmin
                .from('quotes')
                .select('id, vendor_name, amount, estimated_days, status, created_at', { count: 'exact' })
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });

            const { data: quotes, count } = isOwner
                ? await quotesQuery
                : await quotesQuery.eq('vendor_id', userId);

            return ok({
                job,
                isOwner,
                quote_count: count || 0,
                quotes: quotes || [],
                attachments_count: (job.attachments || []).length,
            });
        }

        case 'list_quotes': {
            const jobId = args.job_id as string | undefined;

            if (jobId) {
                const { data: jobRow } = await supabaseAdmin
                    .from('jobs')
                    .select('id, user_id')
                    .eq('id', jobId)
                    .maybeSingle();

                let query = supabaseAdmin
                    .from('quotes')
                    .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at')
                    .eq('job_id', jobId);

                if (jobRow?.user_id !== userId) {
                    query = query.eq('vendor_id', userId);
                }

                if (args.status) query = query.eq('status', args.status as string);

                const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
                if (error) return toolErr(error.message);
                return ok({ quotes: data || [], count: (data || []).length });
            } else {
                const { data: clientJobIds } = await supabaseAdmin
                    .from('jobs')
                    .select('id')
                    .eq('user_id', userId);

                const ownedJobIds = (clientJobIds || []).map((j) => j.id);

                let query = supabaseAdmin
                    .from('quotes')
                    .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at');

                if (ownedJobIds.length > 0) {
                    query = query.or(`vendor_id.eq.${userId},job_id.in.(${ownedJobIds.join(',')})`);
                } else {
                    query = query.eq('vendor_id', userId);
                }

                if (args.status) query = query.eq('status', args.status as string);

                const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
                if (error) return toolErr(error.message);
                return ok({ quotes: data || [], count: (data || []).length });
            }
        }

        case 'submit_quote': {
            if (!hasWrite) return toolErr('Write scope required to submit quotes', 'forbidden');

            const jobId = args.job_id as string;
            const amount = Number(args.amount);
            const estimatedDays = Math.max(1, Number(args.estimated_days) || 1);
            const details = ((args.details as string) || '').trim();

            if (!jobId || isNaN(amount) || amount <= 0) return toolErr('Valid job_id and positive amount are required');
            if (!details) return toolErr('details is required');

            const { data: jobRow, error: jobErr } = await supabaseAdmin
                .from('jobs')
                .select('id, user_id, status, is_public')
                .eq('id', jobId)
                .maybeSingle();

            if (jobErr) return toolErr(jobErr.message);
            if (!jobRow) return toolErr('Job not found', 'not_found');
            if (!jobRow.is_public && jobRow.user_id !== userId) return toolErr('Job not found or access denied', 'not_found');
            if (jobRow.user_id === userId) return toolErr('You cannot quote on your own job', 'forbidden');
            if (jobRow.status !== 'OPEN') return toolErr(`Job is ${jobRow.status} and not accepting quotes`, 'invalid_state');

            const { data: existingQuote } = await supabaseAdmin
                .from('quotes')
                .select('id')
                .eq('job_id', jobId)
                .eq('vendor_id', userId)
                .maybeSingle();

            if (existingQuote) return toolErr('You have already submitted a quote on this job. Use update_quote to revise it.', 'conflict');

            const { data: profileRow } = await supabaseAdmin
                .from('vendor_profiles')
                .select('company_name')
                .eq('user_id', userId)
                .maybeSingle();

            if (!profileRow) return toolErr('A vendor profile is required to submit quotes. Please create one in Settings.', 'forbidden');

            const vendorName = profileRow.company_name || 'Vendor';

            const { data, error } = await supabaseAdmin
                .from('quotes')
                .insert({
                    job_id: jobId,
                    vendor_id: userId,
                    vendor_name: vendorName,
                    amount,
                    estimated_days: estimatedDays,
                    details,
                    status: 'PENDING',
                })
                .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at')
                .single();

            if (error) return toolErr(error.message);
            return ok({ quote: data, message: 'Quote submitted successfully.' });
        }

        case 'update_quote': {
            if (!hasWrite) return toolErr('Write scope required to update quotes', 'forbidden');

            const quoteId = args.quote_id as string;
            if (!quoteId) return toolErr('quote_id is required');

            const { data: existing, error: fetchErr } = await supabaseAdmin
                .from('quotes')
                .select('id, vendor_id, status')
                .eq('id', quoteId)
                .maybeSingle();

            if (fetchErr) return toolErr(fetchErr.message);
            if (!existing) return toolErr('Quote not found', 'not_found');
            if (existing.vendor_id !== userId) return toolErr('You can only update your own quotes', 'forbidden');
            if (existing.status !== 'PENDING') return toolErr(`Cannot update a quote with status ${existing.status}`, 'invalid_state');

            const update: Record<string, unknown> = {};

            if (args.amount !== undefined) {
                const amt = Number(args.amount);
                if (isNaN(amt) || amt <= 0) return toolErr('amount must be a positive number');
                update.amount = amt;
            }
            if (args.estimated_days !== undefined) {
                const days = Number(args.estimated_days);
                if (isNaN(days) || days < 1) return toolErr('estimated_days must be a positive integer');
                update.estimated_days = Math.round(days);
            }
            if (args.details !== undefined) {
                const det = ((args.details as string) || '').trim();
                if (!det) return toolErr('details cannot be empty when provided');
                update.details = det;
            }

            if (Object.keys(update).length === 0) return toolErr('At least one field (amount, estimated_days, details) must be provided');

            const { data, error } = await supabaseAdmin
                .from('quotes')
                .update(update)
                .eq('id', quoteId)
                .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at')
                .single();

            if (error) return toolErr(error.message);
            return ok({ quote: data, message: 'Quote updated successfully.' });
        }

        case 'get_notifications': {
            const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
            const unreadOnly = args.unread_only !== false;

            let query = supabaseAdmin
                .from('notifications')
                .select('id, type, priority, title, message, read, action_required, action_url, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (unreadOnly) query = query.eq('read', false);

            const { data, error } = await query;
            if (error) return toolErr(error.message);

            return ok({ notifications: data || [], count: (data || []).length, unread_only: unreadOnly });
        }

        case 'mark_notifications_read': {
            if (!hasWrite) return toolErr('Write scope required to mark notifications read', 'forbidden');

            const notifId = args.notification_id as string | undefined;

            if (notifId) {
                const { error } = await supabaseAdmin
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', notifId)
                    .eq('user_id', userId);
                if (error) return toolErr(error.message);
                return ok({ success: true, message: 'Notification marked as read.' });
            } else {
                const { error } = await supabaseAdmin
                    .from('notifications')
                    .update({ read: true })
                    .eq('user_id', userId)
                    .eq('read', false);
                if (error) return toolErr(error.message);
                return ok({ success: true, message: 'All notifications marked as read.' });
            }
        }

        case 'get_agent_actions': {
            const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
            const offset = Math.max(0, Number(args.offset) || 0);

            let query = supabaseAdmin
                .from('agent_actions')
                .select('id, job_id, action_type, summary, details, automated, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (args.job_id) query = query.eq('job_id', args.job_id as string);

            const { data, error } = await query;
            if (error) return toolErr(error.message);

            const actions = (data || []).map((r) => ({
                id: r.id,
                jobId: r.job_id,
                actionType: r.action_type,
                summary: r.summary,
                details: r.details,
                automated: r.automated,
                createdAt: r.created_at,
            }));

            return ok({ actions, count: actions.length, offset });
        }

        case 'post_agent_instruction': {
            if (!hasWrite) return toolErr('Write scope required to post agent instructions', 'forbidden');

            const instruction = ((args.instruction as string) || '').trim().substring(0, 1000);
            if (!instruction) return toolErr('instruction is required');

            const { data, error } = await supabaseAdmin
                .from('agent_instructions')
                .insert({ user_id: userId, instruction, acknowledged: false })
                .select('id, instruction, acknowledged, created_at')
                .single();

            if (error) return toolErr(error.message);

            await supabaseAdmin.from('agent_actions').insert({
                job_id: null,
                user_id: userId,
                action_type: 'owner_instruction',
                summary: instruction.length > 120 ? instruction.substring(0, 117) + '...' : instruction,
                details: { instruction_id: data.id, source: 'mcp', full_instruction: instruction },
                automated: false,
            });

            return ok({ instruction: data, message: 'Instruction sent to agent.' });
        }

        default:
            return toolErr(`Unknown tool: ${toolName}`, 'unknown_tool');
    }
}

function makeJsonRpcError(id: unknown, code: number, message: string) {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

type AuthResult = { userId: string; scopes: string[]; keyId: string } | { rateLimited: true } | null;

async function handleJsonRpc(body: Record<string, unknown>, auth: AuthResult) {
    const id = body.id ?? null;
    const method = body.method as string | undefined;
    const params = (body.params || {}) as Record<string, unknown>;

    if (body.jsonrpc !== '2.0' || !method) {
        return makeJsonRpcError(id, -32600, 'Invalid Request: jsonrpc must be "2.0" and method is required');
    }

    if (!auth) {
        return makeJsonRpcError(id, -32001, 'Unauthorized: valid API key required (Authorization: Bearer bfk_...)');
    }

    if ('rateLimited' in auth) {
        return makeJsonRpcError(id, -32029, `Rate limit exceeded: maximum ${RATE_LIMIT_PER_MINUTE} requests per minute per API key`);
    }

    if (method === 'initialize') {
        return {
            jsonrpc: '2.0', id,
            result: {
                protocolVersion: MCP_VERSION,
                capabilities: { tools: {} },
                serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            },
        };
    }

    if (method === 'tools/list') {
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    }

    if (method === 'tools/call') {
        const toolName = params.name as string;
        const toolArgs = (params.arguments || {}) as Record<string, unknown>;

        if (!toolName) {
            return makeJsonRpcError(id, -32602, 'Invalid params: name is required for tools/call');
        }

        const knownTool = TOOLS.find(t => t.name === toolName);
        if (!knownTool) {
            return makeJsonRpcError(id, -32601, `Method not found: tool "${toolName}" does not exist. Call tools/list to see available tools.`);
        }

        try {
            const result = await handleTool(toolName, toolArgs, auth.userId, auth.scopes);
            return { jsonrpc: '2.0', id, result };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Internal error';
            console.error(`[mcp] Tool "${toolName}" error:`, msg);
            return makeJsonRpcError(id, -32603, `Internal error in tool "${toolName}": ${msg}`);
        }
    }

    if (method === 'ping') {
        return { jsonrpc: '2.0', id, result: {} };
    }

    return makeJsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function POST(request: NextRequest) {
    const acceptHeader = request.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    const auth = await authenticateApiKey(request);

    if (wantsSSE) {
        const encoder = new TextEncoder();

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            const stream = new ReadableStream({
                start(controller) {
                    const errPayload = JSON.stringify(makeJsonRpcError(null, -32700, 'Parse error: invalid JSON'));
                    controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
                    controller.close();
                },
            });
            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
            });
        }

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const result = await handleJsonRpc(body, auth);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Internal error';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(makeJsonRpcError(body.id ?? null, -32603, msg))}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(makeJsonRpcError(null, -32700, 'Parse error: invalid JSON'), { status: 400 });
    }

    const result = await handleJsonRpc(body, auth);
    const errorCode = 'error' in result && result.error ? (result.error as { code: number }).code : 0;
    const status = errorCode === -32001 ? 401 : errorCode === -32029 ? 429 : errorCode !== 0 ? 400 : 200;

    return NextResponse.json(result, { status });
}

export async function GET(request: NextRequest) {
    const auth = await authenticateApiKey(request);
    const isAuthenticated = !!auth && !('rateLimited' in auth);

    return NextResponse.json({
        server: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: MCP_VERSION,
        transport: 'http+sse',
        authenticated: isAuthenticated,
        tools: isAuthenticated ? TOOLS.map(t => ({ name: t.name, description: t.description })) : [],
        docs: '/docs/mcp',
        usage: {
            endpoint: 'POST /api/mcp',
            auth: 'Authorization: Bearer bfk_...',
            protocol: 'JSON-RPC 2.0',
            streaming: 'Set Accept: text/event-stream for SSE responses',
        },
    });
}
