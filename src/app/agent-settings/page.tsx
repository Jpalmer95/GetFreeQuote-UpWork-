'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AgentConfig, AgentRole, EscalationTrigger, INDUSTRY_VERTICALS } from '@/types';
import { db } from '@/services/db';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const ESCALATION_OPTIONS: { value: EscalationTrigger; label: string }[] = [
    { value: 'quote_received', label: 'When a new quote is received' },
    { value: 'scope_change', label: 'When project scope changes' },
    { value: 'budget_exceeded', label: 'When a quote exceeds budget' },
    { value: 'timeline_conflict', label: 'When timeline conflicts arise' },
    { value: 'manual_review', label: 'Always require manual review' },
];

const COMM_STYLES: { value: string; label: string; desc: string }[] = [
    { value: 'professional', label: 'Professional', desc: 'Formal and business-oriented' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and conversational' },
    { value: 'concise', label: 'Concise', desc: 'Brief and to the point' },
];

export default function AgentSettings() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [config, setConfig] = useState({
        role: 'customer' as AgentRole,
        isActive: true,
        autoRespond: true,
        autoQuote: false,
        maxBudget: '',
        minBudget: '',
        industries: [] as string[],
        specialties: '',
        maxDistance: '',
        baseRate: '',
        communicationStyle: 'professional',
        escalationTriggers: ['quote_received', 'scope_change', 'budget_exceeded'] as EscalationTrigger[],
        autoApproveBelow: '',
        workingHoursOnly: false,
    });

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (!user) return;

        const loadConfig = async () => {
            const existing = await db.getAgentConfig(user.id);
            if (existing) {
                setConfig({
                    role: existing.role,
                    isActive: existing.isActive,
                    autoRespond: existing.autoRespond,
                    autoQuote: existing.autoQuote,
                    maxBudget: existing.maxBudget?.toString() || '',
                    minBudget: existing.minBudget?.toString() || '',
                    industries: existing.industries,
                    specialties: existing.specialties.join(', '),
                    maxDistance: existing.maxDistance?.toString() || '',
                    baseRate: existing.baseRate?.toString() || '',
                    communicationStyle: existing.communicationStyle,
                    escalationTriggers: existing.escalationTriggers,
                    autoApproveBelow: existing.autoApproveBelow?.toString() || '',
                    workingHoursOnly: existing.workingHoursOnly,
                });
            }
        };
        loadConfig();
    }, [user, isLoading, router]);

    const toggleIndustry = (industry: string) => {
        setConfig(prev => ({
            ...prev,
            industries: prev.industries.includes(industry)
                ? prev.industries.filter(i => i !== industry)
                : [...prev.industries, industry],
        }));
    };

    const toggleEscalation = (trigger: EscalationTrigger) => {
        setConfig(prev => ({
            ...prev,
            escalationTriggers: prev.escalationTriggers.includes(trigger)
                ? prev.escalationTriggers.filter(t => t !== trigger)
                : [...prev.escalationTriggers, trigger],
        }));
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setSaved(false);

        try {
            await db.upsertAgentConfig({
                userId: user.id,
                role: config.role,
                isActive: config.isActive,
                autoRespond: config.autoRespond,
                autoQuote: config.autoQuote,
                maxBudget: config.maxBudget ? parseFloat(config.maxBudget) : undefined,
                minBudget: config.minBudget ? parseFloat(config.minBudget) : undefined,
                industries: config.industries,
                specialties: config.specialties.split(',').map(s => s.trim()).filter(Boolean),
                maxDistance: config.maxDistance ? parseInt(config.maxDistance) : undefined,
                baseRate: config.baseRate ? parseFloat(config.baseRate) : undefined,
                communicationStyle: config.communicationStyle as 'professional' | 'friendly' | 'concise',
                escalationTriggers: config.escalationTriggers,
                autoApproveBelow: config.autoApproveBelow ? parseFloat(config.autoApproveBelow) : undefined,
                workingHoursOnly: config.workingHoursOnly,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error saving agent config:', error);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <header className={styles.pageHeader}>
                <h2 className="gradient-text">AI Agent Settings</h2>
                <a href="/dashboard" className={styles.backLink}>Back to Dashboard</a>
            </header>

            <div className={styles.content}>
                <div className={styles.statusBar}>
                    <div className={`${styles.statusDot} ${config.isActive ? styles.statusActive : styles.statusInactive}`} />
                    <div>
                        <div className={styles.statusText}>
                            Agent is {config.isActive ? 'Active' : 'Paused'}
                        </div>
                        <div className={styles.statusHint}>
                            {config.isActive
                                ? 'Your agent is monitoring projects and responding to opportunities'
                                : 'Your agent is paused and will not take any automated actions'}
                        </div>
                    </div>
                    <button
                        className={`${styles.toggle} ${config.isActive ? styles.toggleActive : ''}`}
                        onClick={() => setConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
                    />
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Agent Role</div>
                    <div className={styles.cardDesc}>Choose how your agent operates on the platform</div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingLabel}>
                            <span className={styles.settingName}>Operating Mode</span>
                            <span className={styles.settingHint}>Customer agents find vendors; Vendor agents respond to projects</span>
                        </div>
                        <select
                            className={styles.select}
                            value={config.role}
                            onChange={(e) => setConfig(prev => ({ ...prev, role: e.target.value as AgentRole }))}
                        >
                            <option value="customer">Customer Agent</option>
                            <option value="vendor">Vendor Agent</option>
                        </select>
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Communication</div>
                    <div className={styles.cardDesc}>How your agent communicates with other agents and users</div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingLabel}>
                            <span className={styles.settingName}>Communication Style</span>
                        </div>
                        <select
                            className={styles.select}
                            value={config.communicationStyle}
                            onChange={(e) => setConfig(prev => ({ ...prev, communicationStyle: e.target.value }))}
                        >
                            {COMM_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingLabel}>
                            <span className={styles.settingName}>Auto-Respond</span>
                            <span className={styles.settingHint}>Agent automatically replies to inquiries and clarifications</span>
                        </div>
                        <button
                            className={`${styles.toggle} ${config.autoRespond ? styles.toggleActive : ''}`}
                            onClick={() => setConfig(prev => ({ ...prev, autoRespond: !prev.autoRespond }))}
                        />
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingLabel}>
                            <span className={styles.settingName}>Working Hours Only</span>
                            <span className={styles.settingHint}>Only respond during 9 AM - 6 PM local time</span>
                        </div>
                        <button
                            className={`${styles.toggle} ${config.workingHoursOnly ? styles.toggleActive : ''}`}
                            onClick={() => setConfig(prev => ({ ...prev, workingHoursOnly: !prev.workingHoursOnly }))}
                        />
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Industry Focus</div>
                    <div className={styles.cardDesc}>Select industries your agent should monitor (empty = all)</div>
                    <div className={styles.pillGroup}>
                        {INDUSTRY_VERTICALS.map(v => (
                            <button
                                key={v}
                                className={`${styles.pill} ${config.industries.includes(v) ? styles.pillActive : ''}`}
                                onClick={() => toggleIndustry(v)}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {config.role === 'vendor' && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Vendor Settings</div>
                        <div className={styles.cardDesc}>Configure automated quoting and pricing</div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Auto-Quote</span>
                                <span className={styles.settingHint}>Automatically generate and submit quotes for matching projects</span>
                            </div>
                            <button
                                className={`${styles.toggle} ${config.autoQuote ? styles.toggleActive : ''}`}
                                onClick={() => setConfig(prev => ({ ...prev, autoQuote: !prev.autoQuote }))}
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Base Hourly Rate ($)</span>
                                <span className={styles.settingHint}>Used to calculate automated quotes</span>
                            </div>
                            <input
                                type="number"
                                className={styles.input}
                                value={config.baseRate}
                                onChange={(e) => setConfig(prev => ({ ...prev, baseRate: e.target.value }))}
                                placeholder="100"
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Specialties</span>
                                <span className={styles.settingHint}>Comma-separated list of your specialties</span>
                            </div>
                            <input
                                type="text"
                                className={styles.input}
                                value={config.specialties}
                                onChange={(e) => setConfig(prev => ({ ...prev, specialties: e.target.value }))}
                                placeholder="Plumbing, HVAC"
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Max Distance (miles)</span>
                            </div>
                            <input
                                type="number"
                                className={styles.input}
                                value={config.maxDistance}
                                onChange={(e) => setConfig(prev => ({ ...prev, maxDistance: e.target.value }))}
                                placeholder="25"
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Minimum Job Value ($)</span>
                                <span className={styles.settingHint}>Skip projects below this amount</span>
                            </div>
                            <input
                                type="number"
                                className={styles.input}
                                value={config.minBudget}
                                onChange={(e) => setConfig(prev => ({ ...prev, minBudget: e.target.value }))}
                                placeholder="50"
                            />
                        </div>
                    </div>
                )}

                {config.role === 'customer' && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Budget Controls</div>
                        <div className={styles.cardDesc}>Set limits for your agent's automated decisions</div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Max Budget ($)</span>
                                <span className={styles.settingHint}>Reject quotes above this amount</span>
                            </div>
                            <input
                                type="number"
                                className={styles.input}
                                value={config.maxBudget}
                                onChange={(e) => setConfig(prev => ({ ...prev, maxBudget: e.target.value }))}
                                placeholder="5000"
                            />
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingLabel}>
                                <span className={styles.settingName}>Auto-Approve Below ($)</span>
                                <span className={styles.settingHint}>Automatically accept quotes below this amount</span>
                            </div>
                            <input
                                type="number"
                                className={styles.input}
                                value={config.autoApproveBelow}
                                onChange={(e) => setConfig(prev => ({ ...prev, autoApproveBelow: e.target.value }))}
                                placeholder="200"
                            />
                        </div>
                    </div>
                )}

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Escalation Rules</div>
                    <div className={styles.cardDesc}>When should your agent pause and ask for your input?</div>
                    <div className={styles.escalationGrid}>
                        {ESCALATION_OPTIONS.map(opt => (
                            <label key={opt.value} className={styles.checkboxRow}>
                                <input
                                    type="checkbox"
                                    checked={config.escalationTriggers.includes(opt.value)}
                                    onChange={() => toggleEscalation(opt.value)}
                                />
                                <span className={styles.checkboxRowLabel}>{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className={styles.saveBar}>
                    {saved && <span className={styles.savedMsg}>Settings saved</span>}
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}
