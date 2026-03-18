'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES, IndustryVertical, KnownIndustryVertical } from '@/types';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

interface PhaseForm {
    key: string;
    name: string;
    description: string;
    tradeCategory: string;
    startDate: string;
    endDate: string;
    estimatedCost: string;
    dependsOnKeys: string[];
}

export default function NewProjectPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [industry, setIndustry] = useState<IndustryVertical>('Home Services');
    const [totalBudget, setTotalBudget] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [phases, setPhases] = useState<PhaseForm[]>([
        { key: crypto.randomUUID(), name: '', description: '', tradeCategory: '', startDate: '', endDate: '', estimatedCost: '', dependsOnKeys: [] },
    ]);

    const subcats = INDUSTRY_SUBCATEGORIES[industry as KnownIndustryVertical] || ['Other'];

    const addPhase = () => {
        setPhases(prev => [...prev, {
            key: crypto.randomUUID(),
            name: '',
            description: '',
            tradeCategory: '',
            startDate: '',
            endDate: '',
            estimatedCost: '',
            dependsOnKeys: [],
        }]);
    };

    const removePhase = (key: string) => {
        setPhases(prev => {
            const updated = prev.filter(p => p.key !== key);
            return updated.map(p => ({
                ...p,
                dependsOnKeys: p.dependsOnKeys.filter(dk => dk !== key),
            }));
        });
    };

    const updatePhase = (key: string, field: keyof PhaseForm, value: string | string[]) => {
        setPhases(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));
    };

    const movePhase = (index: number, dir: -1 | 1) => {
        const newIdx = index + dir;
        if (newIdx < 0 || newIdx >= phases.length) return;
        setPhases(prev => {
            const arr = [...prev];
            [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
            return arr;
        });
    };

    const canProceed = () => {
        if (step === 1) return title.trim().length > 0 && location.trim().length > 0;
        if (step === 2) return phases.every(p => p.name.trim().length > 0);
        return true;
    };

    const handleSubmit = async () => {
        if (!user || saving) return;
        setSaving(true);
        try {
            const project = await db.createProject({
                userId: user.id,
                title,
                description,
                location,
                industryVertical: industry,
                totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            });

            const createdPhases: { key: string; id: string }[] = [];
            for (let idx = 0; idx < phases.length; idx++) {
                const phase = phases[idx];
                const created = await db.createProjectPhase({
                    projectId: project.id,
                    name: phase.name,
                    description: phase.description,
                    tradeCategory: phase.tradeCategory || 'Other',
                    status: 'NOT_STARTED',
                    sortOrder: idx,
                    dependsOn: [],
                    startDate: phase.startDate || undefined,
                    endDate: phase.endDate || undefined,
                    estimatedCost: phase.estimatedCost ? parseFloat(phase.estimatedCost) : undefined,
                    actualCost: undefined,
                    acceptedQuoteId: undefined,
                });
                createdPhases.push({ key: phase.key, id: created.id });
            }

            const keyToId = new Map(createdPhases.map(cp => [cp.key, cp.id]));
            await Promise.all(phases.map((phase, idx) => {
                const depIds = phase.dependsOnKeys
                    .map(dk => keyToId.get(dk))
                    .filter((id): id is string => !!id);
                if (depIds.length === 0) return Promise.resolve();
                return db.updateProjectPhase(createdPhases[idx].id, { dependsOn: depIds });
            }));

            router.push(`/projects/${project.id}`);
        } catch (err) {
            console.error('Failed to create project:', err);
            setSaving(false);
        }
    };

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.wizardWrapper}>
                <div className={styles.stepIndicator}>
                    {[1, 2, 3].map(s => (
                        <div
                            key={s}
                            className={`${styles.stepDot} ${step >= s ? styles.stepActive : ''}`}
                        >
                            {s}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <div className={`glass-panel ${styles.stepPanel}`}>
                        <h2 className="gradient-text">Project Details</h2>
                        <p className={styles.stepDesc}>Define your multi-phase project</p>

                        <div className={styles.formGrid}>
                            <label className={styles.field}>
                                <span className={styles.label}>Project Title *</span>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Home Renovation 2026"
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.label}>Industry</span>
                                <select
                                    className={styles.input}
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value as IndustryVertical)}
                                >
                                    {INDUSTRY_VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </label>

                            <label className={`${styles.field} ${styles.fullWidth}`}>
                                <span className={styles.label}>Description</span>
                                <textarea
                                    className={styles.textarea}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the overall project scope..."
                                    rows={3}
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.label}>Location *</span>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="City, State"
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.label}>Total Budget</span>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={totalBudget}
                                    onChange={(e) => setTotalBudget(e.target.value)}
                                    placeholder="$0"
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.label}>Target Start</span>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.label}>Target End</span>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </label>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className={`glass-panel ${styles.stepPanel}`}>
                        <h2 className="gradient-text">Project Phases</h2>
                        <p className={styles.stepDesc}>Add trades/sub-jobs in order of execution</p>

                        <div className={styles.phaseList}>
                            {phases.map((phase, idx) => (
                                <div key={phase.key} className={styles.phaseCard}>
                                    <div className={styles.phaseHeader}>
                                        <span className={styles.phaseNum}>Phase {idx + 1}</span>
                                        <div className={styles.phaseActions}>
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => movePhase(idx, -1)}
                                                disabled={idx === 0}
                                                title="Move up"
                                            >
                                                &uarr;
                                            </button>
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => movePhase(idx, 1)}
                                                disabled={idx === phases.length - 1}
                                                title="Move down"
                                            >
                                                &darr;
                                            </button>
                                            {phases.length > 1 && (
                                                <button
                                                    className={styles.removeBtn}
                                                    onClick={() => removePhase(phase.key)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.phaseFields}>
                                        <label className={styles.field}>
                                            <span className={styles.label}>Phase Name *</span>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                value={phase.name}
                                                onChange={(e) => updatePhase(phase.key, 'name', e.target.value)}
                                                placeholder="e.g. Foundation"
                                            />
                                        </label>

                                        <label className={styles.field}>
                                            <span className={styles.label}>Trade Category</span>
                                            <select
                                                className={styles.input}
                                                value={phase.tradeCategory}
                                                onChange={(e) => updatePhase(phase.key, 'tradeCategory', e.target.value)}
                                            >
                                                <option value="">Select...</option>
                                                {subcats.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                            </select>
                                        </label>

                                        <label className={`${styles.field} ${styles.fullWidth}`}>
                                            <span className={styles.label}>Description</span>
                                            <textarea
                                                className={styles.textarea}
                                                value={phase.description}
                                                onChange={(e) => updatePhase(phase.key, 'description', e.target.value)}
                                                placeholder="Scope of work for this phase..."
                                                rows={2}
                                            />
                                        </label>

                                        <label className={styles.field}>
                                            <span className={styles.label}>Start Date</span>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                value={phase.startDate}
                                                onChange={(e) => updatePhase(phase.key, 'startDate', e.target.value)}
                                            />
                                        </label>

                                        <label className={styles.field}>
                                            <span className={styles.label}>End Date</span>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                value={phase.endDate}
                                                onChange={(e) => updatePhase(phase.key, 'endDate', e.target.value)}
                                            />
                                        </label>

                                        <label className={styles.field}>
                                            <span className={styles.label}>Estimated Cost</span>
                                            <input
                                                type="number"
                                                className={styles.input}
                                                value={phase.estimatedCost}
                                                onChange={(e) => updatePhase(phase.key, 'estimatedCost', e.target.value)}
                                                placeholder="$0"
                                            />
                                        </label>

                                        {idx > 0 && (
                                            <label className={`${styles.field} ${styles.fullWidth}`}>
                                                <span className={styles.label}>Depends On</span>
                                                <div className={styles.depList}>
                                                    {phases.slice(0, idx).map(dep => (
                                                        <label key={dep.key} className={styles.depCheck}>
                                                            <input
                                                                type="checkbox"
                                                                checked={phase.dependsOnKeys.includes(dep.key)}
                                                                onChange={(e) => {
                                                                    const newDeps = e.target.checked
                                                                        ? [...phase.dependsOnKeys, dep.key]
                                                                        : phase.dependsOnKeys.filter(d => d !== dep.key);
                                                                    updatePhase(phase.key, 'dependsOnKeys', newDeps);
                                                                }}
                                                            />
                                                            <span>{dep.name || `Phase ${phases.indexOf(dep) + 1}`}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className={styles.addPhaseBtn} onClick={addPhase}>+ Add Phase</button>
                    </div>
                )}

                {step === 3 && (
                    <div className={`glass-panel ${styles.stepPanel}`}>
                        <h2 className="gradient-text">Review & Create</h2>
                        <p className={styles.stepDesc}>Confirm your project details</p>

                        <div className={styles.reviewSection}>
                            <h3 className={styles.reviewTitle}>{title}</h3>
                            <p className={styles.reviewMeta}>{industry} &middot; {location}</p>
                            {description && <p className={styles.reviewDesc}>{description}</p>}
                            <div className={styles.reviewStats}>
                                {totalBudget && <span>Budget: ${parseFloat(totalBudget).toLocaleString()}</span>}
                                {startDate && <span>Start: {new Date(startDate).toLocaleDateString()}</span>}
                                {endDate && <span>End: {new Date(endDate).toLocaleDateString()}</span>}
                            </div>
                        </div>

                        <div className={styles.reviewPhases}>
                            <h4>Phases ({phases.length})</h4>
                            {phases.map((phase, idx) => (
                                <div key={phase.key} className={styles.reviewPhaseCard}>
                                    <span className={styles.reviewPhaseNum}>{idx + 1}</span>
                                    <div>
                                        <div className={styles.reviewPhaseName}>{phase.name || `Phase ${idx + 1}`}</div>
                                        {phase.tradeCategory && <span className={styles.reviewPhaseTrade}>{phase.tradeCategory}</span>}
                                        {phase.estimatedCost && <span className={styles.reviewPhaseCost}>${parseFloat(phase.estimatedCost).toLocaleString()}</span>}
                                        {phase.dependsOnKeys.length > 0 && (
                                            <span className={styles.reviewPhaseDeps}>
                                                Depends on: {phase.dependsOnKeys.map(dk => {
                                                    const dep = phases.find(p => p.key === dk);
                                                    return dep?.name || 'Phase';
                                                }).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.wizardNav}>
                    {step > 1 && (
                        <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
                            Back
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {step < 3 ? (
                        <button
                            className={styles.nextBtn}
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canProceed()}
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            className={styles.nextBtn}
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Creating...' : 'Create Project'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
