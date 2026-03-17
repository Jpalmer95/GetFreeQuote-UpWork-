'use client';
import { useEffect, useState } from 'react';
import { jobService } from '@/services/jobService';
import { Job, Quote, Message } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

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


    // refresh loop to simulate real-time agent updates
    useEffect(() => {
        if (!user) return;

        const fetchJobs = async () => {
            const myJobs = await jobService.getMyJobs(user.id);
            setJobs([...myJobs]); // clone to trigger render

            if (selectedJob) {
                const updatedQuotes = await jobService.getJobQuotes(selectedJob.id);
                const updatedMessages = await jobService.getJobMessages(selectedJob.id);
                setQuotes([...updatedQuotes]);
                setMessages([...updatedMessages]);
            }
        };

        fetchJobs();
        const interval = setInterval(fetchJobs, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, [selectedJob, user]);

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <header className={styles.header}>
                <h2 className="gradient-text">My Jobs</h2>
                <a href="/post-job" className={styles.newBtn}>+ New Job</a>
            </header>

            <div className={styles.layout}>
                {/* Sidebar List */}
                <aside className={styles.jobList}>
                    {jobs.map(job => (
                        <div
                            key={job.id}
                            className={`${styles.jobCard} ${selectedJob?.id === job.id ? styles.activeJob : ''}`}
                            onClick={() => setSelectedJob(job)}
                        >
                            <h3>{job.title}</h3>
                            <span className={styles.statusBadge}>{job.status}</span>
                            <p className={styles.date}>{new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                    ))}
                    {jobs.length === 0 && <p className={styles.emptyState}>No jobs yet. Post one!</p>}
                </aside>

                {/* Main Content Area */}
                <main className={styles.detailView}>
                    {selectedJob ? (
                        <>
                            <div className={`glass-panel ${styles.detailHeaders}`}>
                                <h2>{selectedJob.title}</h2>
                                <p className={styles.location}>{selectedJob.location}</p>
                                <div className={styles.tags}>
                                    {selectedJob.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                                </div>
                            </div>

                            <div className={styles.splitContent}>
                                {/* Agent Activity / Chat */}
                                <section className={`glass-panel ${styles.section}`}>
                                    <h3>Agent Updates</h3>
                                    <div className={styles.messageLog}>
                                        {messages.map(msg => (
                                            <div key={msg.id} className={`${styles.message} ${msg.senderId === 'system-agent' ? styles.agentMsg : ''}`}>
                                                <strong>{msg.senderId === 'system-agent' ? '🤖 Agent' : 'You'}:</strong>
                                                <p>{msg.content}</p>
                                            </div>
                                        ))}
                                        {messages.length === 0 && <p style={{ opacity: 0.5 }}>No activity yet.</p>}
                                    </div>
                                </section>

                                {/* Quotes List */}
                                <section className={`glass-panel ${styles.section}`}>
                                    <h3>Quotes ({quotes.length})</h3>
                                    <div className={styles.quoteList}>
                                        {quotes.map(quote => (
                                            <div key={quote.id} className={styles.quoteCard}>
                                                <div className={styles.quoteHeader}>
                                                    <span className={styles.vendorName}>{quote.vendorName}</span>
                                                    <span className={styles.price}>${quote.amount}</span>
                                                </div>
                                                <p className={styles.timeline}>{quote.estimatedDays} Days</p>
                                                <p className={styles.details}>{quote.details}</p>
                                                <button className={styles.acceptBtn}>Accept</button>
                                            </div>
                                        ))}
                                        {quotes.length === 0 && <p style={{ opacity: 0.5 }}>Waiting for vendors...</p>}
                                    </div>
                                </section>
                            </div>
                        </>
                    ) : (
                        <div className={styles.placeholder}>
                            <p>Select a job to view details & quotes.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
