'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/services/db';
import { useAuth } from '@/context/AuthContext';
import { CommunityProject, Donation, CommunityProjectUpdate, LedgerEntry } from '@/types';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBadgeClass(status: string): string {
    if (status === 'FUNDED' || status === 'IN_PROGRESS') return styles.badgeFunded;
    if (status === 'COMPLETED' || status === 'CANCELLED') return styles.badgeCompleted;
    return styles.badgeActive;
}

type TabId = 'updates' | 'donations' | 'ledger';

export default function CommunityProjectDetail() {
    const params = useParams();
    const id = params?.id as string;
    const { user, session } = useAuth();

    const [project, setProject] = useState<CommunityProject | null>(null);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [updates, setUpdates] = useState<CommunityProjectUpdate[]>([]);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [activeTab, setActiveTab] = useState<TabId>('updates');

    const [donateAmount, setDonateAmount] = useState('');
    const [donateMessage, setDonateMessage] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [donating, setDonating] = useState(false);
    const [donateSuccess, setDonateSuccess] = useState('');

    const [updateTitle, setUpdateTitle] = useState('');
    const [updateContent, setUpdateContent] = useState('');
    const [postingUpdate, setPostingUpdate] = useState(false);

    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [recordingExpense, setRecordingExpense] = useState(false);

    const loadData = useCallback(async () => {
        if (!id) return;
        const [proj, dons, upd, led] = await Promise.all([
            db.getCommunityProject(id),
            db.getDonations(id),
            db.getCommunityProjectUpdates(id),
            db.getLedgerEntries(id),
        ]);
        if (proj) setProject(proj);
        setDonations(dons);
        setUpdates(upd);
        setLedger(led);
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const getAuthHeader = (): Record<string, string> => {
        const token = session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const handleDonate = async () => {
        const amount = parseFloat(donateAmount);
        if (!amount || amount <= 0) return;
        setDonating(true);
        setDonateSuccess('');
        try {
            const res = await fetch('/api/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({
                    action: 'donate',
                    communityProjectId: id,
                    amount,
                    isAnonymous,
                    message: donateMessage || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDonateSuccess(`Donation of ${formatCurrency(amount)} successful! TX: ${data.txHash}`);
            setDonateAmount('');
            setDonateMessage('');
            setIsAnonymous(false);
            await loadData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Donation failed';
            alert(message);
        } finally {
            setDonating(false);
        }
    };

    const handlePostUpdate = async () => {
        if (!updateTitle || !updateContent) return;
        setPostingUpdate(true);
        try {
            const res = await fetch('/api/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({
                    action: 'post-update',
                    communityProjectId: id,
                    title: updateTitle,
                    content: updateContent,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUpdateTitle('');
            setUpdateContent('');
            await loadData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to post update';
            alert(message);
        } finally {
            setPostingUpdate(false);
        }
    };

    const handleRecordExpense = async () => {
        const amount = parseFloat(expenseAmount);
        if (!amount || !expenseDesc) return;
        setRecordingExpense(true);
        try {
            const res = await fetch('/api/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({
                    action: 'record-expense',
                    communityProjectId: id,
                    amount,
                    description: expenseDesc,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setExpenseAmount('');
            setExpenseDesc('');
            await loadData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to record expense';
            alert(message);
        } finally {
            setRecordingExpense(false);
        }
    };

    if (!project) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.empty}>Loading project...</div>
                </div>
            </div>
        );
    }

    const pct = project.goalAmount > 0 ? Math.min(100, (project.currentFunding / project.goalAmount) * 100) : 0;
    const isCreator = user?.id === project.creatorId;
    const totalDonations = ledger.filter(e => e.type === 'DONATION').reduce((s, e) => s + e.amount, 0);
    const totalExpenses = ledger.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <Link href="/community" className={styles.backLink}>
                    {'\u2190'} Back to Community
                </Link>

                <div className={styles.header}>
                    <span className={`${styles.badge} ${getBadgeClass(project.status)}`}>
                        {project.status.replace('_', ' ')}
                    </span>
                    <h1 className={styles.title}>{project.title}</h1>
                    <div className={styles.meta}>
                        <span>{project.category}</span>
                        {project.location && <span>{'\u{1F4CD}'} {project.location}</span>}
                        <span>by {project.creatorName}</span>
                        <span>Created {formatDate(project.createdAt)}</span>
                    </div>
                </div>

                <div className={styles.twoCol}>
                    <div className={styles.mainCol}>
                        <div className={styles.card}>
                            <div className={styles.cardTitle}>About This Project</div>
                            <div className={styles.description}>{project.description}</div>
                        </div>

                        <div className={styles.tabs}>
                            {(['updates', 'donations', 'ledger'] as TabId[]).map(t => (
                                <button
                                    key={t}
                                    className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab(t)}
                                >
                                    {t === 'updates' ? `Updates (${updates.length})` :
                                     t === 'donations' ? `Donations (${donations.length})` :
                                     `Ledger (${ledger.length})`}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'updates' && (
                            <div>
                                {updates.length === 0 && <div className={styles.empty}>No updates yet</div>}
                                {updates.map(u => (
                                    <div key={u.id} className={styles.updateItem}>
                                        <div className={styles.updateTitle}>{u.title}</div>
                                        <div className={styles.updateMeta}>{u.authorName} &middot; {formatDate(u.createdAt)}</div>
                                        <div className={styles.updateContent}>{u.content}</div>
                                    </div>
                                ))}
                                {isCreator && (
                                    <div className={styles.updateForm}>
                                        <div className={styles.cardTitle}>Post an Update</div>
                                        <input
                                            type="text"
                                            placeholder="Update title"
                                            className={styles.formInput}
                                            value={updateTitle}
                                            onChange={e => setUpdateTitle(e.target.value)}
                                        />
                                        <textarea
                                            placeholder="Share progress with your supporters..."
                                            className={styles.messageInput}
                                            value={updateContent}
                                            onChange={e => setUpdateContent(e.target.value)}
                                        />
                                        <button
                                            className={styles.btnSmall}
                                            onClick={handlePostUpdate}
                                            disabled={postingUpdate || !updateTitle || !updateContent}
                                        >
                                            {postingUpdate ? 'Posting...' : 'Post Update'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'donations' && (
                            <div className={styles.donationList}>
                                {donations.length === 0 && <div className={styles.empty}>No donations yet. Be the first!</div>}
                                {donations.map(d => (
                                    <div key={d.id} className={styles.donationItem}>
                                        <div className={styles.donorInfo}>
                                            <span className={styles.donorName}>
                                                {d.isAnonymous ? 'Anonymous' : d.donorName}
                                            </span>
                                            {d.message && <span className={styles.donorMessage}>"{d.message}"</span>}
                                            <span className={styles.donationDate}>{formatDate(d.createdAt)}</span>
                                        </div>
                                        <span className={styles.donationAmount}>{formatCurrency(d.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'ledger' && (
                            <div>
                                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
                                    <span>Total In: <strong className={styles.ledgerDonation}>{formatCurrency(totalDonations)}</strong></span>
                                    <span>Total Out: <strong className={styles.ledgerExpense}>{formatCurrency(totalExpenses)}</strong></span>
                                    <span>Balance: <strong>{formatCurrency(totalDonations - totalExpenses)}</strong></span>
                                </div>
                                {ledger.length === 0 ? (
                                    <div className={styles.empty}>No ledger entries yet</div>
                                ) : (
                                    <table className={styles.ledgerTable}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Amount</th>
                                                <th>Description</th>
                                                <th>TX Hash</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ledger.map(e => (
                                                <tr key={e.id}>
                                                    <td>{formatDate(e.createdAt)}</td>
                                                    <td className={e.type === 'DONATION' ? styles.ledgerDonation : styles.ledgerExpense}>
                                                        {e.type}
                                                    </td>
                                                    <td className={e.type === 'DONATION' ? styles.ledgerDonation : styles.ledgerExpense}>
                                                        {e.type === 'DONATION' ? '+' : '-'}{formatCurrency(e.amount)}
                                                    </td>
                                                    <td>{e.description}</td>
                                                    <td className={styles.txHash}>
                                                        {e.transactionHash ? `${e.transactionHash.slice(0, 10)}...` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {isCreator && (
                                    <div className={styles.expenseForm}>
                                        <div className={styles.cardTitle}>Record an Expense</div>
                                        <div className={styles.inputRow}>
                                            <input
                                                type="number"
                                                placeholder="Amount"
                                                className={styles.amountInput}
                                                value={expenseAmount}
                                                onChange={e => setExpenseAmount(e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Description of expense..."
                                            className={styles.formInput}
                                            value={expenseDesc}
                                            onChange={e => setExpenseDesc(e.target.value)}
                                        />
                                        <button
                                            className={styles.btnSmall}
                                            onClick={handleRecordExpense}
                                            disabled={recordingExpense || !expenseAmount || !expenseDesc}
                                        >
                                            {recordingExpense ? 'Recording...' : 'Record Expense'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.sideCol}>
                        <div className={styles.card}>
                            <div className={styles.progressSection}>
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                                </div>
                                <div className={styles.progressStats}>
                                    <div>
                                        <div className={styles.progressFunded}>{formatCurrency(project.currentFunding)}</div>
                                        <div className={styles.progressGoal}>of {formatCurrency(project.goalAmount)} goal</div>
                                    </div>
                                    <div className={styles.progressPct}>{Math.round(pct)}%</div>
                                </div>
                            </div>

                            {project.status === 'ACTIVE' && (
                                user ? (
                                    <div className={styles.donateSection}>
                                        <div className={styles.inputRow}>
                                            <input
                                                type="number"
                                                placeholder="Amount ($)"
                                                className={styles.amountInput}
                                                value={donateAmount}
                                                onChange={e => setDonateAmount(e.target.value)}
                                                min="1"
                                                step="1"
                                            />
                                        </div>
                                        <textarea
                                            placeholder="Leave a message (optional)"
                                            className={styles.messageInput}
                                            value={donateMessage}
                                            onChange={e => setDonateMessage(e.target.value)}
                                            rows={2}
                                        />
                                        <label className={styles.checkRow}>
                                            <input
                                                type="checkbox"
                                                checked={isAnonymous}
                                                onChange={e => setIsAnonymous(e.target.checked)}
                                            />
                                            Donate anonymously
                                        </label>
                                        <button
                                            className={styles.btnDonate}
                                            onClick={handleDonate}
                                            disabled={donating || !donateAmount || parseFloat(donateAmount) <= 0}
                                        >
                                            {donating ? 'Processing...' : `Donate ${donateAmount ? formatCurrency(parseFloat(donateAmount)) : ''}`}
                                        </button>
                                        {donateSuccess && <div className={styles.donateSuccess}>{donateSuccess}</div>}
                                    </div>
                                ) : (
                                    <div className={styles.loginPrompt}>
                                        <Link href="/login">Sign in</Link> to donate to this project
                                    </div>
                                )
                            )}
                        </div>

                        {project.contractAddress && (
                            <div className={styles.card}>
                                <div className={styles.cardTitle}>Smart Contract</div>
                                <div className={styles.contractInfo}>
                                    <span className={styles.contractLabel}>Escrow Address:</span><br />
                                    {project.contractAddress}
                                </div>
                            </div>
                        )}

                        <div className={styles.card}>
                            <div className={styles.cardTitle}>Project Stats</div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div>Total Donors: <strong>{donations.length}</strong></div>
                                <div>Updates Posted: <strong>{updates.length}</strong></div>
                                <div>Ledger Entries: <strong>{ledger.length}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
