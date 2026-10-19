'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';
import type { WorkKind } from '@/types';

type Role = 'customer' | 'vendor' | 'both';
type Step = 'role' | 'project';

const OWNER_PROMPT = `Post this on GetFreeQuote for me using MCP POST https://getfreequote.org/api/mcp with my bfk_ key (mint at /settings/api-keys).

tools/call post_job
{
  "title": "[short title]",
  "description": "[what I need, materials, constraints]",
  "location": "[city / ZIP / Remote]",
  "urgency": "flexible",
  "workKind": "quote",
  "budget": "[optional]"
}

workKind is quote (compare bids), bounty (fixed price), or local (nearby same-day).`;

function OnboardingInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<Step>('role');
    const [role, setRole] = useState<Role | null>(null);
    const [location, setLocation] = useState('');
    const [hasProject, setHasProject] = useState<boolean | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [workKind, setWorkKind] = useState<WorkKind>('quote');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login?mode=signup&redirect=/onboarding');
        }
    }, [user, isLoading, router]);

    const persist = async (nextRole: Role) => {
        localStorage.setItem('gfq_onboarding', JSON.stringify({ role: nextRole, location, done: true }));
        if (!user) return;
        const mapped = nextRole === 'vendor' ? 'VENDOR' : 'USER';
        await supabase.from('profiles').update({ role: mapped }).eq('id', user.id);
    };

    const finishVendor = async () => {
        if (!role) return;
        setSaving(true);
        await persist(role);
        setSaving(false);
        router.push('/vendor/profile');
    };

    const skipToDesk = async () => {
        if (!role) return;
        setSaving(true);
        await persist(role);
        setSaving(false);
        router.push('/dashboard');
    };

    const postNow = async () => {
        if (!user || !title.trim() || !description.trim()) return;
        setSaving(true);
        await persist(role || 'customer');
        const qs = new URLSearchParams({
            title: title.trim(),
            description: description.trim(),
            kind: workKind,
        });
        if (location.trim()) qs.set('location', location.trim());
        router.push(`/post-job?${qs.toString()}`);
    };

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.progress} aria-hidden>
                        <span className={styles.dotOn} />
                        <span className={step === 'project' ? styles.dotOn : styles.dot} />
                    </div>

                    {step === 'role' && (
                        <>
                            <p className={styles.kicker}>60-second setup</p>
                            <h1>How will you use GetFreeQuote?</h1>
                            <p className={styles.sub}>You can always do both later.</p>
                            <div className={styles.choices}>
                                {([
                                    { value: 'customer' as Role, label: 'I need work done', desc: 'Post a job, bounty, or nearby request — you or your agent.' },
                                    { value: 'vendor' as Role, label: 'I want to find work', desc: 'Bid on jobs, claim bounties, or take nearby gigs.' },
                                    { value: 'both' as Role, label: 'Both', desc: 'Hire and bid from the same account.' },
                                ]).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`${styles.choice} ${role === opt.value ? styles.choiceOn : ''}`}
                                        onClick={() => setRole(opt.value)}
                                    >
                                        <strong>{opt.label}</strong>
                                        <span>{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                            <label className={styles.label}>
                                City or ZIP (optional)
                                <input
                                    className="field-input"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Cottonwood Shores, TX"
                                />
                            </label>
                            <button
                                className="btn-primary"
                                disabled={!role || saving}
                                onClick={() => {
                                    if (role === 'vendor') finishVendor();
                                    else setStep('project');
                                }}
                            >
                                Continue
                            </button>
                        </>
                    )}

                    {step === 'project' && (
                        <>
                            <p className={styles.kicker}>Already have something in mind?</p>
                            <h1>Post it now, or tell your agent.</h1>
                            <div className={styles.choices}>
                                <button
                                    type="button"
                                    className={`${styles.choice} ${hasProject === true ? styles.choiceOn : ''}`}
                                    onClick={() => setHasProject(true)}
                                >
                                    <strong>I have a project — post it here</strong>
                                    <span>Title + a few sentences. Industry details can wait.</span>
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.choice} ${hasProject === false ? styles.choiceOn : ''}`}
                                    onClick={() => setHasProject(false)}
                                >
                                    <strong>I&apos;ll have my agent post it</strong>
                                    <span>Copy a prompt. Needs a bfk_ key from Settings → API Keys.</span>
                                </button>
                            </div>

                            {hasProject === true && (
                                <div className={styles.form}>
                                    <label className={styles.label}>
                                        Title
                                        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fence repair, popped tire, logo redraw…" />
                                    </label>
                                    <label className={styles.label}>
                                        What do you need?
                                        <textarea className="field-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                                    </label>
                                    <div className={styles.kindRow}>
                                        {([
                                            { id: 'quote' as WorkKind, label: 'Get quotes' },
                                            { id: 'bounty' as WorkKind, label: 'Fixed bounty' },
                                            { id: 'local' as WorkKind, label: 'Nearby / same-day' },
                                        ]).map((k) => (
                                            <button
                                                key={k.id}
                                                type="button"
                                                className={`${styles.kind} ${workKind === k.id ? styles.kindOn : ''}`}
                                                onClick={() => setWorkKind(k.id)}
                                            >
                                                {k.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="btn-primary" disabled={saving || !title.trim() || !description.trim()} onClick={postNow}>
                                        Continue to post
                                    </button>
                                </div>
                            )}

                            {hasProject === false && (
                                <div className={styles.form}>
                                    <p className={styles.sub}>Paste this into Hermes, Claude, ChatGPT, or any agent with MCP.</p>
                                    <pre className={styles.pre}>{OWNER_PROMPT}</pre>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => {
                                            navigator.clipboard.writeText(OWNER_PROMPT);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 1600);
                                        }}
                                    >
                                        {copied ? 'Copied' : 'Copy prompt'}
                                    </button>
                                    <Link href="/settings/api-keys" className="btn-primary">Mint an API key</Link>
                                    <button type="button" className="btn-secondary" onClick={skipToDesk}>Skip to dashboard</button>
                                </div>
                            )}

                            {hasProject === null && (
                                <button type="button" className="btn-secondary" onClick={skipToDesk}>Skip for now</button>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function OnboardingWizard() {
    return (
        <Suspense fallback={<div className="loading-screen">Loading...</div>}>
            <OnboardingInner />
        </Suspense>
    );
}
