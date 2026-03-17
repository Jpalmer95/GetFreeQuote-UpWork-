'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jobService } from '@/services/jobService';
import { Job, Quote, Message } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const STATUS_CLASS: Record<string, string> = {
    OPEN:        'badge badge-blue',
    IN_PROGRESS: 'badge badge-amber',
    COMPLETED:   'badge badge-green',
    CANCELLED:   'badge badge-muted',
};

export default function Dashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

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
                const updatedQuotes = await jobService.getJobQuotes(selectedJob.id);
                const updatedMessages = await jobService.getJobMessages(selectedJob.id);
                setQuotes([...updatedQuotes]);
                setMessages([...updatedMessages]);
            }
        };

        fetchJobs();
        const interval = setInterval(fetchJobs, 2000);
        return () => clearInterval(interval);
    }, [selectedJob, user]);

    if (isLoading || !user) {
        return <div className="loading-screen">Loading…</div>;
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <header className={styles.pageHeader}>
                <h2 className="gradient-text">My Jobs</h2>
                <Link href="/post-job" className={styles.newBtn}>+ New Job</Link>
            </header>

            <div className={styles.layout}>
                <aside className={styles.jobList}>
                    {jobs.map(job => (
                        <div
                            key={job.id}
                            className={`${styles.jobCard} ${selectedJob?.id === job.id ? styles.activeJob : ''}`}
                            onClick={() => setSelectedJob(job)}
                        >
                            <div className={styles.jobCardTitle}>{job.title}</div>
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
                    {jobs.length === 0 && (
                        <p className={styles.emptyState}>No jobs yet. Post one!</p>
                    )}
                </aside>

                <main className={styles.detailView}>
                    {selectedJob ? (
                        <>
                            <div className={`glass-panel ${styles.detailHeaders}`}>
                                <h2>{selectedJob.title}</h2>
                                <p className={styles.location}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {selectedJob.location}
                                </p>
                                <div className={styles.tags}>
                                    {selectedJob.tags.map(t => (
                                        <span key={t} className={styles.tag}>{t}</span>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.splitContent}>
                                <section className={`glass-panel ${styles.section}`}>
                                    <div className={styles.sectionTitle}>Agent Updates</div>
                                    <div className={styles.messageLog}>
                                        {messages.map(msg => (
                                            <div
                                                key={msg.id}
                                                className={`${styles.message} ${msg.senderId === 'system-agent' ? styles.agentMsg : ''}`}
                                            >
                                                <span className={styles.messageSender}>
                                                    {msg.senderId === 'system-agent' ? 'AI Agent' : 'You'}
                                                </span>
                                                {msg.content}
                                            </div>
                                        ))}
                                        {messages.length === 0 && (
                                            <p className={styles.emptyMsg}>No activity yet.</p>
                                        )}
                                    </div>
                                </section>

                                <section className={`glass-panel ${styles.section}`}>
                                    <div className={styles.sectionTitle}>Quotes ({quotes.length})</div>
                                    <div className={styles.quoteList}>
                                        {quotes.map(quote => (
                                            <div key={quote.id} className={styles.quoteCard}>
                                                <div className={styles.quoteHeader}>
                                                    <span className={styles.vendorName}>{quote.vendorName}</span>
                                                    <span className={styles.price}>${quote.amount}</span>
                                                </div>
                                                <p className={styles.timeline}>{quote.estimatedDays} day estimate</p>
                                                <p className={styles.details}>{quote.details}</p>
                                                <button className={styles.acceptBtn}>Accept Quote</button>
                                            </div>
                                        ))}
                                        {quotes.length === 0 && (
                                            <p className={styles.emptyMsg}>Waiting for vendors…</p>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </>
                    ) : (
                        <div className={styles.placeholder}>
                            <svg className={styles.placeholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            <p>Select a job to view details &amp; quotes</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
