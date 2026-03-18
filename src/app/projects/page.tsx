'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Project, ProjectPhase, INDUSTRY_VERTICALS, IndustryVertical } from '@/types';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

export default function ProjectsPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [phasesByProject, setPhasesByProject] = useState<Record<string, ProjectPhase[]>>({});
    const [filterStatus, setFilterStatus] = useState('');
    const [filterIndustry, setFilterIndustry] = useState<IndustryVertical | ''>('');

    useEffect(() => {
        if (!isLoading && !user) router.push('/login');
    }, [user, isLoading, router]);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const projs = await db.getProjects(user.id);
            setProjects(projs);
            const pMap: Record<string, ProjectPhase[]> = {};
            await Promise.all(projs.map(async (p) => {
                pMap[p.id] = await db.getProjectPhases(p.id);
            }));
            setPhasesByProject(pMap);
        };
        load();
    }, [user]);

    const filtered = projects.filter(p => {
        if (filterStatus && p.status !== filterStatus) return false;
        if (filterIndustry && p.industryVertical !== filterIndustry) return false;
        return true;
    });

    const getProgress = (projectId: string) => {
        const phases = phasesByProject[projectId] || [];
        if (phases.length === 0) return 0;
        const completed = phases.filter(p => p.status === 'COMPLETED').length;
        return Math.round((completed / phases.length) * 100);
    };

    const getTotalEstimated = (projectId: string) => {
        const phases = phasesByProject[projectId] || [];
        return phases.reduce((sum, p) => sum + (p.estimatedCost || 0), 0);
    };

    const STATUS_COLORS: Record<string, string> = {
        PLANNING: 'badge badge-blue',
        ACTIVE: 'badge badge-green',
        ON_HOLD: 'badge badge-amber',
        COMPLETED: 'badge badge-green',
        CANCELLED: 'badge badge-muted',
    };

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    return (
        <div className={styles.container}>
            <Navbar />
            <header className={styles.pageHeader}>
                <h2 className="gradient-text">Multi-Phase Projects</h2>
                <Link href="/projects/new" className={styles.newBtn}>+ New Project</Link>
            </header>

            <div className={styles.filterBar}>
                <select
                    className={styles.filterSelect}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
                <select
                    className={styles.filterSelect}
                    value={filterIndustry}
                    onChange={(e) => setFilterIndustry(e.target.value as IndustryVertical | '')}
                >
                    <option value="">All Industries</option>
                    {INDUSTRY_VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>

            <div className={styles.grid}>
                {filtered.map(project => {
                    const phases = phasesByProject[project.id] || [];
                    const progress = getProgress(project.id);
                    const totalEst = getTotalEstimated(project.id);
                    return (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className={`glass-panel ${styles.card}`}
                        >
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>{project.title}</h3>
                                <span className={STATUS_COLORS[project.status] || 'badge badge-muted'}>
                                    {project.status.replace('_', ' ')}
                                </span>
                            </div>
                            <p className={styles.cardIndustry}>{project.industryVertical}</p>
                            {project.location && <p className={styles.cardLocation}>{project.location}</p>}

                            <div className={styles.cardStats}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{phases.length}</span>
                                    <span className={styles.statLabel}>Phases</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{progress}%</span>
                                    <span className={styles.statLabel}>Complete</span>
                                </div>
                                {totalEst > 0 && (
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>${totalEst.toLocaleString()}</span>
                                        <span className={styles.statLabel}>Estimated</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                            </div>

                            <div className={styles.cardDates}>
                                {project.startDate && (
                                    <span>{new Date(project.startDate).toLocaleDateString()}</span>
                                )}
                                {project.startDate && project.endDate && <span>-</span>}
                                {project.endDate && (
                                    <span>{new Date(project.endDate).toLocaleDateString()}</span>
                                )}
                            </div>
                        </Link>
                    );
                })}
                {filtered.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>{projects.length === 0 ? 'No multi-phase projects yet.' : 'No projects match filters.'}</p>
                        <Link href="/projects/new" className={styles.newBtn}>Create Your First Project</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
