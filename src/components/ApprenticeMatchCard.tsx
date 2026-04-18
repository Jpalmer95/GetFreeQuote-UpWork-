'use client';
import { ApprenticeProfile, MentorProfile } from '@/types';
import { calculateProgress, getMentorCapacity, getTradeSkills } from '@/services/apprenticeMatching';
import { ApprenticeLog } from '@/types';

interface ApprenticeMatchCardProps {
    apprentice: ApprenticeProfile;
    mentor?: MentorProfile;
    logs?: ApprenticeLog[];
    matchScore?: number;
    matchReasons?: string[];
    isMentorView?: boolean;
    onConnect?: () => void;
}

export function ApprenticeMatchCard({
    apprentice, mentor, logs = [], matchScore, matchReasons = [], isMentorView = false, onConnect
}: ApprenticeMatchCardProps) {
    const progress = logs.length > 0 ? calculateProgress(logs) : null;
    const capacity = mentor ? getMentorCapacity(mentor) : null;

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', color: '#fff', fontWeight: 700,
                        }}>
                            {isMentorView ? apprentice.name.charAt(0) : mentor?.vendorName.charAt(0) ?? '?'}
                        </div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>
                                {isMentorView ? apprentice.name : mentor?.vendorName ?? 'Unknown'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>
                                {isMentorView ? `Seeking: ${apprentice.desiredTrade}` : `${mentor?.yearsExperience} years experience`}
                            </div>
                        </div>
                    </div>
                </div>
                {matchScore !== undefined && (
                    <div style={{
                        background: matchScore >= 70 ? '#22c55e22' : matchScore >= 50 ? '#f59e0b22' : '#6b728022',
                        borderRadius: '8px', padding: '4px 10px',
                        fontSize: '12px', fontWeight: 600,
                        color: matchScore >= 70 ? '#22c55e' : matchScore >= 50 ? '#f59e0b' : '#6b7280',
                    }}>
                        {matchScore}% Match
                    </div>
                )}
            </div>

            {/* Progress (for active apprentices) */}
            {progress && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>
                            Progress: {progress.totalHours} hours
                        </span>
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}>
                            {progress.percentComplete}%
                        </span>
                    </div>
                    <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', width: `${progress.percentComplete}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                            borderRadius: '4px',
                        }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#666' }}>
                            ~{progress.averageHoursPerWeek} hrs/week
                        </span>
                        <span style={{ fontSize: '10px', color: '#666' }}>
                            Est. completion: {new Date(progress.estimatedCompletionDate).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            )}

            {/* Apprentice Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <InfoChip label="Experience" value={apprentice.experienceLevel.replace('_', ' ')} />
                <InfoChip label="Availability" value={apprentice.availability.replace('_', ' ')} />
                <InfoChip label="Max Commute" value={`${apprentice.maxCommuteMiles} mi`} />
                <InfoChip label="Status" value={apprentice.status} />
            </div>

            {/* Mentor Details */}
            {mentor && capacity && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Trades Offered:</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {mentor.tradesOffered.map(trade => (
                            <span key={trade} style={{
                                background: '#3b82f622', borderRadius: '6px', padding: '3px 8px',
                                fontSize: '11px', color: '#60a5fa',
                            }}>
                                {trade}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#888' }}>
                        <span>${mentor.hourlyRateForApprentice}/hr apprentice rate</span>
                        <span>{capacity.capacityLabel}</span>
                        {mentor.certifiedToTeach && <span style={{ color: '#22c55e' }}>✅ Certified</span>}
                    </div>
                </div>
            )}

            {/* Match Reasons */}
            {matchReasons.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Why this match:</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {matchReasons.map(reason => (
                            <span key={reason} style={{
                                background: '#ffffff08', borderRadius: '6px', padding: '2px 8px',
                                fontSize: '10px', color: '#aaa',
                            }}>
                                {reason.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Skills Progress */}
            {progress && progress.skillsAcquired.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Skills Acquired:</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {progress.skillsAcquired.map(skill => (
                            <span key={skill} style={{
                                background: '#22c55e22', borderRadius: '6px', padding: '2px 8px',
                                fontSize: '10px', color: '#22c55e',
                            }}>
                                ✓ {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggested Skills to Learn */}
            {apprentice.desiredTrade && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Skills to learn:</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {getTradeSkills(apprentice.desiredTrade).slice(0, 5).map(skill => (
                            <span key={skill} style={{
                                background: '#ffffff08', borderRadius: '6px', padding: '2px 8px',
                                fontSize: '10px', color: '#666',
                            }}>
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Bio */}
            <div style={{
                padding: '10px 12px', background: '#ffffff06', borderRadius: '8px',
                fontSize: '12px', color: '#aaa', lineHeight: 1.5, marginBottom: '16px',
            }}>
                {isMentorView ? apprentice.bio : mentor?.bio ?? 'No bio available'}
            </div>

            {/* Action */}
            {onConnect && (
                <button onClick={onConnect} style={{
                    width: '100%', padding: '10px', background: '#3b82f6',
                    border: 'none', borderRadius: '8px',
                    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>
                    {isMentorView ? 'Invite to Apprentice Program' : 'Connect with Mentor'}
                </button>
            )}
        </div>
    );
}

function InfoChip({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            background: '#ffffff06', borderRadius: '8px', padding: '8px',
        }}>
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', color: '#ddd', textTransform: 'capitalize' }}>{value}</div>
        </div>
    );
}
