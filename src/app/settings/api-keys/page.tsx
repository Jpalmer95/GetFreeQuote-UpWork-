'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    raw_key?: string;
}

export default function ApiKeysPage() {
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read', 'write']);
    const [showForm, setShowForm] = useState(false);
    const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (!user || !session) return;
        fetchKeys();
    }, [user, session]);

    async function fetchKeys() {
        setLoading(true);
        try {
            const res = await fetch('/api/api-keys', {
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            const data = await res.json();
            if (res.ok) setKeys(data.keys || []);
        } finally {
            setLoading(false);
        }
    }

    async function createKey() {
        if (!newKeyName.trim()) { setError('Name is required'); return; }
        setCreating(true);
        setError('');
        try {
            const res = await fetch('/api/api-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
            });

            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to create key'); return; }

            setCreatedKey(data.key);
            setKeys(prev => [data.key, ...prev]);
            setShowForm(false);
            setNewKeyName('');
            setNewKeyScopes(['read', 'write']);
        } finally {
            setCreating(false);
        }
    }

    async function revokeKey(id: string) {
        if (!confirm('Revoke this API key? This cannot be undone — any agent using it will lose access.')) return;
        const res = await fetch(`/api/api-keys?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.ok) {
            setKeys(prev => prev.map(k => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
        }
    }

    function copyToClipboard(text: string, id: string) {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    function toggleScope(scope: string) {
        setNewKeyScopes(prev =>
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.replit.app';

    if (isLoading || !user) return null;

    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>API Keys</h1>
                            <p className={styles.subtitle}>
                                Manage API keys for external agent integrations via MCP.{' '}
                                <Link href="/docs/mcp" className={styles.docsLink}>View Integration Guide</Link>
                            </p>
                        </div>
                        <button
                            className={styles.createBtn}
                            onClick={() => { setShowForm(true); setCreatedKey(null); setError(''); }}
                        >
                            + Create API Key
                        </button>
                    </div>

                    {createdKey?.raw_key && (
                        <div className={styles.newKeyBanner}>
                            <div className={styles.newKeyHeader}>
                                <span className={styles.newKeyIcon}>🔑</span>
                                <strong>API Key Created — Copy it now, it won&apos;t be shown again!</strong>
                            </div>
                            <div className={styles.newKeyRow}>
                                <code className={styles.keyCode}>{createdKey.raw_key}</code>
                                <button
                                    className={styles.copyBtn}
                                    onClick={() => copyToClipboard(createdKey.raw_key!, 'new')}
                                >
                                    {copiedId === 'new' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <button
                                className={styles.dismissBtn}
                                onClick={() => setCreatedKey(null)}
                            >
                                I&apos;ve saved my key
                            </button>
                        </div>
                    )}

                    {showForm && (
                        <div className={styles.formCard}>
                            <h2 className={styles.formTitle}>New API Key</h2>
                            {error && <p className={styles.error}>{error}</p>}
                            <div className={styles.field}>
                                <label className={styles.label}>Key Name</label>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="e.g. Claude Integration, My Agent Bot"
                                    value={newKeyName}
                                    onChange={e => setNewKeyName(e.target.value)}
                                    maxLength={100}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Scopes</label>
                                <div className={styles.scopes}>
                                    <label className={styles.scopeCheck}>
                                        <input
                                            type="checkbox"
                                            checked={newKeyScopes.includes('read')}
                                            onChange={() => toggleScope('read')}
                                        />
                                        <span>
                                            <strong>Read</strong> — list_jobs, get_job, list_quotes, get_notifications, get_agent_actions
                                        </span>
                                    </label>
                                    <label className={styles.scopeCheck}>
                                        <input
                                            type="checkbox"
                                            checked={newKeyScopes.includes('write')}
                                            onChange={() => toggleScope('write')}
                                        />
                                        <span>
                                            <strong>Write</strong> — submit_quote, update_quote, mark_notifications_read, post_agent_instruction
                                        </span>
                                    </label>
                                </div>
                            </div>
                            <div className={styles.formActions}>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => { setShowForm(false); setError(''); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.submitBtn}
                                    onClick={createKey}
                                    disabled={creating}
                                >
                                    {creating ? 'Creating...' : 'Create Key'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className={styles.loading}>Loading API keys...</div>
                    ) : keys.length === 0 ? (
                        <div className={styles.empty}>
                            <div className={styles.emptyIcon}>🔐</div>
                            <p>No API keys yet. Create one to connect external agents via MCP.</p>
                        </div>
                    ) : (
                        <div className={styles.keyList}>
                            {keys.map(key => {
                                const isRevoked = !!key.revoked_at;
                                return (
                                    <div key={key.id} className={`${styles.keyCard} ${isRevoked ? styles.revoked : ''}`}>
                                        <div className={styles.keyMain}>
                                            <div className={styles.keyInfo}>
                                                <div className={styles.keyNameRow}>
                                                    <span className={styles.keyName}>{key.name}</span>
                                                    <span className={`${styles.keyStatus} ${isRevoked ? styles.revokedBadge : styles.activeBadge}`}>
                                                        {isRevoked ? 'Revoked' : 'Active'}
                                                    </span>
                                                </div>
                                                <div className={styles.keyMeta}>
                                                    <code className={styles.keyPrefix}>{key.key_prefix}...</code>
                                                    <span className={styles.dot}>·</span>
                                                    <span>Scopes: {key.scopes.join(', ')}</span>
                                                    <span className={styles.dot}>·</span>
                                                    <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                                                    {key.last_used_at && (
                                                        <>
                                                            <span className={styles.dot}>·</span>
                                                            <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                                                        </>
                                                    )}
                                                    {key.revoked_at && (
                                                        <>
                                                            <span className={styles.dot}>·</span>
                                                            <span>Revoked {new Date(key.revoked_at).toLocaleDateString()}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!isRevoked && (
                                            <div className={styles.keyActions}>
                                                <button
                                                    className={styles.revokeBtn}
                                                    onClick={() => revokeKey(key.id)}
                                                >
                                                    Revoke
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className={styles.infoCard}>
                        <h3 className={styles.infoTitle}>Using Your API Key</h3>
                        <p className={styles.infoText}>
                            Pass your API key as a Bearer token in the Authorization header:
                        </p>
                        <div className={styles.codeBlock}>
                            <div className={styles.codeHeader}>
                                <span>HTTP Header</span>
                                <button
                                    className={styles.copySmall}
                                    onClick={() => copyToClipboard('Authorization: Bearer bfk_your_key_here', 'header')}
                                >
                                    {copiedId === 'header' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <code>Authorization: Bearer bfk_your_key_here</code>
                        </div>
                        <p className={styles.infoText}>
                            MCP Endpoint: <code>{origin}/api/mcp</code>
                        </p>
                        <p className={styles.infoLink}>
                            <Link href="/docs/mcp">View the full MCP Integration Guide →</Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
