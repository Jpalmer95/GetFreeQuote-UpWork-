'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { jobService } from '@/services/jobService';
import { JobCategory } from '@/types';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

export default function PostJob() {
    const router = useRouter();
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    const [formData, setFormData] = useState({
        title: '',
        location: '',
        description: '',
        category: 'Other' as JobCategory,
        isPublic: true,
        requiresPermit: false,
        budget: ''
    });
    const [loading, setLoading] = useState(false);

    const categories: JobCategory[] = ['Plumbing', 'Electrical', 'HVAC', 'Construction', 'Cleaning', 'Web Design', 'Other'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        try {
            await jobService.createJob({
                userId: user.id,
                title: formData.title,
                location: formData.location,
                description: formData.description,
                category: formData.category,
                isPublic: formData.isPublic,
                requiresPermit: formData.requiresPermit,
                budget: formData.budget || undefined, // Send undefined if empty string
                tags: [formData.category]
            });

            router.push('/dashboard?new=true');
        } catch (error) {
            console.error('Error creating job:', error);
            // In a real app, show a toast notification here
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.container}>
            <div className={`glass-panel ${styles.formCard}`}>
                <h1 className="gradient-text">Tell us what you need.</h1>
                <p className={styles.subtext}>Our AI Agents will handle the rest.</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label>Service Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                            className={styles.input}
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Job Title / Summary</label>
                        <input
                            type="text"
                            placeholder="e.g. Fix Leaky Faucet"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Location</label>
                        <input
                            type="text"
                            placeholder="City, Zip, or 'Remote'"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Description</label>
                        <textarea
                            placeholder="Describe the issue, timeline, or special requirements..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className={styles.textarea}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Budget Range (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. $500 - $1000"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.checkboxRow} style={{ marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.requiresPermit}
                                onChange={(e) => setFormData({ ...formData, requiresPermit: e.target.checked })}
                            />
                            <span>Requires Permit?</span>
                        </label>
                    </div>

                    <div className={styles.checkboxRow}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.isPublic}
                                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                            />
                            <span>List on Public Marketplace?</span>
                        </label>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginLeft: '1.8rem' }}>
                            If unchecked, only invited vendors can see this.
                        </p>
                    </div>

                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {loading ? 'Initializing Agents...' : 'Start Search'}
                    </button>
                </form>
            </div>
        </main>
    );
}
