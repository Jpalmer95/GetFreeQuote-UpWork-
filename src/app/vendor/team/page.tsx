'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TeamMember, TeamMemberRole } from '@/types';
import { db } from '@/services/db';
import { hasPermission, VendorRole, getRoleLabel } from '@/services/vendorAuth';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const ROLES: { value: TeamMemberRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Full access to all settings and operations' },
    { value: 'estimator', label: 'Estimator', desc: 'Can create and manage estimates and quotes' },
    { value: 'field_worker', label: 'Field Worker', desc: 'Can view assigned jobs and update status' },
];

export default function TeamManagement() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [vendorProfileId, setVendorProfileId] = useState<string | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [userRole, setUserRole] = useState<VendorRole>('owner');
    const canManage = hasPermission(userRole, 'team.manage');

    const [form, setForm] = useState({
        name: '',
        email: '',
        role: 'field_worker' as TeamMemberRole,
    });

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); return; }
        if (!user) return;
        const load = async () => {
            const result = await db.getVendorProfileByOwnerOrTeam(user.id, user.email || '');
            if (result) {
                setVendorProfileId(result.profile.id);
                setUserRole(result.role);
                const m = await db.getTeamMembers(result.profile.id);
                setMembers(m);
            }
        };
        load();
    }, [user, isLoading, router]);

    const startAdd = () => {
        setForm({ name: '', email: '', role: 'field_worker' });
        setEditingId(null);
        setShowForm(true);
    };

    const startEdit = (m: TeamMember) => {
        setForm({ name: m.name, email: m.email, role: m.role });
        setEditingId(m.id);
        setShowForm(true);
    };

    const cancelForm = () => { setShowForm(false); setEditingId(null); };

    const handleSave = async () => {
        if (!canManage || !vendorProfileId || !form.name.trim() || !form.email.trim()) return;
        setSaving(true);
        try {
            if (editingId) {
                const updated = await db.updateTeamMember(editingId, { name: form.name, role: form.role });
                setMembers(prev => prev.map(m => m.id === editingId ? updated : m));
            } else {
                const created = await db.addTeamMember({
                    vendorProfileId,
                    email: form.email,
                    name: form.name,
                    role: form.role,
                    isActive: true,
                });
                setMembers(prev => [...prev, created]);
            }
            setShowForm(false);
            setEditingId(null);
        } catch (error) {
            console.error('Error saving team member:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (id: string) => {
        try {
            await db.removeTeamMember(id);
            setMembers(prev => prev.filter(m => m.id !== id));
        } catch (error) {
            console.error('Error removing team member:', error);
        }
    };

    const toggleActive = async (member: TeamMember) => {
        try {
            const updated = await db.updateTeamMember(member.id, { isActive: !member.isActive });
            setMembers(prev => prev.map(m => m.id === member.id ? updated : m));
        } catch (error) {
            console.error('Error toggling team member:', error);
        }
    };

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    if (!vendorProfileId) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.noProfile}>
                        <div className={styles.noProfileTitle}>Create your vendor profile first</div>
                        <div className={styles.noProfileDesc}>You need a vendor profile before managing your team.</div>
                        <Link href="/vendor/profile" className={styles.linkBtn}>Create Profile</Link>
                    </div>
                </div>
            </div>
        );
    }

    const roleStyle = (role: TeamMemberRole) =>
        role === 'admin' ? styles.roleAdmin : role === 'estimator' ? styles.roleEstimator : styles.roleFieldWorker;

    return (
        <div className={styles.container}>
            <Navbar />
            <header className={styles.pageHeader}>
                <h2 className="gradient-text">Team Management</h2>
                <Link href="/vendor" className={styles.backLink}>Back to Portal</Link>
            </header>

            <div className={styles.content}>
                <div className={`glass-panel ${styles.card}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <div className={styles.cardTitle}>Team Members</div>
                            <div className={styles.cardDesc}>
                                {canManage ? 'Manage your company\'s team and their roles' : `Viewing as ${getRoleLabel(userRole)}`}
                            </div>
                        </div>
                        {canManage && !showForm && <button className={styles.addBtn} onClick={startAdd}>+ Add Member</button>}
                    </div>

                    {showForm && (
                        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-100)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Name *</label>
                                    <input className={styles.input} value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="John Smith" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email *</label>
                                    <input className={styles.input} type="email" value={form.email}
                                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="john@company.com" disabled={!!editingId} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Role</label>
                                    <select className={styles.select} value={form.role}
                                        onChange={e => setForm(p => ({ ...p, role: e.target.value as TeamMemberRole }))}>
                                        {ROLES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className={styles.btnRow}>
                                <button className={styles.cancelBtn} onClick={cancelForm}>Cancel</button>
                                <button className={styles.saveBtn} onClick={handleSave}
                                    disabled={saving || !form.name.trim() || !form.email.trim()}>
                                    {saving ? 'Saving...' : editingId ? 'Update Member' : 'Add Member'}
                                </button>
                            </div>
                        </div>
                    )}

                    {members.length === 0 ? (
                        <p className={styles.emptyMsg}>No team members yet. Add your first team member to get started.</p>
                    ) : (
                        <div className={styles.memberList}>
                            {members.map(m => (
                                <div key={m.id} className={styles.memberCard}>
                                    <div className={styles.memberInfo}>
                                        <span className={styles.memberName}>{m.name}</span>
                                        <span className={styles.memberEmail}>{m.email}</span>
                                        <div className={styles.memberMeta}>
                                            <span className={`${styles.roleBadge} ${roleStyle(m.role)}`}>{m.role.replace('_', ' ')}</span>
                                            <span className={`${styles.statusBadge} ${m.isActive ? styles.statusActive : m.acceptedAt ? styles.statusInactive : styles.statusPending}`}>
                                                {m.isActive ? 'Active' : m.acceptedAt ? 'Inactive' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <div className={styles.memberActions}>
                                            <button className={styles.editBtn} onClick={() => startEdit(m)}>Edit</button>
                                            <button className={styles.editBtn} onClick={() => toggleActive(m)}>
                                                {m.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button className={styles.removeBtn} onClick={() => handleRemove(m.id)}>Remove</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
