'use client';
import { NeighborhoodPool } from '@/types';
import { getPoolProgress, getSavingsBreakdown } from '@/services/neighborhoodPool';

interface NeighborhoodPoolCardProps {
    pool: NeighborhoodPool;
    distanceMiles?: number;
    isParticipant?: boolean;
    onJoin?: () => void;
    onLeave?: () => void;
}

export default function NeighborhoodPoolCard({ pool, distanceMiles, isParticipant, onJoin, onLeave }: NeighborhoodPoolCardProps) {
    const progress = getPoolProgress(pool);
    const savings = getSavingsBreakdown(pool);

    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
        gathering: { color: '#3b82f6', bg: '#3b82f622', label: 'Gathering Neighbors' },
        funded: { color: '#22c55e', bg: '#22c55e22', label: 'Ready for Bids' },
        contractor_selected: { color: '#8b5cf6', bg: '#8b5cf622', label: 'Contractor Selected' },
        in_progress: { color: '#f59e0b', bg: '#f59e0b22', label: 'In Progress' },
        completed: { color: '#22c55e', bg: '#22c55e22', label: 'Completed' },
    };
    const sc = statusConfig[pool.status] ?? statusConfig.gathering;

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '20px' }}>🏘️</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>{pool.title}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        {pool.workType} · {pool.location}
                        {distanceMiles !== undefined && ` · ${distanceMiles} mi away`}
                    </div>
                </div>
                <span style={{
                    background: sc.bg, borderRadius: '8px', padding: '4px 10px',
                    fontSize: '11px', color: sc.color, fontWeight: 600,
                }}>
                    {sc.label}
                </span>
            </div>

            {/* Description */}
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px', lineHeight: 1.5 }}>
                {pool.description}
            </div>

            {/* Savings Highlight */}
            <div style={{
                background: 'linear-gradient(135deg, #22c55e11 0%, #3b82f611 100%)',
                borderRadius: '12px', padding: '16px', marginBottom: '16px',
                border: '1px solid #22c55e22',
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Individual Cost</div>
                        <div style={{ fontSize: '16px', color: '#888', textDecoration: 'line-through' }}>
                            ${pool.estimatedIndividualCost.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Pool Price</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#22c55e' }}>
                            ${pool.estimatedPoolCost.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>You Save</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b' }}>
                            ${savings.perPersonSaved.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#f59e0b' }}>({pool.savingsPercent}% off)</div>
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {progress.participantCount} / {pool.maxParticipants} neighbors
                    </span>
                    <span style={{ fontSize: '12px', color: progress.isMinimumMet ? '#22c55e' : '#f59e0b' }}>
                        {progress.isMinimumMet ? '✅ Minimum reached' : `Need ${pool.minParticipants - progress.participantCount} more`}
                    </span>
                </div>
                <div style={{ height: '8px', background: '#333', borderRadius: '4px', position: 'relative' }}>
                    {/* Min threshold marker */}
                    <div style={{
                        position: 'absolute', left: `${(pool.minParticipants / pool.maxParticipants) * 100}%`,
                        top: '-4px', width: '2px', height: '16px', background: '#f59e0b',
                    }} />
                    <div style={{
                        height: '100%',
                        width: `${progress.percentToMaximum}%`,
                        background: progress.isMinimumMet
                            ? 'linear-gradient(90deg, #22c55e, #3b82f6)'
                            : '#3b82f6',
                        borderRadius: '4px', transition: 'width 0.5s',
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                        {progress.spotsRemaining} spots remaining
                    </span>
                    <span style={{ fontSize: '10px', color: progress.daysRemaining <= 5 ? '#f59e0b' : '#666' }}>
                        {progress.daysRemaining} days left
                    </span>
                </div>
            </div>

            {/* Participants Preview */}
            {pool.currentParticipants.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Recent Participants:</div>
                    <div style={{ display: 'flex', gap: '-8px' }}>
                        {pool.currentParticipants.slice(0, 5).map((p, i) => (
                            <div key={p.userId} style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: `hsl(${(i * 60) % 360}, 50%, 40%)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', color: '#fff', fontWeight: 600,
                                border: '2px solid #1a1a2e', marginLeft: i > 0 ? '-8px' : 0,
                            }}>
                                {p.userName.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        {pool.currentParticipants.length > 5 && (
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', color: '#aaa', border: '2px solid #1a1a2e', marginLeft: '-8px',
                            }}>
                                +{pool.currentParticipants.length - 5}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            {pool.status === 'gathering' && (
                <div>
                    {isParticipant ? (
                        <button onClick={onLeave} style={{
                            width: '100%', padding: '10px', background: '#ef444422',
                            border: '1px solid #ef444444', borderRadius: '8px',
                            color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Leave Pool
                        </button>
                    ) : (
                        <button onClick={onJoin} style={{
                            width: '100%', padding: '10px', background: '#22c55e',
                            border: 'none', borderRadius: '8px',
                            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Join Pool - ${pool.estimatedPoolCost.toLocaleString()}
                        </button>
                    )}
                </div>
            )}

            {/* Pool Stats */}
            <div style={{
                marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
            }}>
                <div style={{
                    background: '#ffffff06', borderRadius: '8px', padding: '8px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                        ${progress.totalPoolValue.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Total Pool Value</div>
                </div>
                <div style={{
                    background: '#ffffff06', borderRadius: '8px', padding: '8px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>
                        ${savings.totalSaved.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Total Community Savings</div>
                </div>
            </div>
        </div>
    );
}
