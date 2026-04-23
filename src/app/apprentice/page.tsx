'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { ApprenticeMatchCard } from '@/components/ApprenticeMatchCard';
import { ApprenticeProfile, MentorProfile, ApprenticeLog } from '@/types';

const MOCK_APPRENTICES: { apprentice: ApprenticeProfile; logs: ApprenticeLog[] }[] = [
    {
        apprentice: {
            id: 'app1', userId: 'u1', name: 'Marcus Johnson', desiredTrade: 'Plumbing',
            experienceLevel: 'some', certifications: ['OSHA 10'], availability: 'full_time',
            locationLat: 45.5152, locationLng: -122.6784, maxCommuteMiles: 25,
            status: 'active', hoursLogged: 340, hoursRequired: 2000, currentMentorId: 'm1',
            bio: 'Eager to learn the plumbing trade. 6 months experience as a helper. Looking for a patient mentor who values teaching.',
            createdAt: '2026-01-15T00:00:00Z',
        },
        logs: [
            { id: 'l1', apprenticeId: 'app1', mentorId: 'm1', date: '2026-04-15T00:00:00Z', hoursWorked: 8, skillsPracticed: ['pipe cutting', 'soldering', 'fitting'], photos: [] },
            { id: 'l2', apprenticeId: 'app1', mentorId: 'm1', date: '2026-04-14T00:00:00Z', hoursWorked: 8, skillsPracticed: ['drain cleaning', 'fixture install'], photos: [] },
        ],
    },
    {
        apprentice: {
            id: 'app2', userId: 'u2', name: 'Emily Torres', desiredTrade: 'Electrical',
            experienceLevel: 'formal_training', certifications: ['Trade School Graduate'], availability: 'full_time',
            locationLat: 30.2672, locationLng: -97.7431, maxCommuteMiles: 30,
            status: 'seeking', hoursLogged: 0, hoursRequired: 2000,
            bio: 'Recent trade school graduate looking for hands-on experience. Strong theory knowledge, ready to apply it in the field.',
            createdAt: '2026-04-01T00:00:00Z',
        },
        logs: [],
    },
];

const MOCK_MENTORS: MentorProfile[] = [
    {
        vendorId: 'm1', vendorName: 'Pacific Plumbing Co.', tradesOffered: ['Plumbing', 'HVAC'],
        maxApprentices: 3, currentApprentices: 1, hourlyRateForApprentice: 18,
        yearsExperience: 15, certifiedToTeach: true,
        bio: 'Master plumber with 15 years experience. We believe in hands-on training and growing the next generation of tradespeople.',
    },
    {
        vendorId: 'm2', vendorName: 'Volt Electric LLC', tradesOffered: ['Electrical'],
        maxApprentices: 2, currentApprentices: 0, hourlyRateForApprentice: 20,
        yearsExperience: 12, certifiedToTeach: true,
        bio: 'Licensed electrician looking to mentor motivated apprentices. We work on residential and commercial projects.',
    },
];

export default function ApprenticePage() {
    const [tab, setTab] = useState<'apprentices' | 'mentors'>('apprentices');

    return (
        <main style={{ minHeight: '100vh', background: '#0f0f1a' }}>
            <Navbar />
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
                <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                    🎓 Apprentice & Mentorship
                </h1>
                <p style={{ color: '#888', marginBottom: '24px' }}>
                    Connect aspiring tradespeople with experienced mentors
                </p>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button onClick={() => setTab('apprentices')} style={{
                        background: tab === 'apprentices' ? '#3b82f6' : '#1a1a2e',
                        border: `1px solid ${tab === 'apprentices' ? '#3b82f6' : '#333'}`,
                        borderRadius: '8px', padding: '8px 16px',
                        color: tab === 'apprentices' ? '#fff' : '#888', fontSize: '13px',
                        cursor: 'pointer',
                    }}>
                        👷 Apprentices ({MOCK_APPRENTICES.length})
                    </button>
                    <button onClick={() => setTab('mentors')} style={{
                        background: tab === 'mentors' ? '#3b82f6' : '#1a1a2e',
                        border: `1px solid ${tab === 'mentors' ? '#3b82f6' : '#333'}`,
                        borderRadius: '8px', padding: '8px 16px',
                        color: tab === 'mentors' ? '#fff' : '#888', fontSize: '13px',
                        cursor: 'pointer',
                    }}>
                        🏆 Mentors ({MOCK_MENTORS.length})
                    </button>
                    <button style={{
                        background: '#22c55e', border: 'none', borderRadius: '8px',
                        padding: '8px 16px', color: '#fff', fontSize: '13px',
                        cursor: 'pointer', marginLeft: 'auto',
                    }}>
                        + {tab === 'apprentices' ? 'Join as Apprentice' : 'Become a Mentor'}
                    </button>
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tab === 'apprentices' && MOCK_APPRENTICES.map(({ apprentice, logs }) => (
                        <ApprenticeMatchCard
                            key={apprentice.id}
                            apprentice={apprentice}
                            mentor={MOCK_MENTORS.find(m => m.vendorId === apprentice.currentMentorId)}
                            logs={logs}
                            onConnect={() => alert('Connect with mentor')}
                        />
                    ))}
                    {tab === 'mentors' && MOCK_MENTORS.map(mentor => (
                        <div key={mentor.vendorId} style={{
                            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                            border: '1px solid #333',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>🏆 {mentor.vendorName}</div>
                                    <div style={{ color: '#888', fontSize: '12px' }}>{mentor.yearsExperience} years experience</div>
                                </div>
                                {mentor.certifiedToTeach && (
                                    <span style={{ background: '#22c55e22', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#22c55e' }}>
                                        ✅ Certified Instructor
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                {mentor.tradesOffered.map(t => (
                                    <span key={t} style={{ background: '#3b82f622', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', color: '#60a5fa' }}>{t}</span>
                                ))}
                            </div>
                            <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px' }}>{mentor.bio}</p>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                                <span>${mentor.hourlyRateForApprentice}/hr apprentice rate</span>
                                <span>{mentor.currentApprentices}/{mentor.maxApprentices} apprentices</span>
                            </div>
                            <button style={{
                                width: '100%', padding: '10px', background: '#3b82f6',
                                border: 'none', borderRadius: '8px', color: '#fff',
                                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            }}>
                                Apply as Apprentice
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
