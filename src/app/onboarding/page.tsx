'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type Step = 'welcome' | 'role' | 'profile' | 'interests' | 'complete';

export default function OnboardingWizard() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<Step>('welcome');
    const [role, setRole] = useState<'customer' | 'vendor' | 'both' | null>(null);
    const [skills, setSkills] = useState<string[]>([]);
    const [location, setLocation] = useState('');

    const SKILLS = [
        'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'Painting',
        'Landscaping', 'Carpentry', 'Flooring', 'General Labor',
        'Moving', 'Cleaning', 'Handyman', 'Consulting', 'Design',
    ];

    const handleComplete = () => {
        // Save onboarding data to user profile
        localStorage.setItem('gfq_onboarding', JSON.stringify({ role, skills, location }));
        router.push(role === 'vendor' ? '/vendor/profile' : '/post-job');
    };

    return (
        <main style={{
            minHeight: '100vh', background: '#0f0f1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: '100%', maxWidth: '500px', padding: '40px',
                background: '#1a1a2e', borderRadius: '20px',
                border: '1px solid #333',
            }}>
                {/* Progress */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '32px' }}>
                    {['welcome', 'role', 'profile', 'interests', 'complete'].map((s, i) => (
                        <div key={s} style={{
                            flex: 1, height: '4px', borderRadius: '2px',
                            background: ['welcome', 'role', 'profile', 'interests', 'complete'].indexOf(step) >= i
                                ? '#3b82f6' : '#333',
                        }} />
                    ))}
                </div>

                {step === 'welcome' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
                        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
                            Welcome to GetFreeQuote
                        </h1>
                        <p style={{ color: '#888', fontSize: '16px', lineHeight: 1.6, marginBottom: '32px' }}>
                            The marketplace where you get fair quotes, find quality work, and build community together.
                        </p>
                        <button onClick={() => setStep('role')} style={{
                            width: '100%', padding: '14px', background: '#3b82f6',
                            border: 'none', borderRadius: '10px', color: '#fff',
                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Get Started
                        </button>
                    </div>
                )}

                {step === 'role' && (
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
                            How will you use GetFreeQuote?
                        </h2>
                        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
                            You can always do both!
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { value: 'customer', icon: '🏠', label: 'I need to hire someone', desc: 'Get quotes for home projects, gigs, and more' },
                                { value: 'vendor', icon: '🔧', label: 'I want to find work', desc: 'Bid on jobs, build your reputation, grow your business' },
                                { value: 'both', icon: '🔄', label: 'Both!', desc: 'Hire AND find work - the best of both worlds' },
                            ].map(opt => (
                                <button key={opt.value} onClick={() => setRole(opt.value as any)} style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    padding: '16px', background: role === opt.value ? '#3b82f622' : '#ffffff06',
                                    border: `1px solid ${role === opt.value ? '#3b82f6' : '#333'}`,
                                    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                }}>
                                    <span style={{ fontSize: '28px' }}>{opt.icon}</span>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>{opt.label}</div>
                                        <div style={{ color: '#888', fontSize: '12px' }}>{opt.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {role && (
                            <button onClick={() => setStep('profile')} style={{
                                width: '100%', padding: '14px', marginTop: '20px',
                                background: '#3b82f6', border: 'none', borderRadius: '10px',
                                color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                            }}>
                                Continue
                            </button>
                        )}
                    </div>
                )}

                {step === 'profile' && (
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
                            {role === 'customer' ? 'Where are you located?' : 'What do you do?'}
                        </h2>
                        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
                            {role === 'customer'
                                ? 'We\'ll match you with contractors in your area.'
                                : 'Select all that apply - you can change this later.'}
                        </p>

                        {role !== 'customer' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                                {SKILLS.map(skill => (
                                    <button key={skill} onClick={() => setSkills(
                                        skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill]
                                    )} style={{
                                        padding: '8px 14px', borderRadius: '20px',
                                        background: skills.includes(skill) ? '#3b82f6' : '#333',
                                        border: 'none', color: '#fff', fontSize: '13px',
                                        cursor: 'pointer',
                                    }}>
                                        {skill}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                                City or ZIP Code
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="e.g. Portland, OR or 97201"
                                style={{
                                    width: '100%', padding: '12px', background: '#333',
                                    border: '1px solid #444', borderRadius: '8px',
                                    color: '#fff', fontSize: '14px',
                                }}
                            />
                        </div>

                        <button onClick={() => setStep('interests')} style={{
                            width: '100%', padding: '14px', background: '#3b82f6',
                            border: 'none', borderRadius: '10px', color: '#fff',
                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Continue
                        </button>
                    </div>
                )}

                {step === 'interests' && (
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
                            What interests you most?
                        </h2>
                        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
                            We'll personalize your experience.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { icon: '💰', label: 'Saving money on projects', desc: 'AI price estimation, group buys, neighborhood pools' },
                                { icon: '🛡️', label: 'Finding trusted contractors', desc: 'Trust scores, verified credentials, reviews' },
                                { icon: '🏘️', label: 'Community building', desc: 'Pool builds, volunteer credits, community projects' },
                                { icon: '🎓', label: 'Learning a trade', desc: 'Apprenticeship matching, mentorship programs' },
                            ].map(opt => (
                                <div key={opt.label} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '14px', background: '#ffffff06',
                                    border: '1px solid #333', borderRadius: '10px',
                                }}>
                                    <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 500, fontSize: '14px' }}>{opt.label}</div>
                                        <div style={{ color: '#888', fontSize: '11px' }}>{opt.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setStep('complete')} style={{
                            width: '100%', padding: '14px', marginTop: '20px',
                            background: '#22c55e', border: 'none', borderRadius: '10px',
                            color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Almost Done!
                        </button>
                    </div>
                )}

                {step === 'complete' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
                            You're all set!
                        </h2>
                        <div style={{
                            background: '#22c55e22', borderRadius: '12px', padding: '16px',
                            marginBottom: '24px', border: '1px solid #22c55e33',
                        }}>
                            <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                                🏆 Founding Member Badge Earned!
                            </div>
                            <div style={{ color: '#888', fontSize: '12px' }}>
                                You're one of our first users. This badge stays forever.
                            </div>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px' }}>
                            {role === 'customer'
                                ? 'Ready to post your first project? We\'ll make sure you get great quotes.'
                                : 'Ready to find work? Set up your profile to start receiving job matches.'}
                        </p>
                        <button onClick={handleComplete} style={{
                            width: '100%', padding: '14px', background: '#3b82f6',
                            border: 'none', borderRadius: '10px', color: '#fff',
                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            {role === 'customer' ? 'Post Your First Project' : 'Set Up Your Profile'}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
