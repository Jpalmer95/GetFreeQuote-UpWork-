'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jobService } from '@/services/jobService';
import { JobCategory } from '@/types';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

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
                budget: formData.budget || undefined,
                tags: [formData.category]
            });

            router.push('/dashboard?new=true');
        } catch (error) {
            console.error('Error creating job:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.container}>
            <div className={`glass-panel ${styles.formCard}`}>
                <h1 className="gradient-text">Tell us what you need.</h1>
                <p className={styles.subtext}>Our AI Agents will handle the rest.</p>

                <div className={styles.divider} />

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputRow}>
                        <div className={styles.inputGroup}>
                            <label>Service Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                                className="field-select"
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Budget Range</label>
                            <input
                                type="text"
                                placeholder="e.g. $500 – $1,000"
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                className="field-input"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Job Title / Summary</label>
                        <input
                            type="text"
                            placeholder="e.g. Fix leaky faucet in master bathroom"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="field-input"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Location</label>
                        <input
                            type="text"
                            placeholder="City, ZIP code, or 'Remote'"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            required
                            className="field-input"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Description</label>
                        <textarea
                            placeholder="Describe the issue, timeline, or any special requirements…"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="field-textarea"
                        />
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={formData.requiresPermit}
                                onChange={(e) => setFormData({ ...formData, requiresPermit: e.target.checked })}
                            />
                            <div className={styles.checkboxLabel}>
                                <span className={styles.checkboxTitle}>Permit Required</span>
                                <span className={styles.checkboxHint}>Check if this job will require a building or trade permit.</span>
                            </div>
                        </label>

                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={formData.isPublic}
                                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                            />
                            <div className={styles.checkboxLabel}>
                                <span className={styles.checkboxTitle}>List on Public Marketplace</span>
                                <span className={styles.checkboxHint}>If unchecked, only invited vendors can see this job.</span>
                            </div>
                        </label>
                    </div>

                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {loading ? (
                            <>
                                <span className={styles.spinner} />
                                Initializing Agents…
                            </>
                        ) : (
                            'Start Search'
                        )}
                    </button>
                </form>
            </div>
        </main>
    );
}
