'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AgentAction, AgentInstruction } from '@/types';
import { db } from '@/services/db';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

type FeedItem =
    | { kind: 'action'; data: AgentAction; ts: number }
    | { kind: 'instruction'; data: AgentInstruction; ts: number };

const ACTION_ICONS: Record<string, string> = {
    job_broadcast: 'BROADCAST',
    vendor_match: 'MATCH',
    auto_quote: 'QUOTE',
    clarification_sent: 'CLARIFY',
    clarification_received: 'REPLY',
    scope_analysis: 'ANALYZE',
    quote_comparison: 'COMPARE',
    escalation: 'ESCALATE',
    negotiation: 'NEGOTIATE',
    auto_approve: 'APPROVE',
    auto_reject: 'REJECT',
    owner_instruction: 'YOU',
};

const ACTION_LABELS: Record<string, string> = {
    job_broadcast: 'Job Broadcast',
    vendor_match: 'Vendor Matched',
    auto_quote: 'Auto Quote',
    clarification_sent: 'Clarification Sent',
    clarification_received: 'Clarification Received',
    scope_analysis: 'Scope Analysis',
    quote_comparison: 'Quote Comparison',
    escalation: 'Escalation',
    negotiation: 'Negotiation',
    auto_approve: 'Auto Approved',
    auto_reject: 'Auto Rejected',
    owner_instruction: 'Your Instruction',
};

const ACTION_COLORS: Record<string, string> = {
    escalation: 'var(--color-error, #f85149)',
    auto_approve: 'var(--color-success, #3fb950)',
    auto_reject: 'var(--color-error, #f85149)',
    owner_instruction: '#9b6dff',
    job_broadcast: '#6366f1',
    vendor_match: '#3fb950',
    auto_quote: '#f0a44e',
    default: 'rgba(255,255,255,0.3)',
};

function getColor(actionType: string): string {
    return ACTION_COLORS[actionType] || ACTION_COLORS.default;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

function mergeFeed(actions: AgentAction[], instructions: AgentInstruction[]): FeedItem[] {
    const items: FeedItem[] = [
        ...actions.map(a => ({ kind: 'action' as const, data: a, ts: new Date(a.createdAt).getTime() })),
        ...instructions.map(i => ({ kind: 'instruction' as const, data: i, ts: new Date(i.createdAt).getTime() })),
    ];
    items.sort((a, b) => b.ts - a.ts);
    return items;
}

const PAGE_SIZE = 25;

export default function AgentHub() {
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [actions, setActions] = useState<AgentAction[]>([]);
    const [instructions, setInstructions] = useState<AgentInstruction[]>([]);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [actionsOffset, setActionsOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const [instructionText, setInstructionText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState('');

    const [pushStatus, setPushStatus] = useState<'unsupported' | 'prompt' | 'granted' | 'denied'>('prompt');
    const [pushLoading, setPushLoading] = useState(false);
    const swRef = useRef<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (!isLoading && !user) router.push('/login');
    }, [user, isLoading, router]);

    const loadInitial = useCallback(async (uid: string) => {
        setLoadingFeed(true);
        try {
            const [newActions, newInstructions] = await Promise.all([
                db.getAgentActionsByUser(uid, PAGE_SIZE, 0),
                db.getAgentInstructions(uid, PAGE_SIZE, 0),
            ]);
            setActions(newActions);
            setInstructions(newInstructions);
            setActionsOffset(PAGE_SIZE);
            setHasMore(newActions.length === PAGE_SIZE);
        } finally {
            setLoadingFeed(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!user || !hasMore || loadingFeed) return;
        setLoadingFeed(true);
        try {
            const newActions = await db.getAgentActionsByUser(user.id, PAGE_SIZE, actionsOffset);
            setActions(prev => [...prev, ...newActions]);
            setActionsOffset(prev => prev + PAGE_SIZE);
            setHasMore(newActions.length === PAGE_SIZE);
        } finally {
            setLoadingFeed(false);
        }
    }, [user, hasMore, loadingFeed, actionsOffset]);

    useEffect(() => {
        if (user) loadInitial(user.id);
    }, [user, loadInitial]);

    useEffect(() => {
        setFeed(mergeFeed(actions, instructions));
    }, [actions, instructions]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushStatus('unsupported');
            return;
        }
        navigator.serviceWorker.register('/sw.js').then(reg => {
            swRef.current = reg;
        }).catch(() => {});
        if (Notification.permission === 'granted') setPushStatus('granted');
        else if (Notification.permission === 'denied') setPushStatus('denied');
        else setPushStatus('prompt');
    }, []);

    const handleEnablePush = async () => {
        if (!session || !swRef.current) return;
        setPushLoading(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { setPushStatus('denied'); return; }
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) { showToast('Push notifications are not configured.'); return; }
            const sub = await swRef.current.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
            const res = await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
                body: JSON.stringify({ subscription: sub.toJSON() }),
            });
            if (res.ok) { setPushStatus('granted'); showToast('Push notifications enabled!'); }
        } catch (err) {
            console.error('Push subscribe error:', err);
            showToast('Failed to enable push notifications.');
        } finally {
            setPushLoading(false);
        }
    };

    const handleDisablePush = async () => {
        if (!session) return;
        setPushLoading(true);
        try {
            await fetch('/api/push-subscribe', { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.access_token } });
            setPushStatus('prompt');
            showToast('Push notifications disabled.');
        } finally {
            setPushLoading(false);
        }
    };

    const handleSubmitInstruction = async () => {
        if (!session || !instructionText.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/agent-instruct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
                body: JSON.stringify({ instruction: instructionText.trim() }),
            });
            if (!res.ok) {
                const d = await res.json();
                showToast(d.error || 'Failed to save instruction.');
                return;
            }
            const { instruction } = await res.json();
            const mapped: AgentInstruction = {
                id: instruction.id,
                userId: instruction.user_id,
                instruction: instruction.instruction,
                acknowledged: instruction.acknowledged,
                createdAt: instruction.created_at,
            };
            setInstructions(prev => [mapped, ...prev]);
            setInstructionText('');
            showToast('Instruction saved. Your agent will act on it next run.');
        } finally {
            setSubmitting(false);
        }
    };

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(''), 4000);
    }

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    return (
        <div className={styles.container}>
            <Navbar />
            {toast && <div className={styles.toast}>{toast}</div>}

            <header className={styles.pageHeader}>
                <div>
                    <h2 className="gradient-text">Agent Hub</h2>
                    <p className={styles.subtitle}>Everything your agent has done, and what you want it to do next.</p>
                </div>
                <div className={styles.headerLinks}>
                    <Link href="/agent-settings" className={styles.headerLink}>Agent Settings</Link>
                    <Link href="/settings/notifications" className={styles.headerLink}>Notification Prefs</Link>
                </div>
            </header>

            <div className={styles.content}>
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div className={styles.instructTitle}>Instruct My Agent</div>
                    <div className={styles.instructDesc}>
                        Give your agent a plain-language directive. It will be logged and applied on its next run.
                    </div>
                    <div className={styles.instructRow}>
                        <textarea
                            className={styles.instructInput}
                            placeholder={`e.g. "Don't accept quotes over $5,000 this week" or "Prioritize roofing specialists"`}
                            value={instructionText}
                            onChange={e => setInstructionText(e.target.value)}
                            rows={3}
                            maxLength={1000}
                        />
                        <button
                            className={styles.instructBtn}
                            onClick={handleSubmitInstruction}
                            disabled={submitting || !instructionText.trim()}
                        >
                            {submitting ? 'Saving...' : 'Send to Agent'}
                        </button>
                    </div>
                </div>

                {pushStatus !== 'unsupported' && (
                    <div className={`glass-panel ${styles.pushBanner}`}>
                        <div className={styles.pushInfo}>
                            <div className={styles.pushBell}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                    <path d="M13.73 21a2 2 0 01-3.46 0"/>
                                </svg>
                            </div>
                            <div>
                                <div className={styles.pushTitle}>Browser Push Notifications</div>
                                <div className={styles.pushDesc}>
                                    {pushStatus === 'granted'
                                        ? 'Active — your browser will alert you for quotes, escalations, and approvals.'
                                        : pushStatus === 'denied'
                                        ? 'Blocked by your browser. Update browser permissions to enable.'
                                        : 'Get instant browser alerts even when the app is in the background.'}
                                </div>
                            </div>
                        </div>
                        {pushStatus === 'prompt' && (
                            <button className={styles.pushBtn} onClick={handleEnablePush} disabled={pushLoading}>
                                {pushLoading ? 'Enabling...' : 'Enable Push'}
                            </button>
                        )}
                        {pushStatus === 'granted' && (
                            <button className={`${styles.pushBtn} ${styles.pushBtnOff}`} onClick={handleDisablePush} disabled={pushLoading}>
                                {pushLoading ? '...' : 'Disable'}
                            </button>
                        )}
                    </div>
                )}

                <div className={styles.feedSection}>
                    <h3 className={styles.feedTitle}>Activity Feed</h3>
                    {loadingFeed && feed.length === 0 ? (
                        <div className={styles.emptyState}>Loading activity...</div>
                    ) : feed.length === 0 ? (
                        <div className={styles.emptyState}>
                            No agent activity yet. Post a job or configure your agent to get started.
                            <br />
                            <Link href="/agent-settings" className={styles.setupLink}>Configure your agent</Link>
                        </div>
                    ) : (
                        <>
                            <div className={styles.timeline}>
                                {feed.map(item =>
                                    item.kind === 'action'
                                        ? <ActionItem key={'a-' + item.data.id} action={item.data} />
                                        : <InstructionItem key={'i-' + item.data.id} instruction={item.data} />
                                )}
                            </div>
                            {hasMore && (
                                <button className={styles.loadMore} onClick={loadMore} disabled={loadingFeed}>
                                    {loadingFeed ? 'Loading...' : 'Load more'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ActionItem({ action }: { action: AgentAction }) {
    const label = ACTION_LABELS[action.actionType] || action.actionType;
    const chip = ACTION_ICONS[action.actionType] || 'ACT';
    const color = getColor(action.actionType);
    const isAlert = action.actionType === 'escalation';

    return (
        <div className={`${styles.feedItem} ${isAlert ? styles.feedItemAlert : ''}`}>
            <div className={styles.feedChip} style={{ borderColor: color, color }}>
                {chip}
            </div>
            <div className={styles.feedBody}>
                <div className={styles.feedMeta}>
                    <span className={styles.feedType} style={{ color }}>{label}</span>
                    <span className={styles.feedTime}>{timeAgo(action.createdAt)}</span>
                </div>
                <div className={styles.feedSummary}>{action.summary}</div>
                {action.jobId && (
                    <Link href={'/dashboard?job=' + action.jobId} className={styles.feedLink}>
                        View job
                    </Link>
                )}
            </div>
        </div>
    );
}

function InstructionItem({ instruction }: { instruction: AgentInstruction }) {
    return (
        <div className={`${styles.feedItem} ${styles.feedItemInstruction}`}>
            <div className={styles.feedChip} style={{ borderColor: '#9b6dff', color: '#9b6dff' }}>
                YOU
            </div>
            <div className={styles.feedBody}>
                <div className={styles.feedMeta}>
                    <span className={styles.feedType} style={{ color: '#9b6dff' }}>Your Instruction</span>
                    <span className={styles.feedTime}>{timeAgo(instruction.createdAt)}</span>
                </div>
                <div className={styles.feedSummary} style={{ fontStyle: 'italic' }}>
                    {'"' + instruction.instruction + '"'}
                </div>
                {instruction.acknowledged && (
                    <div className={styles.feedAck}>Agent acknowledged</div>
                )}
            </div>
        </div>
    );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
