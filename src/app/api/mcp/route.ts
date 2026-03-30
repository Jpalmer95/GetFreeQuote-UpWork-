import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import {
    mapJobRow, mapAgentConfigRow,
    JobRow, AgentConfigRow,
} from '@/services/serverMappers';

const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'bidflow-mcp';
const SERVER_VERSION = '1.0.0';

function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

async function authenticateApiKey(request: NextRequest): Promise<{ userId: string; scopes: string[] } | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith('bfk_')) return null;

    const hash = hashKey(rawKey);

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, scopes, expires_at, is_active')
        .eq('key_hash', hash)
        .eq('is_active', true)
        .maybeSingle();

    if (error || !data) return null;

    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    supabaseAdmin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => {});

    return { userId: data.user_id, scopes: data.scopes || ['read'] };
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
        description: 'List jobs for the authenticated user. Returns open and active jobs.',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
                    description: 'Filter by job status. Omit to return all.',
                },
                limit: {
                    type: 'integer',
                    description: 'Max results to return (1-50, default 20).',
                    minimum: 1,
                    maximum: 50,
                },
            },
        },
    },
    {
        name: 'get_job',
        description: 'Get full details of a specific job by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'UUID of the job.' },
            },
            required: ['job_id'],
        },
    },
    {
        name: 'post_job',
        description: 'Create a new job posting on BidFlow.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Job title (max 200 chars).' },
                description: { type: 'string', description: 'Detailed job description.' },
                category: { type: 'string', description: 'Job category.' },
                location: { type: 'string', description: 'Job location.' },
                industry_vertical: {
                    type: 'string',
                    enum: ['Home Services', 'Commercial Construction', 'Gig Work', 'Events & Entertainment', 'Trade Labor', 'Day Labor', 'Professional Services', 'Technology', 'Other'],
                    description: 'Industry vertical.',
                },
                subcategory: { type: 'string', description: 'Subcategory within the industry.' },
                budget: { type: 'string', description: 'Budget amount or range (e.g. "$5000" or "$3000-$7000").' },
                urgency: {
                    type: 'string',
                    enum: ['flexible', 'within_month', 'within_week', 'urgent'],
                    description: 'Project urgency level.',
                },
                is_public: { type: 'boolean', description: 'Whether the job is publicly visible.' },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional tags for the job.',
                },
            },
            required: ['title', 'description', 'category', 'location', 'industry_vertical', 'subcategory'],
        },
    },
    {
        name: 'list_quotes',
        description: 'List all quotes submitted for a specific job.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'UUID of the job.' },
                status: {
                    type: 'string',
                    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
                    description: 'Filter by quote status. Omit for all.',
                },
            },
            required: ['job_id'],
        },
    },
    {
        name: 'submit_quote',
        description: 'Submit a vendor quote for a job. Requires write scope. The authenticated user must have a vendor profile.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'UUID of the job to quote on.' },
                amount: { type: 'number', description: 'Quote amount in USD.' },
                estimated_days: { type: 'integer', description: 'Estimated completion time in days.' },
                details: { type: 'string', description: 'Quote details, scope of work, and breakdown.' },
            },
            required: ['job_id', 'amount', 'estimated_days', 'details'],
        },
    },
    {
        name: 'get_agent_actions',
        description: 'Retrieve the agent activity feed for the authenticated user.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'Max results to return (1-100, default 50).',
                    minimum: 1,
                    maximum: 100,
                },
                offset: {
                    type: 'integer',
                    description: 'Pagination offset (default 0).',
                    minimum: 0,
                },
                job_id: {
                    type: 'string',
                    description: 'Optional: filter actions by job ID.',
                },
            },
        },
    },
    {
        name: 'send_agent_instruction',
        description: 'Send a natural language instruction to the AI agent. Requires write scope.',
        inputSchema: {
            type: 'object',
            properties: {
                instruction: {
                    type: 'string',
                    description: 'Instruction text for the agent (max 1000 chars).',
                    maxLength: 1000,
                },
            },
            required: ['instruction'],
        },
    },
    {
        name: 'get_notifications',
        description: 'Get notification history for the authenticated user.',
        inputSchema: {
            type: 'object',
            properties: {
                unread_only: {
                    type: 'boolean',
                    description: 'If true, only return unread notifications.',
                },
                limit: {
                    type: 'integer',
                    description: 'Max results (1-50, default 20).',
                    minimum: 1,
                    maximum: 50,
                },
            },
        },
    },
    {
        name: 'get_agent_config',
        description: 'Retrieve the AI agent configuration for the authenticated user.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];

async function handleTool(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
    scopes: string[],
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const hasWrite = scopes.includes('write');

    function ok(data: unknown) {
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    function err(message: string, status = 'error') {
        return {
            content: [{ type: 'text', text: JSON.stringify({ status, error: message }) }],
            isError: true,
        };
    }

    switch (toolName) {
        case 'list_jobs': {
            const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
            let query = supabaseAdmin
                .from('jobs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (args.status) query = query.eq('status', args.status as string);

            const { data, error } = await query;
            if (error) return err(error.message);

            const jobs = (data || []).map((r) => mapJobRow(r as JobRow));
            return ok({ jobs, count: jobs.length });
        }

        case 'get_job': {
            const jobId = args.job_id as string;
            const { data, error } = await supabaseAdmin
                .from('jobs')
                .select('*')
                .eq('id', jobId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) return err(error.message);
            if (!data) return err('Job not found or access denied', 'not_found');

            const job = mapJobRow(data as JobRow);
            const { data: quotes } = await supabaseAdmin
                .from('quotes')
                .select('id, vendor_name, amount, estimated_days, status, created_at')
                .eq('job_id', jobId);

            return ok({ job, quotes: quotes || [] });
        }

        case 'post_job': {
            if (!hasWrite) return err('Write scope required to post jobs', 'forbidden');

            const title = ((args.title as string) || '').trim().substring(0, 200);
            const description = ((args.description as string) || '').trim();
            const category = ((args.category as string) || '').trim();
            const location = ((args.location as string) || '').trim();
            const industryVertical = ((args.industry_vertical as string) || 'Other').trim();
            const subcategory = ((args.subcategory as string) || 'Other').trim();

            if (!title || !description || !category || !location) {
                return err('title, description, category, and location are required');
            }

            const { data, error } = await supabaseAdmin
                .from('jobs')
                .insert({
                    user_id: userId,
                    title,
                    description,
                    category,
                    location,
                    industry_vertical: industryVertical,
                    subcategory,
                    budget: args.budget as string || null,
                    urgency: args.urgency as string || 'flexible',
                    is_public: args.is_public !== false,
                    tags: Array.isArray(args.tags) ? args.tags : [],
                    status: 'OPEN',
                })
                .select()
                .single();

            if (error) return err(error.message);
            return ok({ job: mapJobRow(data as JobRow), message: 'Job posted successfully.' });
        }

        case 'list_quotes': {
            const jobId = args.job_id as string;

            const { data: jobRow } = await supabaseAdmin
                .from('jobs')
                .select('id, user_id')
                .eq('id', jobId)
                .maybeSingle();

            const isOwner = jobRow?.user_id === userId;

            let query = supabaseAdmin
                .from('quotes')
                .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at')
                .eq('job_id', jobId);

            if (!isOwner) {
                query = query.eq('vendor_id', userId);
            }

            if (args.status) query = query.eq('status', args.status as string);

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) return err(error.message);

            return ok({ quotes: data || [], count: (data || []).length });
        }

        case 'submit_quote': {
            if (!hasWrite) return err('Write scope required to submit quotes', 'forbidden');

            const jobId = args.job_id as string;
            const amount = Number(args.amount);
            const estimatedDays = Number(args.estimated_days);
            const details = ((args.details as string) || '').trim();

            if (!jobId || isNaN(amount) || amount <= 0) return err('Valid job_id and amount are required');
            if (!details) return err('details is required');

            const { data: profileRow } = await supabaseAdmin
                .from('vendor_profiles')
                .select('company_name')
                .eq('user_id', userId)
                .maybeSingle();

            const vendorName = profileRow?.company_name || 'Vendor';

            const { data, error } = await supabaseAdmin
                .from('quotes')
                .insert({
                    job_id: jobId,
                    vendor_id: userId,
                    vendor_name: vendorName,
                    amount,
                    estimated_days: Math.max(1, estimatedDays || 1),
                    details,
                    status: 'PENDING',
                })
                .select()
                .single();

            if (error) return err(error.message);

            return ok({ quote: data, message: 'Quote submitted successfully.' });
        }

        case 'get_agent_actions': {
            const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
            const offset = Math.max(0, Number(args.offset) || 0);

            let query = supabaseAdmin
                .from('agent_actions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (args.job_id) query = query.eq('job_id', args.job_id as string);

            const { data, error } = await query;
            if (error) return err(error.message);

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

        case 'send_agent_instruction': {
            if (!hasWrite) return err('Write scope required to send agent instructions', 'forbidden');

            const instruction = ((args.instruction as string) || '').trim().substring(0, 1000);
            if (!instruction) return err('instruction is required');

            const { data, error } = await supabaseAdmin
                .from('agent_instructions')
                .insert({ user_id: userId, instruction, acknowledged: false })
                .select()
                .single();

            if (error) return err(error.message);

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

        case 'get_notifications': {
            const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));

            let query = supabaseAdmin
                .from('notifications')
                .select('id, type, priority, title, message, read, action_required, action_url, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (args.unread_only) query = query.eq('read', false);

            const { data, error } = await query;
            if (error) return err(error.message);

            return ok({ notifications: data || [], count: (data || []).length });
        }

        case 'get_agent_config': {
            const { data, error } = await supabaseAdmin
                .from('agent_configs')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) return err(error.message);
            if (!data) return ok({ config: null, message: 'No agent configuration found.' });

            const config = mapAgentConfigRow(data as AgentConfigRow);
            return ok({ config });
        }

        default:
            return err(`Unknown tool: ${toolName}`, 'unknown_tool');
    }
}

export async function POST(request: NextRequest) {
    const auth = await authenticateApiKey(request);
    if (!auth) {
        return NextResponse.json(
            {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32001, message: 'Unauthorized: valid API key required (Bearer bfk_...)' },
            },
            { status: 401 }
        );
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } },
            { status: 400 }
        );
    }

    const id = body.id ?? null;
    const method = body.method as string | undefined;
    const params = (body.params || {}) as Record<string, unknown>;

    if (body.jsonrpc !== '2.0' || !method) {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0" and method is required' },
        });
    }

    try {
        if (method === 'initialize') {
            return NextResponse.json({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: MCP_VERSION,
                    capabilities: { tools: {} },
                    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
                },
            });
        }

        if (method === 'tools/list') {
            return NextResponse.json({
                jsonrpc: '2.0',
                id,
                result: { tools: TOOLS },
            });
        }

        if (method === 'tools/call') {
            const toolName = params.name as string;
            const toolArgs = (params.arguments || {}) as Record<string, unknown>;

            if (!toolName) {
                return NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32602, message: 'Invalid params: name is required for tools/call' },
                });
            }

            const knownTool = TOOLS.find(t => t.name === toolName);
            if (!knownTool) {
                return NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32601, message: `Method not found: tool "${toolName}" does not exist` },
                });
            }

            const result = await handleTool(toolName, toolArgs, auth.userId, auth.scopes);

            return NextResponse.json({
                jsonrpc: '2.0',
                id,
                result,
            });
        }

        if (method === 'ping') {
            return NextResponse.json({ jsonrpc: '2.0', id, result: {} });
        }

        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[mcp] Handler error:', message);
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: `Internal error: ${message}` },
        });
    }
}

export async function GET(request: NextRequest) {
    const auth = await authenticateApiKey(request);

    return NextResponse.json({
        server: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: MCP_VERSION,
        authenticated: !!auth,
        tools: auth ? TOOLS.map(t => ({ name: t.name, description: t.description })) : [],
        docs: 'Use POST with JSON-RPC 2.0. See /docs/mcp for integration guide.',
    });
}
