'use client';
import { LeadQualityScore } from '@/types';
import { getLeadQualityBadge } from '@/services/leadQuality';

interface LeadQualityBadgeProps {
    score: LeadQualityScore;
    compact?: boolean;
}

export default function LeadQualityBadge({ score, compact = false }: LeadQualityBadgeProps) {
    const badge = getLeadQualityBadge(score.overallScore);

    if (compact) {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: `${badge.color}22`, border: `1px solid ${badge.color}44`,
                borderRadius: '12px', padding: '2px 10px', fontSize: '12px',
                color: badge.color, fontWeight: 600,
            }}>
                {badge.icon} {score.overallScore}
            </span>
        );
    }

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '12px', padding: '16px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>{badge.icon}</span>
                <div>
                    <div style={{ color: badge.color, fontWeight: 700, fontSize: '16px' }}>
                        {badge.label}
                    </div>
                    <div style={{ color: '#888', fontSize: '11px' }}>
                        Score: {score.overallScore}/100
                    </div>
                </div>
            </div>

            {/* Score Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <MiniBar label="Description Quality" value={score.descriptionScore} max={25} icon="📝" />
                <MiniBar label="Budget Realism" value={score.budgetRealism} max={20} icon="💰" />
                <MiniBar label="User Track Record" value={score.userScore} max={20} icon="👤" />
                <MiniBar label="Urgency" value={score.urgencyScore} max={15} icon="⏰" />
                <MiniBar label="Location" value={score.locationScore} max={10} icon="📍" />
            </div>

            {/* Indicators */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {score.hasPhotos && <Tag icon="📷" label="Has Photos" />}
                {score.hasDimensions && <Tag icon="📏" label="Has Dimensions" />}
                {score.hasBudget && <Tag icon="💵" label="Budget Listed" />}
                {score.isReturningUser && <Tag icon="🔄" label="Returning User" />}
            </div>

            {/* Estimated Close */}
            {score.estimatedCloseTime && (
                <div style={{
                    marginTop: '12px', padding: '8px 12px', background: '#2a2a3e',
                    borderRadius: '8px', fontSize: '12px', color: '#aaa',
                }}>
                    🕐 {score.estimatedCloseTime}
                    {score.competingQuotes > 0 && ` · ${score.competingQuotes} quotes received`}
                </div>
            )}
        </div>
    );
}

function MiniBar({ label, value, max, icon }: { label: string; value: number; max: number; icon: string }) {
    const percent = Math.round((value / max) * 100);
    const color = percent >= 70 ? '#22c55e' : percent >= 40 ? '#f59e0b' : '#6b7280';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', width: '20px' }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
                </div>
            </div>
            <span style={{ fontSize: '11px', color: '#888', width: '60px', textAlign: 'right' }}>
                {value}/{max}
            </span>
        </div>
    );
}

function Tag({ icon, label }: { icon: string; label: string }) {
    return (
        <span style={{
            background: '#2a2a3e', borderRadius: '8px', padding: '3px 8px',
            fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
            {icon} {label}
        </span>
    );
}
