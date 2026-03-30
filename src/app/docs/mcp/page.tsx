'use client';
import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const TOOLS = [
    {
        name: 'list_jobs',
        scope: 'read',
        description: 'List jobs for the authenticated user.',
        params: [
            { name: 'status', type: 'string', optional: true, desc: 'Filter: OPEN | IN_PROGRESS | COMPLETED | CANCELLED' },
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–50, default 20)' },
        ],
    },
    {
        name: 'get_job',
        scope: 'read',
        description: 'Get full details of a job including its quotes.',
        params: [
            { name: 'job_id', type: 'string', optional: false, desc: 'UUID of the job' },
        ],
    },
    {
        name: 'post_job',
        scope: 'write',
        description: 'Create a new job posting.',
        params: [
            { name: 'title', type: 'string', optional: false, desc: 'Job title (max 200 chars)' },
            { name: 'description', type: 'string', optional: false, desc: 'Detailed description' },
            { name: 'category', type: 'string', optional: false, desc: 'Job category' },
            { name: 'location', type: 'string', optional: false, desc: 'Job location' },
            { name: 'industry_vertical', type: 'string', optional: false, desc: 'Industry (e.g. "Home Services")' },
            { name: 'subcategory', type: 'string', optional: false, desc: 'Subcategory within industry' },
            { name: 'budget', type: 'string', optional: true, desc: 'Budget range (e.g. "$5000")' },
            { name: 'urgency', type: 'string', optional: true, desc: 'flexible | within_month | within_week | urgent' },
            { name: 'is_public', type: 'boolean', optional: true, desc: 'Visible on marketplace (default true)' },
            { name: 'tags', type: 'string[]', optional: true, desc: 'Array of tags' },
        ],
    },
    {
        name: 'list_quotes',
        scope: 'read',
        description: 'List quotes for a job. Owners see all quotes; vendors see their own.',
        params: [
            { name: 'job_id', type: 'string', optional: false, desc: 'UUID of the job' },
            { name: 'status', type: 'string', optional: true, desc: 'Filter: PENDING | ACCEPTED | REJECTED' },
        ],
    },
    {
        name: 'submit_quote',
        scope: 'write',
        description: 'Submit a vendor quote. User must have a vendor profile.',
        params: [
            { name: 'job_id', type: 'string', optional: false, desc: 'UUID of the job' },
            { name: 'amount', type: 'number', optional: false, desc: 'Quote amount in USD' },
            { name: 'estimated_days', type: 'integer', optional: false, desc: 'Estimated completion in days' },
            { name: 'details', type: 'string', optional: false, desc: 'Scope of work and breakdown' },
        ],
    },
    {
        name: 'get_agent_actions',
        scope: 'read',
        description: 'Retrieve agent activity feed with optional pagination.',
        params: [
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–100, default 50)' },
            { name: 'offset', type: 'integer', optional: true, desc: 'Pagination offset (default 0)' },
            { name: 'job_id', type: 'string', optional: true, desc: 'Filter by job ID' },
        ],
    },
    {
        name: 'send_agent_instruction',
        scope: 'write',
        description: 'Send a natural language instruction to the AI agent.',
        params: [
            { name: 'instruction', type: 'string', optional: false, desc: 'Instruction text (max 1000 chars)' },
        ],
    },
    {
        name: 'get_notifications',
        scope: 'read',
        description: 'Retrieve notification history.',
        params: [
            { name: 'unread_only', type: 'boolean', optional: true, desc: 'If true, only unread notifications' },
            { name: 'limit', type: 'integer', optional: true, desc: 'Max results (1–50, default 20)' },
        ],
    },
    {
        name: 'get_agent_config',
        scope: 'read',
        description: 'Get the AI agent configuration for the authenticated user.',
        params: [],
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
    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.hero}>
                        <div className={styles.badge}>MCP Integration</div>
                        <h1 className={styles.title}>BidFlow MCP Server</h1>
                        <p className={styles.subtitle}>
                            Connect Claude, GPT, and other AI agents directly to BidFlow via the Model Context Protocol (MCP).
                            List jobs, submit quotes, send agent instructions, and more — all from your AI agent.
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
                                    <p>Go to <Link href="/settings/api-keys">Settings → API Keys</Link> and create a key with the desired scopes.</p>
                                </div>
                            </div>
                            <div className={styles.step}>
                                <div className={styles.stepNum}>2</div>
                                <div>
                                    <strong>Connect Your Agent</strong>
                                    <p>Configure your AI agent to call the MCP endpoint using JSON-RPC 2.0 over HTTP.</p>
                                </div>
                            </div>
                            <div className={styles.step}>
                                <div className={styles.stepNum}>3</div>
                                <div>
                                    <strong>Call Tools</strong>
                                    <p>Use any of the 9 available tools to read data or take actions on BidFlow.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Connection Details</h2>
                        <div className={styles.details}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Endpoint</span>
                                <code className={styles.detailValue}>POST /api/mcp</code>
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
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Authentication</h2>
                        <p className={styles.bodyText}>
                            All requests must include your API key in the <code>Authorization</code> header:
                        </p>
                        <CodeBlock lang="http" code={`POST /api/mcp HTTP/1.1
Authorization: Bearer bfk_your_api_key_here
Content-Type: application/json`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Initialize</h2>
                        <p className={styles.bodyText}>Start by sending an <code>initialize</code> request to receive server capabilities:</p>
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": { "name": "my-agent", "version": "1.0.0" }
  }
}`} />
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "bidflow-mcp", "version": "1.0.0" }
  }
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>List Available Tools</h2>
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Call a Tool</h2>
                        <p className={styles.bodyText}>Use <code>tools/call</code> with <code>name</code> and <code>arguments</code>:</p>
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_jobs",
    "arguments": {
      "status": "OPEN",
      "limit": 10
    }
  }
}`} />
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ \\"jobs\\": [...], \\"count\\": 3 }"
      }
    ]
  }
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Example: Post a Job</h2>
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "post_job",
    "arguments": {
      "title": "Kitchen Renovation",
      "description": "Full kitchen remodel including cabinets, countertops, and appliances.",
      "category": "Home Renovation",
      "location": "Austin, TX",
      "industry_vertical": "Home Services",
      "subcategory": "Handyman",
      "budget": "$15,000-$25,000",
      "urgency": "within_month"
    }
  }
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Example: Send Agent Instruction</h2>
                        <CodeBlock code={`{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "send_agent_instruction",
    "arguments": {
      "instruction": "Only accept quotes from vendors with at least 4-star ratings and prioritize local Austin contractors."
    }
  }
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Claude Desktop Configuration</h2>
                        <p className={styles.bodyText}>
                            Add BidFlow to your <code>claude_desktop_config.json</code>. Since Claude Desktop uses stdio transport,
                            you&apos;ll need an MCP HTTP proxy such as <code>mcp-remote</code>:
                        </p>
                        <CodeBlock lang="json" code={`{
  "mcpServers": {
    "bidflow": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-app.replit.app/api/mcp",
        "--header",
        "Authorization: Bearer bfk_your_key_here"
      ]
    }
  }
}`} />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Available Tools</h2>
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
                        <h2 className={styles.sectionTitle}>Error Codes</h2>
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
                                <code>-32001</code><span>Unauthorized — invalid or missing API key</span>
                            </div>
                        </div>
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
