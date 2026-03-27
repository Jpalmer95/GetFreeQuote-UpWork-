'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { jobService } from '@/services/jobService';
import { Job, Quote, Message, AgentAction, IndustryVertical, INDUSTRY_VERTICALS } from '@/types';
import { db } from '@/services/db';
import { isAgentSender, getAgentLabel } from '@/services/aiAgent';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';
import QuoteComparison, { CompareQuotesButton } from '@/components/QuoteComparison';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const STATUS_CLASS: Record<string, string> = {
    OPEN:        'badge badge-blue',
    IN_PROGRESS: 'badge badge-amber',
    COMPLETED:   'badge badge-green',
    CANCELLED:   'badge badge-muted',
};

const URGENCY_LABELS: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This Month',
    within_week: 'This Week',
    urgent: 'Urgent',
};

const ACTION_ICONS: Record<string, string> = {
    job_broadcast: '📡',
    vendor_match: '🤝',
    auto_quote: '💰',
    clarification_sent: '❓',
    clarification_received: '💬',
    scope_analysis: '🔍',
    quote_comparison: '📊',
    escalation: '⚠️',
    negotiation: '🔄',
    auto_approve: '✅',
    auto_reject: '❌',
};

type DetailTab = 'timeline' | 'quotes' | 'agent-log' | 'digest';

export default function Dashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
    const [activeTab, setActiveTab] = useState<DetailTab>('timeline');

    const [industryFilter, setIndustryFilter] = useState<IndustryVertical | ''>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [vendorInfo, setVendorInfo] = useState<Record<string, { rating?: number; isVerified: boolean }>>({});

    const handleSendReply = useCallback(async () => {
        if (!selectedJob || !replyText.trim() || sendingReply) return;
        setSendingReply(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
            await fetch('/api/agent-respond', {
                method: 'POST',
                headers,
                body: JSON.stringify({ jobId: selectedJob.id, message: replyText.trim() }),
            });
            setReplyText('');
        } catch (err) {
            console.error('Failed to send reply:', err);
        } finally {
            setSendingReply(false);
        }
    }, [selectedJob, replyText, sendingReply]);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (!user) return;

        const fetchJobs = async () => {
            const myJobs = await jobService.getMyJobs(user.id);
            setJobs([...myJobs]);

            if (selectedJob) {
                const [updatedQuotes, updatedMessages, updatedActions] = await Promise.all([
                    jobService.getJobQuotes(selectedJob.id),
                    jobService.getJobMessages(selectedJob.id),
                    db.getAgentActions(selectedJob.id),
                ]);
                setQuotes([...updatedQuotes]);
                setMessages([...updatedMessages]);
                setAgentActions([...updatedActions]);

                const vendorIds = [...new Set(updatedQuotes.map(q => q.vendorId))];
                if (vendorIds.length > 0) {
                    const info = await db.getVendorInfoByUserIds(vendorIds);
                    setVendorInfo(info);
                }
            }
        };

        fetchJobs();
        const interval = setInterval(fetchJobs, 3000);
        return () => clearInterval(interval);
    }, [selectedJob, user]);

    const filteredJobs = useMemo(() => {
        let result = jobs;
        if (industryFilter) result = result.filter(j => j.industryVertical === industryFilter);
        if (statusFilter) result = result.filter(j => j.status === statusFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(j =>
                j.title.toLowerCase().includes(q) ||
                j.subcategory.toLowerCase().includes(q) ||
                j.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        return result;
    }, [jobs, industryFilter, statusFilter, searchQuery]);

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <header className={styles.pageHeader}>
                <h2 className="gradient-text">My Projects</h2>
                <div className={styles.headerActions}>
                    <Link href="/agent-settings" className={styles.agentBtn}>AI Agent Settings</Link>
                    <Link href="/post-job" className={styles.newBtn}>+ New Project</Link>
                </div>
            </header>

            <div className={styles.layout}>
                <aside className={styles.jobList}>
                    <div className={styles.filterBar}>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className={styles.sidebarSearch}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <select
                            className={styles.sidebarFilter}
                            value={industryFilter}
                            onChange={(e) => setIndustryFilter(e.target.value as IndustryVertical | '')}
                        >
                            <option value="">All Industries</option>
                            {INDUSTRY_VERTICALS.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                        <select
                            className={styles.sidebarFilter}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    <div className={styles.jobListItems}>
                        {filteredJobs.map(job => (
                            <div
                                key={job.id}
                                className={`${styles.jobCard} ${selectedJob?.id === job.id ? styles.activeJob : ''}`}
                                onClick={() => { setSelectedJob(job); setActiveTab('timeline'); }}
                            >
                                <div className={styles.jobCardTitle}>{job.title}</div>
                                <div className={styles.jobCardIndustry}>{job.industryVertical}</div>
                                <div className={styles.jobCardMeta}>
                                    <span className={STATUS_CLASS[job.status] || 'badge badge-muted'}>
                                        {job.status}
                                    </span>
                                    <span className={styles.date}>
                                        {new Date(job.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {filteredJobs.length === 0 && (
                            <p className={styles.emptyState}>
                                {jobs.length === 0 ? 'No projects yet. Post one!' : 'No projects match your filters.'}
                            </p>
                        )}
                    </div>
                </aside>

                <main className={styles.detailView}>
                    {selectedJob ? (
                        <>
                            <div className={`glass-panel ${styles.detailHeaders}`}>
                                <h2>{selectedJob.title}</h2>
                                <div className={styles.detailMeta}>
                                    <span className={styles.industryBadge}>{selectedJob.industryVertical}</span>
                                    <span className={styles.subcategoryBadge}>{selectedJob.subcategory || selectedJob.category}</span>
                                    {selectedJob.urgency && selectedJob.urgency !== 'flexible' && (
                                        <span className={styles.urgencyBadge}>{URGENCY_LABELS[selectedJob.urgency]}</span>
                                    )}
                                </div>
                                <p className={styles.location}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {selectedJob.location}
                                </p>
                                {(selectedJob.squareFootage || selectedJob.materials || selectedJob.budget) && (
                                    <div className={styles.tags}>
                                        {selectedJob.budget && <span className={styles.tag}>{selectedJob.budget}</span>}
                                        {selectedJob.squareFootage && <span className={styles.tag}>{selectedJob.squareFootage}</span>}
                                        {selectedJob.materials && <span className={styles.tag}>{selectedJob.materials}</span>}
                                    </div>
                                )}
                                {selectedJob.tags.length > 0 && (
                                    <div className={styles.tags}>
                                        {selectedJob.tags
                                            .filter(t => t !== selectedJob.industryVertical && t !== selectedJob.subcategory)
                                            .map(t => (
                                                <span key={t} className={styles.tag}>{t}</span>
                                            ))}
                                    </div>
                                )}
                                {selectedJob.attachments && selectedJob.attachments.length > 0 && (
                                    <div className={styles.attachmentGallery}>
                                        {selectedJob.attachments.map((url, i) => (
                                            /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) ? (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.attachmentThumb}>
                                                    <img src={url} alt={`Attachment ${i + 1}`} />
                                                </a>
                                            ) : (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.attachmentFile}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                    <span>{url.split('/').pop()}</span>
                                                </a>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={styles.tabBar}>
                                <button
                                    className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('timeline')}
                                >
                                    Timeline ({messages.length})
                                </button>
                                <button
                                    className={`${styles.tabBtn} ${activeTab === 'quotes' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('quotes')}
                                >
                                    Quotes ({quotes.length})
                                </button>
                                <button
                                    className={`${styles.tabBtn} ${activeTab === 'agent-log' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('agent-log')}
                                >
                                    Agent Log ({agentActions.length})
                                </button>
                                <button
                                    className={`${styles.tabBtn} ${activeTab === 'digest' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('digest')}
                                >
                                    Digest
                                </button>
                            </div>

                            {activeTab === 'timeline' && (
                                <section className={`glass-panel ${styles.section}`}>
                                    <div className={styles.timelineList}>
                                        {messages.map(msg => {
                                            const isAgent = isAgentSender(msg.senderId);
                                            const label = getAgentLabel(msg.senderId);
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`${styles.timelineItem} ${isAgent ? styles.timelineAgent : styles.timelineUser}`}
                                                >
                                                    <div className={styles.timelineHeader}>
                                                        <span className={`${styles.senderLabel} ${isAgent ? styles.senderAgent : styles.senderHuman}`}>
                                                            {label}
                                                        </span>
                                                        {isAgent && (
                                                            <span className={styles.automatedBadge}>Automated</span>
                                                        )}
                                                        <span className={styles.timelineTime}>
                                                            {new Date(msg.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className={styles.timelineContent}>{msg.content}</div>
                                                </div>
                                            );
                                        })}
                                        {messages.length === 0 && (
                                            <p className={styles.emptyMsg}>No activity yet. Your AI agent will begin working once the project is posted.</p>
                                        )}
                                    </div>
                                    <div className={styles.replyBar}>
                                        <input
                                            type="text"
                                            className={styles.replyInput}
                                            placeholder="Type a message to intervene or add details..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(); }}
                                            disabled={sendingReply}
                                        />
                                        <button
                                            className={styles.replyBtn}
                                            onClick={handleSendReply}
                                            disabled={sendingReply || !replyText.trim()}
                                        >
                                            {sendingReply ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </section>
                            )}

                            {activeTab === 'quotes' && (
                                <section className={`glass-panel ${styles.section}`}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                                        <CompareQuotesButton quotes={quotes} onClick={() => setShowComparison(true)} />
                                    </div>
                                    <div className={styles.quoteList}>
                                        {quotes.map(quote => (
                                            <div key={quote.id} className={styles.quoteCard}>
                                                <div className={styles.quoteHeader}>
                                                    <span className={styles.vendorName}>
                                                        {quote.vendorName}
                                                        {vendorInfo[quote.vendorId]?.isVerified && (
                                                            <span className="badge badge-green" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>✓ Verified</span>
                                                        )}
                                                    </span>
                                                    <span className={styles.price}>${quote.amount}</span>
                                                </div>
                                                <p className={styles.timeline}>{quote.estimatedDays} day estimate</p>
                                                <p className={styles.details}>{quote.details}</p>
                                                {quote.status === 'PENDING' && (
                                                    <div className={styles.quoteActions}>
                                                        <button
                                                            className={styles.acceptBtn}
                                                            onClick={async () => {
                                                                await jobService.acceptQuote(quote.id);
                                                            }}
                                                        >Accept</button>
                                                        <button
                                                            className={styles.rejectBtn}
                                                            onClick={async () => {
                                                                await jobService.rejectQuote(quote.id);
                                                            }}
                                                        >Reject</button>
                                                    </div>
                                                )}
                                                {quote.status !== 'PENDING' && (
                                                    <div className={styles.quoteStatus}>
                                                        <span className={`badge ${quote.status === 'ACCEPTED' ? 'badge-green' : 'badge-muted'}`}>
                                                            {quote.status}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {quotes.length === 0 && (
                                            <p className={styles.emptyMsg}>Waiting for vendor agents to submit quotes...</p>
                                        )}
                                    </div>
                                    {showComparison && quotes.length >= 2 && (
                                        <QuoteComparison
                                            quotes={quotes}
                                            vendorInfo={vendorInfo}
                                            onAccept={async (quoteId) => {
                                                await jobService.acceptQuote(quoteId);
                                                setShowComparison(false);
                                            }}
                                            onReject={async (quoteId) => {
                                                await jobService.rejectQuote(quoteId);
                                                setShowComparison(false);
                                            }}
                                            onClose={() => setShowComparison(false)}
                                        />
                                    )}
                                </section>
                            )}

                            {activeTab === 'agent-log' && (
                                <section className={`glass-panel ${styles.section}`}>
                                    <div className={styles.agentLogList}>
                                        {agentActions.map(action => (
                                            <div key={action.id} className={styles.agentLogItem}>
                                                <span className={styles.agentLogIcon}>
                                                    {ACTION_ICONS[action.actionType] || '🔵'}
                                                </span>
                                                <div className={styles.agentLogContent}>
                                                    <div className={styles.agentLogSummary}>{action.summary}</div>
                                                    <div className={styles.agentLogMeta}>
                                                        <span className={action.automated ? styles.automatedBadge : styles.manualBadge}>
                                                            {action.automated ? 'Automated' : 'Manual'}
                                                        </span>
                                                        <span className={styles.agentLogTime}>
                                                            {new Date(action.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {agentActions.length === 0 && (
                                            <p className={styles.emptyMsg}>No agent actions recorded yet.</p>
                                        )}
                                    </div>
                                </section>
                            )}

                            {activeTab === 'digest' && (
                                <section className={`glass-panel ${styles.section}`}>
                                    <div className={styles.digestSection}>
                                        <div className={styles.digestCard}>
                                            <div className={styles.digestTitle}>Agent Activity Summary</div>
                                            <div className={styles.digestStats}>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{messages.filter(m => isAgentSender(m.senderId)).length}</span>
                                                    agent messages
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{messages.filter(m => !isAgentSender(m.senderId)).length}</span>
                                                    human messages
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{agentActions.filter(a => a.automated).length}</span>
                                                    automated actions
                                                </span>
                                            </div>
                                        </div>

                                        <div className={styles.digestCard}>
                                            <div className={styles.digestTitle}>Quotes Overview</div>
                                            <div className={styles.digestStats}>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{quotes.length}</span>
                                                    total quotes
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{quotes.filter(q => q.status === 'PENDING').length}</span>
                                                    pending review
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{quotes.filter(q => q.status === 'ACCEPTED').length}</span>
                                                    accepted
                                                </span>
                                                {quotes.length > 0 && (
                                                    <span className={styles.digestStat}>
                                                        <span className={styles.digestStatValue}>
                                                            ${Math.min(...quotes.map(q => q.amount))} - ${Math.max(...quotes.map(q => q.amount))}
                                                        </span>
                                                        price range
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.digestCard}>
                                            <div className={styles.digestTitle}>Vendor Matching</div>
                                            <div className={styles.digestStats}>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{agentActions.filter(a => a.actionType === 'vendor_match').length}</span>
                                                    vendors matched
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{agentActions.filter(a => a.actionType === 'auto_quote').length}</span>
                                                    auto-quotes generated
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{agentActions.filter(a => a.actionType === 'escalation').length}</span>
                                                    escalations
                                                </span>
                                                <span className={styles.digestStat}>
                                                    <span className={styles.digestStatValue}>{agentActions.filter(a => a.actionType === 'auto_reject').length}</span>
                                                    auto-rejected
                                                </span>
                                            </div>
                                        </div>

                                        {agentActions.filter(a => a.actionType === 'escalation').length > 0 && (
                                            <div className={styles.digestCard}>
                                                <div className={styles.digestTitle}>Requires Your Attention</div>
                                                {agentActions.filter(a => a.actionType === 'escalation').map(a => (
                                                    <div key={a.id} className={styles.agentLogItem} style={{ marginBottom: '0.4rem' }}>
                                                        <span className={styles.agentLogIcon}>⚠️</span>
                                                        <div className={styles.agentLogContent}>
                                                            <div className={styles.agentLogSummary}>{a.summary}</div>
                                                            <div className={styles.agentLogTime}>{new Date(a.createdAt).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {quotes.filter(q => q.status === 'PENDING').length > 0 && (
                                            <div className={styles.digestCard}>
                                                <div className={styles.digestTitle}>Pending Quote Decisions</div>
                                                {quotes.filter(q => q.status === 'PENDING').map(q => (
                                                    <div key={q.id} className={styles.quoteCard} style={{ marginBottom: '0.4rem' }}>
                                                        <div className={styles.quoteHeader}>
                                                            <span className={styles.vendorName}>{q.vendorName}</span>
                                                            <span className={styles.price}>${q.amount}</span>
                                                        </div>
                                                        <p className={styles.timeline}>{q.estimatedDays} day estimate</p>
                                                        <div className={styles.quoteActions}>
                                                            <button
                                                                className={styles.acceptBtn}
                                                                onClick={async () => { await jobService.acceptQuote(q.id); }}
                                                            >Accept</button>
                                                            <button
                                                                className={styles.rejectBtn}
                                                                onClick={async () => { await jobService.rejectQuote(q.id); }}
                                                            >Reject</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </>
                    ) : (
                        <div className={styles.placeholder}>
                            <svg className={styles.placeholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            <p>Select a project to view details, quotes &amp; agent activity</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
