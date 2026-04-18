'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jobService } from '@/services/jobService';
import { IndustryVertical, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES, ProjectUrgency } from '@/types';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import FileUpload from '@/components/FileUpload';
import LocationResolver, { ResolvedLocation } from '@/components/LocationResolver';
import PriceEstimationWidget from '@/components/PriceEstimationWidget';
import ScopeBreakdownDisplay from '@/components/ScopeBreakdownDisplay';
import { PriceEstimate, ScopeBreakdown } from '@/types';
import { parseScope } from '@/services/scopeBreakdown';

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
    const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isLocalRequest, setIsLocalRequest] = useState(false);
    const [localLocation, setLocalLocation] = useState<ResolvedLocation | null>(null);
    const [radiusMiles, setRadiusMiles] = useState(10);
    const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
    const [scopeBreakdown, setScopeBreakdown] = useState<ScopeBreakdown | null>(null);
    const [localLocationError, setLocalLocationError] = useState('');

    const subcategories = (INDUSTRY_SUBCATEGORIES as Record<string, string[]>)[formData.industryVertical] || ['Other'];
    const isCustomIndustry = formData.industryVertical === 'Other';
    const isCustomSubcategory = formData.subcategory === 'Other';

    useEffect(() => {
        setFormData(prev => ({ ...prev, subcategory: subcategories[0], customSubcategory: '' }));
    }, [formData.industryVertical]);

    // Price estimation effect
    useEffect(() => {
        if (formData.description.length > 20 && formData.location.length > 2) {
            const { estimatePrice } = require('@/services/priceEstimation');
            const estimate = estimatePrice({
                category: isCustomIndustry ? formData.customIndustry : formData.industryVertical,
                subcategory: isCustomSubcategory ? formData.customSubcategory : formData.subcategory,
                description: formData.description,
                location: formData.location,
                squareFootage: formData.squareFootage,
                urgency: formData.urgency,
            });
            setPriceEstimate(estimate);

            // Also parse scope
            const scope = parseScope({
                jobId: 'preview',
                description: formData.description,
                category: isCustomIndustry ? formData.customIndustry : formData.industryVertical,
                subcategory: isCustomSubcategory ? formData.customSubcategory : formData.subcategory,
                location: formData.location,
                squareFootage: formData.squareFootage,
            });
            setScopeBreakdown(scope);
        }
    }, [formData.description, formData.location, formData.industryVertical, formData.subcategory, formData.urgency, formData.squareFootage]);

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

        if (isLocalRequest && !localLocation) {
            setLocalLocationError('Please set your location before posting a local request.');
            return;
        }
        setLocalLocationError('');
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
                attachments: attachmentUrls,
                isLocalRequest,
                locationLat: isLocalRequest && localLocation ? localLocation.lat : undefined,
                locationLng: isLocalRequest && localLocation ? localLocation.lng : undefined,
                radiusMiles: isLocalRequest ? radiusMiles : undefined,
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
                                    required
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

                    {isCustomIndustry && (
                        <div className={styles.inputGroup}>
                            <label>Custom Subcategory</label>
                            <input
                                type="text"
                                placeholder="Enter your subcategory..."
                                value={formData.customSubcategory}
                                onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                                required
                                className="field-input"
                            />
                        </div>
                    )}

                    {!isCustomIndustry && isCustomSubcategory && (
                        <div className={styles.inputGroup}>
                            <label>Custom Subcategory</label>
                            <input
                                type="text"
                                placeholder="Enter your subcategory..."
                                value={formData.customSubcategory}
                                onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                                required
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

                    {/* AI Price Estimation */}
                    {priceEstimate && formData.description.length > 20 && (
                        <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
                            <PriceEstimationWidget
                                category={isCustomIndustry ? formData.customIndustry : formData.industryVertical}
                                subcategory={isCustomSubcategory ? formData.customSubcategory : formData.subcategory}
                                description={formData.description}
                                location={formData.location}
                                squareFootage={formData.squareFootage}
                                urgency={formData.urgency}
                                onEstimateReady={setPriceEstimate}
                            />
                        </div>
                    )}

                    {/* Scope Breakdown */}
                    {scopeBreakdown && scopeBreakdown.phases.length > 1 && (
                        <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
                            <ScopeBreakdownDisplay scope={scopeBreakdown} />
                        </div>
                    )}

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

                    {user && <FileUpload
                        bucket="job-attachments"
                        userId={user.id}
                        maxFiles={10}
                        label="Photos & Documents"
                        hint="Upload photos of the job site, blueprints, or reference documents"
                        onUpload={setAttachmentUrls}
                    />}

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

                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={isLocalRequest}
                                onChange={(e) => setIsLocalRequest(e.target.checked)}
                            />
                            <div className={styles.checkboxLabel}>
                                <span className={styles.checkboxTitle}>📍 Make this a Local Request</span>
                                <span className={styles.checkboxHint}>Restrict to vendors near your location — ideal for same-day, urgent, or in-person tasks.</span>
                            </div>
                        </label>
                    </div>

                    {isLocalRequest && (
                        <div className={styles.localSection}>
                            <div className={styles.localHeader}>
                                <span className={styles.localBadge}>Go Local</span>
                                <span className={styles.localDesc}>Set your location and how far away vendors can be</span>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Your Location</label>
                                <LocationResolver value={localLocation} onChange={loc => { setLocalLocation(loc); setLocalLocationError(''); }} />
                                {localLocationError && (
                                    <p style={{ color: 'var(--color-error, #f87171)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                        {localLocationError}
                                    </p>
                                )}
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Search Radius: <strong>{radiusMiles} mi</strong></label>
                                <input
                                    type="range"
                                    min={1}
                                    max={25}
                                    value={radiusMiles}
                                    onChange={e => setRadiusMiles(Number(e.target.value))}
                                    className={styles.radiusSlider}
                                />
                                <div className={styles.radiusLabels}>
                                    <span>1 mi</span><span>25 mi</span>
                                </div>
                            </div>
                        </div>
                    )}

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
