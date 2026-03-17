'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jobService } from '@/services/jobService';
import { IndustryVertical, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES, ProjectUrgency } from '@/types';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

const URGENCY_OPTIONS: { value: ProjectUrgency; label: string }[] = [
    { value: 'flexible', label: 'Flexible Timeline' },
    { value: 'within_month', label: 'Within a Month' },
    { value: 'within_week', label: 'Within a Week' },
    { value: 'urgent', label: 'Urgent / ASAP' },
];

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
        industryVertical: 'Home Services' as IndustryVertical,
        subcategory: '',
        customIndustry: '',
        customSubcategory: '',
        isPublic: true,
        requiresPermit: false,
        budget: '',
        urgency: 'flexible' as ProjectUrgency,
        squareFootage: '',
        materials: '',
        timelineStart: '',
        timelineEnd: '',
        tags: '',
    });
    const [loading, setLoading] = useState(false);

    const subcategories = (INDUSTRY_SUBCATEGORIES as Record<string, string[]>)[formData.industryVertical] || ['Other'];
    const isCustomIndustry = formData.industryVertical === 'Other';
    const isCustomSubcategory = formData.subcategory === 'Other';

    useEffect(() => {
        setFormData(prev => ({ ...prev, subcategory: subcategories[0], customSubcategory: '' }));
    }, [formData.industryVertical]);

    const showPhysicalFields = ['Home Services', 'Commercial Construction', 'Trade Labor'].includes(formData.industryVertical);

    const resolvedIndustry = isCustomIndustry && formData.customIndustry
        ? formData.customIndustry
        : formData.industryVertical;

    const resolvedSubcategory = isCustomSubcategory && formData.customSubcategory
        ? formData.customSubcategory
        : formData.subcategory;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        const tagList = [
            resolvedIndustry,
            resolvedSubcategory,
            ...formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        ];

        try {
            await jobService.createJob({
                userId: user.id,
                title: formData.title,
                location: formData.location,
                description: formData.description,
                category: resolvedSubcategory,
                industryVertical: resolvedIndustry as IndustryVertical,
                subcategory: resolvedSubcategory,
                isPublic: formData.isPublic,
                requiresPermit: formData.requiresPermit,
                budget: formData.budget || undefined,
                urgency: formData.urgency,
                squareFootage: showPhysicalFields ? formData.squareFootage || undefined : undefined,
                materials: showPhysicalFields ? formData.materials || undefined : undefined,
                timelineStart: formData.timelineStart || undefined,
                timelineEnd: formData.timelineEnd || undefined,
                tags: tagList,
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
                <h1 className="gradient-text">What do you need done?</h1>
                <p className={styles.subtext}>Select your industry and describe your project. AI agents handle the rest.</p>

                <div className={styles.divider} />

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputRow}>
                        <div className={styles.inputGroup}>
                            <label>Industry</label>
                            <select
                                value={formData.industryVertical}
                                onChange={(e) => setFormData({ ...formData, industryVertical: e.target.value as IndustryVertical })}
                                className="field-select"
                            >
                                {INDUSTRY_VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>

                        {isCustomIndustry ? (
                            <div className={styles.inputGroup}>
                                <label>Custom Industry</label>
                                <input
                                    type="text"
                                    placeholder="Enter your industry..."
                                    value={formData.customIndustry}
                                    onChange={(e) => setFormData({ ...formData, customIndustry: e.target.value })}
                                    className="field-input"
                                />
                            </div>
                        ) : (
                            <div className={styles.inputGroup}>
                                <label>Subcategory</label>
                                <select
                                    value={formData.subcategory}
                                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                    className="field-select"
                                >
                                    {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {!isCustomIndustry && isCustomSubcategory && (
                        <div className={styles.inputGroup}>
                            <label>Custom Subcategory</label>
                            <input
                                type="text"
                                placeholder="Enter your subcategory..."
                                value={formData.customSubcategory}
                                onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                                className="field-input"
                            />
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>Project Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Kitchen renovation, Website redesign, Corporate event catering"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="field-input"
                        />
                    </div>

                    <div className={styles.inputRow}>
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
                            <label>Budget Range</label>
                            <input
                                type="text"
                                placeholder="e.g. $500 - $5,000"
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                className="field-input"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Description</label>
                        <textarea
                            placeholder="Describe the project scope, requirements, timeline, or any special details vendors should know..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="field-textarea"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Tags (comma-separated, optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. residential, eco-friendly, fast turnaround"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            className="field-input"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Urgency</label>
                        <select
                            value={formData.urgency}
                            onChange={(e) => setFormData({ ...formData, urgency: e.target.value as ProjectUrgency })}
                            className="field-select"
                        >
                            {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className={styles.inputRow}>
                        <div className={styles.inputGroup}>
                            <label>Target Start Date</label>
                            <input
                                type="date"
                                value={formData.timelineStart}
                                onChange={(e) => setFormData({ ...formData, timelineStart: e.target.value })}
                                className="field-input"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Target End Date</label>
                            <input
                                type="date"
                                value={formData.timelineEnd}
                                onChange={(e) => setFormData({ ...formData, timelineEnd: e.target.value })}
                                className="field-input"
                            />
                        </div>
                    </div>

                    {showPhysicalFields && (
                        <div className={styles.inputRow}>
                            <div className={styles.inputGroup}>
                                <label>Square Footage (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1,200 sq ft"
                                    value={formData.squareFootage}
                                    onChange={(e) => setFormData({ ...formData, squareFootage: e.target.value })}
                                    className="field-input"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Materials (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Hardwood, copper piping"
                                    value={formData.materials}
                                    onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                                    className="field-input"
                                />
                            </div>
                        </div>
                    )}

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
                                <span className={styles.checkboxHint}>Check if this project requires a building, trade, or event permit.</span>
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
                                <span className={styles.checkboxHint}>If unchecked, only invited vendors can see this project.</span>
                            </div>
                        </label>
                    </div>

                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {loading ? (
                            <>
                                <span className={styles.spinner} />
                                Initializing AI Agents...
                            </>
                        ) : (
                            'Post Project & Find Vendors'
                        )}
                    </button>
                </form>
            </div>
        </main>
    );
}
