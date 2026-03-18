'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/db';
import { Project, ProjectPhase, PhaseStatus } from '@/types';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

type ViewTab = 'gantt' | 'phases' | 'budget';

const STATUS_COLORS: Record<PhaseStatus, string> = {
    NOT_STARTED: '#6b7280',
    WAITING_QUOTES: '#3b82f6',
    QUOTED: '#8b5cf6',
    IN_PROGRESS: '#f59e0b',
    COMPLETED: '#22c55e',
    BLOCKED: '#ef4444',
};

const STATUS_LABELS: Record<PhaseStatus, string> = {
    NOT_STARTED: 'Not Started',
    WAITING_QUOTES: 'Waiting Quotes',
    QUOTED: 'Quoted',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    BLOCKED: 'Blocked',
};

const PROJECT_STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [project, setProject] = useState<Project | null>(null);
    const [phases, setPhases] = useState<ProjectPhase[]>([]);
    const [activeTab, setActiveTab] = useState<ViewTab>('gantt');
    const [loading, setLoading] = useState(true);
    const [editingPhase, setEditingPhase] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!id) return;
        const proj = await db.getProject(id);
        if (!proj) { router.push('/projects'); return; }
        setProject(proj);
        const ph = await db.getProjectPhases(id);
        setPhases(ph);
        setLoading(false);
    }, [id, router]);

    useEffect(() => {
        if (!isLoading && !user) router.push('/login');
    }, [user, isLoading, router]);

    useEffect(() => {
        if (user) loadData();
    }, [user, loadData]);

    const updatePhaseStatus = async (phaseId: string, status: PhaseStatus) => {
        try {
            await db.updateProjectPhase(phaseId, { status });
            setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status } : p));
        } catch (err) {
            console.error('Failed to update phase status:', err);
            loadData();
        }
    };

    const updateProjectStatus = async (status: Project['status']) => {
        if (!project) return;
        try {
            await db.updateProject(project.id, { status });
            setProject(prev => prev ? { ...prev, status } : prev);
        } catch (err) {
            console.error('Failed to update project status:', err);
            loadData();
        }
    };

    const deletePhase = async (phaseId: string) => {
        try {
            await db.deleteProjectPhase(phaseId);
            setPhases(prev => prev.filter(p => p.id !== phaseId));
        } catch (err) {
            console.error('Failed to delete phase:', err);
            loadData();
        }
    };

    const movePhaseOrder = async (phaseId: string, dir: -1 | 1) => {
        const idx = phases.findIndex(p => p.id === phaseId);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= phases.length) return;

        const updated = [...phases];
        [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
        updated.forEach((p, i) => { p.sortOrder = i; });
        setPhases(updated);

        try {
            await Promise.all([
                db.updateProjectPhase(updated[idx].id, { sortOrder: idx }),
                db.updateProjectPhase(updated[newIdx].id, { sortOrder: newIdx }),
            ]);
        } catch (err) {
            console.error('Failed to reorder phases:', err);
            loadData();
        }
    };

    const progress = useMemo(() => {
        if (phases.length === 0) return 0;
        return Math.round((phases.filter(p => p.status === 'COMPLETED').length / phases.length) * 100);
    }, [phases]);

    const totalEstimated = useMemo(() =>
        phases.reduce((sum, p) => sum + (p.estimatedCost || 0), 0)
    , [phases]);

    const totalActual = useMemo(() =>
        phases.reduce((sum, p) => sum + (p.actualCost || 0), 0)
    , [phases]);

    const conflicts = useMemo(() => {
        const issues: string[] = [];
        phases.forEach(phase => {
            if (phase.dependsOn.length > 0) {
                phase.dependsOn.forEach(depId => {
                    const dep = phases.find(p => p.id === depId);
                    if (dep && dep.status !== 'COMPLETED' && phase.status === 'IN_PROGRESS') {
                        issues.push(`"${phase.name}" started before dependency "${dep.name}" completed`);
                    }
                    if (dep && phase.startDate && dep.endDate && new Date(phase.startDate) < new Date(dep.endDate)) {
                        issues.push(`"${phase.name}" overlaps with dependency "${dep.name}"`);
                    }
                });
            }
            if (phase.startDate && phase.endDate && new Date(phase.startDate) > new Date(phase.endDate)) {
                issues.push(`"${phase.name}" has start date after end date`);
            }
        });
        return issues;
    }, [phases]);

    const ganttRange = useMemo(() => {
        const dates = phases.flatMap(p => [p.startDate, p.endDate].filter(Boolean) as string[]);
        if (project?.startDate) dates.push(project.startDate);
        if (project?.endDate) dates.push(project.endDate);
        if (dates.length === 0) {
            const now = new Date();
            return {
                start: now,
                end: new Date(now.getTime() + 90 * 86400000),
                totalDays: 90,
            };
        }
        const sorted = dates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
        const start = sorted[0];
        const end = sorted[sorted.length - 1];
        const totalDays = Math.max(Math.ceil((end.getTime() - start.getTime()) / 86400000), 14);
        return { start, end, totalDays };
    }, [phases, project]);

    if (isLoading || !user || loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    if (!project) {
        return <div className="loading-screen">Project not found</div>;
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <header className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <Link href="/projects" className={styles.backLink}>&larr; Projects</Link>
                    <h2 className="gradient-text">{project.title}</h2>
                    <div className={styles.headerMeta}>
                        <span className={styles.industryBadge}>{project.industryVertical}</span>
                        {project.location && <span className={styles.locationText}>{project.location}</span>}
                        <select
                            className={styles.statusSelect}
                            value={project.status}
                            onChange={(e) => updateProjectStatus(e.target.value as Project['status'])}
                        >
                            {PROJECT_STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.overviewStat}>
                        <span className={styles.overviewValue}>{progress}%</span>
                        <span className={styles.overviewLabel}>Complete</span>
                    </div>
                    <div className={styles.overviewStat}>
                        <span className={styles.overviewValue}>{phases.length}</span>
                        <span className={styles.overviewLabel}>Phases</span>
                    </div>
                    {totalEstimated > 0 && (
                        <div className={styles.overviewStat}>
                            <span className={styles.overviewValue}>${totalEstimated.toLocaleString()}</span>
                            <span className={styles.overviewLabel}>Estimated</span>
                        </div>
                    )}
                </div>
            </header>

            <div className={styles.progressBarWrap}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>

            {conflicts.length > 0 && (
                <div className={styles.conflictBanner}>
                    <strong>Scheduling Conflicts:</strong>
                    <ul>
                        {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                </div>
            )}

            <div className={styles.tabBar}>
                <button className={`${styles.tabBtn} ${activeTab === 'gantt' ? styles.tabActive : ''}`} onClick={() => setActiveTab('gantt')}>
                    Timeline
                </button>
                <button className={`${styles.tabBtn} ${activeTab === 'phases' ? styles.tabActive : ''}`} onClick={() => setActiveTab('phases')}>
                    Phases ({phases.length})
                </button>
                <button className={`${styles.tabBtn} ${activeTab === 'budget' ? styles.tabActive : ''}`} onClick={() => setActiveTab('budget')}>
                    Budget
                </button>
            </div>

            <main className={styles.mainContent}>
                {activeTab === 'gantt' && (
                    <div className={`glass-panel ${styles.ganttContainer}`}>
                        <div className={styles.ganttHeader}>
                            <div className={styles.ganttLabelCol}>Phase</div>
                            <div className={styles.ganttTimelineCol}>
                                <div className={styles.ganttMonths}>
                                    {(() => {
                                        const months: { label: string; width: number }[] = [];
                                        const cur = new Date(ganttRange.start);
                                        while (cur <= ganttRange.end) {
                                            const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
                                            const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
                                            const clampStart = monthStart < ganttRange.start ? ganttRange.start : monthStart;
                                            const clampEnd = monthEnd > ganttRange.end ? ganttRange.end : monthEnd;
                                            const days = Math.ceil((clampEnd.getTime() - clampStart.getTime()) / 86400000) + 1;
                                            const width = (days / ganttRange.totalDays) * 100;
                                            months.push({
                                                label: cur.toLocaleString('default', { month: 'short', year: '2-digit' }),
                                                width,
                                            });
                                            cur.setMonth(cur.getMonth() + 1);
                                            cur.setDate(1);
                                        }
                                        return months.map((m, i) => (
                                            <div key={i} className={styles.ganttMonth} style={{ width: `${m.width}%` }}>
                                                {m.label}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>

                        {phases.map(phase => {
                            const hasRange = phase.startDate && phase.endDate;
                            let left = 0;
                            let width = 10;

                            if (hasRange) {
                                const ps = new Date(phase.startDate!).getTime();
                                const pe = new Date(phase.endDate!).getTime();
                                const gs = ganttRange.start.getTime();
                                left = ((ps - gs) / (ganttRange.totalDays * 86400000)) * 100;
                                width = Math.max(((pe - ps) / (ganttRange.totalDays * 86400000)) * 100, 2);
                            }

                            return (
                                <div key={phase.id} className={styles.ganttRow}>
                                    <div className={styles.ganttLabelCol}>
                                        <span className={styles.ganttPhaseName}>{phase.name}</span>
                                        <span
                                            className={styles.ganttPhaseStatus}
                                            style={{ color: STATUS_COLORS[phase.status] }}
                                        >
                                            {STATUS_LABELS[phase.status]}
                                        </span>
                                    </div>
                                    <div className={styles.ganttTimelineCol}>
                                        <div className={styles.ganttTrack}>
                                            {hasRange && (
                                                <div
                                                    className={styles.ganttBar}
                                                    style={{
                                                        left: `${Math.max(0, left)}%`,
                                                        width: `${width}%`,
                                                        background: STATUS_COLORS[phase.status],
                                                    }}
                                                    title={`${phase.startDate} - ${phase.endDate}`}
                                                >
                                                    <span className={styles.ganttBarLabel}>{phase.name}</span>
                                                </div>
                                            )}
                                            {!hasRange && (
                                                <div className={styles.ganttNoDate}>No dates set</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {phases.length === 0 && (
                            <div className={styles.emptyMsg}>No phases yet. Add phases to see the timeline.</div>
                        )}

                        <div className={styles.ganttLegend}>
                            {(Object.keys(STATUS_COLORS) as PhaseStatus[]).map(s => (
                                <div key={s} className={styles.legendItem}>
                                    <span className={styles.legendDot} style={{ background: STATUS_COLORS[s] }} />
                                    <span>{STATUS_LABELS[s]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'phases' && (
                    <div className={styles.phaseListView}>
                        {phases.map((phase, idx) => (
                            <div key={phase.id} className={`glass-panel ${styles.phaseCard}`}>
                                <div className={styles.phaseCardHeader}>
                                    <div className={styles.phaseNumBadge}>{idx + 1}</div>
                                    <div className={styles.phaseInfo}>
                                        <h3 className={styles.phaseCardName}>{phase.name}</h3>
                                        {phase.tradeCategory && (
                                            <span className={styles.phaseTrade}>{phase.tradeCategory}</span>
                                        )}
                                    </div>
                                    <div className={styles.phaseCardActions}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => movePhaseOrder(phase.id, -1)}
                                            disabled={idx === 0}
                                        >
                                            &uarr;
                                        </button>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => movePhaseOrder(phase.id, 1)}
                                            disabled={idx === phases.length - 1}
                                        >
                                            &darr;
                                        </button>
                                        <select
                                            className={styles.statusSelectSmall}
                                            value={phase.status}
                                            onChange={(e) => updatePhaseStatus(phase.id, e.target.value as PhaseStatus)}
                                        >
                                            {(Object.keys(STATUS_LABELS) as PhaseStatus[]).map(s => (
                                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                            ))}
                                        </select>
                                        <button
                                            className={styles.editBtn}
                                            onClick={() => setEditingPhase(editingPhase === phase.id ? null : phase.id)}
                                        >
                                            {editingPhase === phase.id ? 'Close' : 'Edit'}
                                        </button>
                                        <button className={styles.deleteBtn} onClick={() => deletePhase(phase.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {phase.description && (
                                    <p className={styles.phaseDesc}>{phase.description}</p>
                                )}

                                <div className={styles.phaseMetaRow}>
                                    {phase.startDate && (
                                        <span className={styles.phaseDateTag}>
                                            Start: {new Date(phase.startDate).toLocaleDateString()}
                                        </span>
                                    )}
                                    {phase.endDate && (
                                        <span className={styles.phaseDateTag}>
                                            End: {new Date(phase.endDate).toLocaleDateString()}
                                        </span>
                                    )}
                                    {phase.estimatedCost !== undefined && (
                                        <span className={styles.phaseCostTag}>
                                            Est: ${phase.estimatedCost.toLocaleString()}
                                        </span>
                                    )}
                                    {phase.actualCost !== undefined && phase.actualCost > 0 && (
                                        <span className={styles.phaseCostTag}>
                                            Actual: ${phase.actualCost.toLocaleString()}
                                        </span>
                                    )}
                                </div>

                                {phase.dependsOn.length > 0 && (
                                    <div className={styles.phaseDeps}>
                                        Depends on: {phase.dependsOn.map(depId => {
                                            const dep = phases.find(p => p.id === depId);
                                            return dep?.name || 'Unknown';
                                        }).join(', ')}
                                    </div>
                                )}

                                {editingPhase === phase.id && (
                                    <PhaseEditor
                                        phase={phase}
                                        onSave={async (updates) => {
                                            await db.updateProjectPhase(phase.id, updates);
                                            await loadData();
                                            setEditingPhase(null);
                                        }}
                                        onCancel={() => setEditingPhase(null)}
                                    />
                                )}
                            </div>
                        ))}

                        <AddPhaseInline
                            projectId={project.id}
                            sortOrder={phases.length}
                            onAdded={loadData}
                        />
                    </div>
                )}

                {activeTab === 'budget' && (
                    <div className={`glass-panel ${styles.budgetView}`}>
                        <div className={styles.budgetSummary}>
                            <div className={styles.budgetCard}>
                                <span className={styles.budgetCardLabel}>Total Budget</span>
                                <span className={styles.budgetCardValue}>
                                    {project.totalBudget ? `$${project.totalBudget.toLocaleString()}` : 'Not set'}
                                </span>
                            </div>
                            <div className={styles.budgetCard}>
                                <span className={styles.budgetCardLabel}>Total Estimated</span>
                                <span className={styles.budgetCardValue}>${totalEstimated.toLocaleString()}</span>
                            </div>
                            <div className={styles.budgetCard}>
                                <span className={styles.budgetCardLabel}>Total Actual</span>
                                <span className={styles.budgetCardValue}>${totalActual.toLocaleString()}</span>
                            </div>
                            {project.totalBudget && totalEstimated > 0 && (
                                <div className={styles.budgetCard}>
                                    <span className={styles.budgetCardLabel}>Variance</span>
                                    <span className={`${styles.budgetCardValue} ${totalEstimated > project.totalBudget ? styles.overBudget : styles.underBudget}`}>
                                        {totalEstimated > project.totalBudget ? '+' : '-'}
                                        ${Math.abs(totalEstimated - project.totalBudget).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <table className={styles.budgetTable}>
                            <thead>
                                <tr>
                                    <th>Phase</th>
                                    <th>Status</th>
                                    <th>Estimated</th>
                                    <th>Actual</th>
                                    <th>Variance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {phases.map(phase => {
                                    const est = phase.estimatedCost || 0;
                                    const act = phase.actualCost || 0;
                                    const variance = act - est;
                                    return (
                                        <tr key={phase.id}>
                                            <td>
                                                <div className={styles.budgetPhaseName}>{phase.name}</div>
                                                {phase.tradeCategory && (
                                                    <div className={styles.budgetPhaseTrade}>{phase.tradeCategory}</div>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className={styles.budgetStatusDot}
                                                    style={{ background: STATUS_COLORS[phase.status] }}
                                                />
                                                {STATUS_LABELS[phase.status]}
                                            </td>
                                            <td>{est > 0 ? `$${est.toLocaleString()}` : '-'}</td>
                                            <td>{act > 0 ? `$${act.toLocaleString()}` : '-'}</td>
                                            <td className={variance > 0 ? styles.overBudget : variance < 0 ? styles.underBudget : ''}>
                                                {est > 0 || act > 0 ? `${variance > 0 ? '+' : ''}$${variance.toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}

function PhaseEditor({ phase, onSave, onCancel }: {
    phase: ProjectPhase;
    onSave: (updates: Partial<ProjectPhase>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(phase.name);
    const [desc, setDesc] = useState(phase.description);
    const [trade, setTrade] = useState(phase.tradeCategory);
    const [start, setStart] = useState(phase.startDate || '');
    const [end, setEnd] = useState(phase.endDate || '');
    const [estCost, setEstCost] = useState(phase.estimatedCost?.toString() || '');
    const [actCost, setActCost] = useState(phase.actualCost?.toString() || '');

    return (
        <div className={styles.phaseEditor}>
            <div className={styles.editorGrid}>
                <label className={styles.editorField}>
                    <span>Name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className={styles.editorField}>
                    <span>Trade</span>
                    <input type="text" value={trade} onChange={(e) => setTrade(e.target.value)} />
                </label>
                <label className={`${styles.editorField} ${styles.editorFullWidth}`}>
                    <span>Description</span>
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
                </label>
                <label className={styles.editorField}>
                    <span>Start Date</span>
                    <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label className={styles.editorField}>
                    <span>End Date</span>
                    <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
                <label className={styles.editorField}>
                    <span>Estimated Cost</span>
                    <input type="number" value={estCost} onChange={(e) => setEstCost(e.target.value)} />
                </label>
                <label className={styles.editorField}>
                    <span>Actual Cost</span>
                    <input type="number" value={actCost} onChange={(e) => setActCost(e.target.value)} />
                </label>
            </div>
            <div className={styles.editorActions}>
                <button className={styles.saveBtn} onClick={() => onSave({
                    name, description: desc, tradeCategory: trade,
                    startDate: start || undefined, endDate: end || undefined,
                    estimatedCost: estCost ? parseFloat(estCost) : undefined,
                    actualCost: actCost ? parseFloat(actCost) : undefined,
                })}>
                    Save Changes
                </button>
                <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

function AddPhaseInline({ projectId, sortOrder, onAdded }: {
    projectId: string;
    sortOrder: number;
    onAdded: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [trade, setTrade] = useState('');
    const [saving, setSaving] = useState(false);

    const handleAdd = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        try {
            await db.createProjectPhase({
                projectId,
                name,
                description: desc,
                tradeCategory: trade || 'Other',
                status: 'NOT_STARTED',
                sortOrder,
                dependsOn: [],
                startDate: undefined,
                endDate: undefined,
                estimatedCost: undefined,
                actualCost: undefined,
                acceptedQuoteId: undefined,
            });
            setName('');
            setDesc('');
            setTrade('');
            setOpen(false);
            onAdded();
        } catch (err) {
            console.error('Failed to add phase:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <button className={styles.addPhaseBtn} onClick={() => setOpen(true)}>
                + Add Phase
            </button>
        );
    }

    return (
        <div className={`glass-panel ${styles.phaseCard}`}>
            <div className={styles.editorGrid}>
                <label className={styles.editorField}>
                    <span>Phase Name *</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electrical" />
                </label>
                <label className={styles.editorField}>
                    <span>Trade Category</span>
                    <input type="text" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Electrical Systems" />
                </label>
                <label className={`${styles.editorField} ${styles.editorFullWidth}`}>
                    <span>Description</span>
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Scope of work..." />
                </label>
            </div>
            <div className={styles.editorActions}>
                <button className={styles.saveBtn} onClick={handleAdd} disabled={saving || !name.trim()}>
                    {saving ? 'Adding...' : 'Add Phase'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setOpen(false)}>Cancel</button>
            </div>
        </div>
    );
}
