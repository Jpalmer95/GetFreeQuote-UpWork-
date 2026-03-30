'use client';
import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const TOOLS = [
    {
        name: 'list_jobs',
        scope: 'read',
        description: "Returns the authenticated user's jobs. Defaults to OPEN status. Supports budget range, industry, location, and date filters.",
        params: [
            { name: 'status', type: 'string', optional: true, desc: 'Filter: OPEN (default) | IN_PROGRESS | COMPLETED | CANCELLED' },
            { name: 'industry', type: 'string', optional: true, desc: 'Filter by industry vertical' },
            { name: 'location', type: 'string', optional: true, desc: 'Partial location match' },
            { name: 'posted_after', type: 'string', optional: true, desc: 'ISO 8601 date' },
            { name: 'budget_min', type: 'number', optional: true, desc: 'Minimum budget in USD (inclusive)' },
            { name: 'budget_max', type: 'number', optional: true, desc: 'Maximum budget in USD (inclusive)' },
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–50, default 20)' },
        ],
    },
    {
        name: 'get_job',
        scope: 'read',
        description: 'Returns full detail for a single job including scope, attachments count, and quotes.',
        params: [
            { name: 'job_id', type: 'string', optional: false, desc: 'UUID of the job' },
        ],
    },
    {
        name: 'list_quotes',
        scope: 'read',
        description: 'Returns quotes submitted by (vendor) or received by (client) the authenticated user.',
        params: [
            { name: 'job_id', type: 'string', optional: true, desc: 'Filter by job ID' },
            { name: 'status', type: 'string', optional: true, desc: 'Filter: PENDING | ACCEPTED | REJECTED' },
        ],
    },
    {
        name: 'submit_quote',
        scope: 'write',
        description: 'Creates a new quote on a job. User must have a vendor profile.',
        params: [
            { name: 'job_id', type: 'string', optional: false, desc: 'UUID of the job' },
            { name: 'amount', type: 'number', optional: false, desc: 'Quote amount in USD' },
            { name: 'estimated_days', type: 'integer', optional: false, desc: 'Estimated completion in days' },
            { name: 'details', type: 'string', optional: false, desc: 'Scope of work and cost breakdown' },
        ],
    },
    {
        name: 'update_quote',
        scope: 'write',
        description: 'Revises a pending quote. Only the submitting vendor may update their own quote.',
        params: [
            { name: 'quote_id', type: 'string', optional: false, desc: 'UUID of the quote to update' },
            { name: 'amount', type: 'number', optional: true, desc: 'New amount in USD' },
            { name: 'estimated_days', type: 'integer', optional: true, desc: 'New estimated days' },
            { name: 'details', type: 'string', optional: true, desc: 'Updated scope and breakdown' },
        ],
    },
    {
        name: 'get_notifications',
        scope: 'read',
        description: 'Returns notifications for the account (unread only by default).',
        params: [
            { name: 'unread_only', type: 'boolean', optional: true, desc: 'Default true — only unread' },
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–50, default 20)' },
        ],
    },
    {
        name: 'mark_notifications_read',
        scope: 'write',
        description: 'Marks one specific notification or all notifications as read.',
        params: [
            { name: 'notification_id', type: 'string', optional: true, desc: 'UUID of notification. Omit to mark all read.' },
        ],
    },
    {
        name: 'get_agent_actions',
        scope: 'read',
        description: 'Returns the agent action log (activity feed) for the account.',
        params: [
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–100, default 50)' },
            { name: 'offset', type: 'integer', optional: true, desc: 'Pagination offset (default 0)' },
            { name: 'job_id', type: 'string', optional: true, desc: 'Filter by job ID' },
        ],
    },
    {
        name: 'post_agent_instruction',
        scope: 'write',
        description: 'Records a plain-language instruction for the AI agent — same as the in-app "Instruct My Agent" input.',
        params: [
            { name: 'instruction', type: 'string', optional: false, desc: 'Instruction text (max 1000 chars)' },
        ],
    },
];

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
                <span className={styles.codeLang}>{lang}</span>
                <button
                    className={styles.copyBtn}
                    onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className={styles.pre}><code>{code}</code></pre>
        </div>
    );
}

export default function McpDocsPage() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.replit.app';

    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.hero}>
                        <div className={styles.badge}>MCP Integration</div>
                        <h1 className={styles.title}>BidFlow MCP Server</h1>
                        <p className={styles.subtitle}>
                            Connect Claude Desktop, LM Studio, and any MCP-compatible agent framework directly to BidFlow.
                            Manage bids, submit quotes, send agent instructions, and more — programmatically via JSON-RPC 2.0.
                        </p>
                        <Link href="/settings/api-keys" className={styles.ctaBtn}>
                            Get Your API Key →
                        </Link>
                    </div>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Quick Start</h2>
                        <div className={styles.steps}>
                            <div className={styles.step}>
                                <div className={styles.stepNum}>1</div>
                                <div>
                                    <strong>Create an API Key</strong>
                                    <p>Go to <Link href="/settings/api-keys">Settings → API Keys</Link> and create a key. Choose <em>read</em> for read-only agents or <em>read + write</em> for full access.</p>
                                </div>
                            </div>
                            <div className={styles.step}>
                                <div className={styles.stepNum}>2</div>
                                <div>
                                    <strong>Connect Your Agent</strong>
                                    <p>Configure your agent to POST JSON-RPC 2.0 messages to <code>{origin}/api/mcp</code> with the Bearer token.</p>
                                </div>
                            </div>
                            <div className={styles.step}>
                                <div className={styles.stepNum}>3</div>
                                <div>
                                    <strong>Call Tools</strong>
                                    <p>Use any of the 9 available tools to read data or take actions on BidFlow on behalf of your account.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Connection Details</h2>
                        <div className={styles.details}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Endpoint</span>
                                <code className={styles.detailValue}>POST {origin}/api/mcp</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Protocol</span>
                                <code className={styles.detailValue}>JSON-RPC 2.0</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>MCP Version</span>
                                <code className={styles.detailValue}>2024-11-05</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Authentication</span>
                                <code className={styles.detailValue}>Bearer bfk_...</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Streaming</span>
                                <code className={styles.detailValue}>Accept: text/event-stream → SSE</code>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Claude Desktop</h2>
                        <p className={styles.bodyText}>
                            Add BidFlow to your <code>claude_desktop_config.json</code>. Claude Desktop uses stdio transport,
                            so you&apos;ll need an HTTP bridge like <code>mcp-remote</code> (install via <code>npm i -g mcp-remote</code>):
                        </p>
                        <CodeBlock lang="json" code={`{
  "mcpServers": {
    "bidflow": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${origin}/api/mcp",
        "--header",
        "Authorization: Bearer bfk_your_key_here"
      ]
    }
  }
}`} />
                        <p className={styles.bodyText}>
                            Config file locations:
                            macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> ·
                            Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code>
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>LM Studio</h2>
                        <p className={styles.bodyText}>
                            LM Studio supports MCP via its built-in agent tools panel. In the <strong>Tools</strong> tab of your chat session,
                            click <strong>Add MCP Server</strong> and enter:
                        </p>
                        <div className={styles.details}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Server URL</span>
                                <code className={styles.detailValue}>{origin}/api/mcp</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Auth Header</span>
                                <code className={styles.detailValue}>Authorization: Bearer bfk_your_key_here</code>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Transport</span>
                                <code className={styles.detailValue}>HTTP (JSON-RPC)</code>
                            </div>
                        </div>
                        <p className={styles.bodyText}>
                            LM Studio will call <code>tools/list</code> to discover available tools and show them in the UI.
                            Enable the tools you want the model to use and start chatting.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Generic curl Examples</h2>
                        <p className={styles.bodyText}>Test the MCP server directly from your terminal:</p>

                        <p className={styles.bodyText}><strong>Initialize the session:</strong></p>
                        <CodeBlock lang="bash" code={`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": { "name": "curl-test", "version": "1.0.0" }
    }
  }'`} />

                        <p className={styles.bodyText}><strong>List available tools:</strong></p>
                        <CodeBlock lang="bash" code={`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'`} />

                        <p className={styles.bodyText}><strong>List your open jobs:</strong></p>
                        <CodeBlock lang="bash" code={`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_jobs",
      "arguments": { "status": "OPEN", "limit": 5 }
    }
  }'`} />

                        <p className={styles.bodyText}><strong>Send an agent instruction:</strong></p>
                        <CodeBlock lang="bash" code={`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "post_agent_instruction",
      "arguments": {
        "instruction": "Only accept quotes from vendors with verified profiles and at least 4-star ratings."
      }
    }
  }'`} />

                        <p className={styles.bodyText}><strong>SSE streaming (optional):</strong></p>
                        <CodeBlock lang="bash" code={`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_notifications","arguments":{}}}'`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Available Tools (9)</h2>
                        <div className={styles.toolList}>
                            {TOOLS.map(tool => (
                                <div key={tool.name} className={styles.toolCard}>
                                    <div className={styles.toolHeader}>
                                        <code className={styles.toolName}>{tool.name}</code>
                                        <span className={`${styles.scopeBadge} ${tool.scope === 'write' ? styles.write : styles.read}`}>
                                            {tool.scope}
                                        </span>
                                    </div>
                                    <p className={styles.toolDesc}>{tool.description}</p>
                                    {tool.params.length > 0 && (
                                        <table className={styles.paramTable}>
                                            <thead>
                                                <tr>
                                                    <th>Parameter</th>
                                                    <th>Type</th>
                                                    <th>Required</th>
                                                    <th>Description</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tool.params.map(p => (
                                                    <tr key={p.name}>
                                                        <td><code>{p.name}</code></td>
                                                        <td><code>{p.type}</code></td>
                                                        <td>{p.optional ? '—' : '✓'}</td>
                                                        <td>{p.desc}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>JSON-RPC Error Codes</h2>
                        <div className={styles.errorTable}>
                            <div className={styles.errorRow}>
                                <code>-32700</code><span>Parse error — invalid JSON body</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32600</code><span>Invalid request — missing jsonrpc or method</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32601</code><span>Method or tool not found</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32602</code><span>Invalid params — missing required argument</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32603</code><span>Internal server error</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32001</code><span>Unauthorized — invalid, expired, or revoked API key</span>
                            </div>
                            <div className={styles.errorRow}>
                                <code>-32029</code><span>Rate limit exceeded — 60 requests/minute per API key</span>
                            </div>
                        </div>
                        <p className={styles.bodyText}>
                            Tool-level errors (not found, forbidden, invalid state) are returned as successful JSON-RPC
                            responses with <code>isError: true</code> in the result content — this is standard MCP convention.
                        </p>
                    </section>

                    <div className={styles.footer}>
                        <Link href="/settings/api-keys" className={styles.ctaBtn}>
                            Create Your First API Key →
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
