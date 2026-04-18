'use client';
import { TrustScoreBreakdown } from '@/types';
import { getTrustBadgeTier, getTrustDescription } from '@/services/trustScore';

interface TrustScoreBadgeProps {
    trustScore: TrustScoreBreakdown;
    size?: 'sm' | 'md' | 'lg';
    showDetails?: boolean;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    platinum: { bg: 'linear-gradient(135deg, #e5e4e2 0%, #a8a9ad 50%, #e5e4e2 100%)', border: '#a8a9ad', text: '#333', glow: 'rgba(168,169,173,0.4)' },
    gold: { bg: 'linear-gradient(135deg, #f7e7a0 0%, #d4a843 50%, #f7e7a0 100%)', border: '#d4a843', text: '#5a4200', glow: 'rgba(212,168,67,0.4)' },
    silver: { bg: 'linear-gradient(135deg, #e8e8e8 0%, #b0b0b0 50%, #e8e8e8 100%)', border: '#b0b0b0', text: '#444', glow: 'rgba(176,176,176,0.3)' },
    bronze: { bg: 'linear-gradient(135deg, #f0d9b5 0%, #cd7f32 50%, #f0d9b5 100%)', border: '#cd7f32', text: '#5a3a00', glow: 'rgba(205,127,50,0.3)' },
    unverified: { bg: '#2a2a2a', border: '#444', text: '#888', glow: 'none' },
};

export default function TrustScoreBadge({ trustScore, size = 'md', showDetails = false }: TrustScoreBadgeProps) {
    const tier = getTrustBadgeTier(trustScore.overallScore);
    const colors = TIER_COLORS[tier];
    const description = getTrustDescription(trustScore.overallScore);

    const sizeStyles = {
        sm: { badge: '48px', score: '14px', label: '10px' },
        md: { badge: '64px', score: '20px', label: '11px' },
        lg: { badge: '80px', score: '28px', label: '13px' },
    };

    const s = sizeStyles[size];

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Score Circle */}
            <div style={{
                width: s.badge, height: s.badge, borderRadius: '50%',
                background: colors.bg, border: `3px solid ${colors.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 20px ${colors.glow}`,
                position: 'relative',
            }}>
                <span style={{ fontSize: s.score, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                    {trustScore.overallScore}
                </span>
                <span style={{ fontSize: s.label, color: colors.text, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {tier}
                </span>
            </div>

            {/* Badges Row */}
            {(trustScore.fairPricerBadge || trustScore.veteranBadge || trustScore.fastResponderBadge) && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {trustScore.fairPricerBadge && <MiniBadge label="💰 Fair Pricer" />}
                    {trustScore.veteranBadge && <MiniBadge label="🏛️ Veteran" />}
                    {trustScore.fastResponderBadge && <MiniBadge label="⚡ Fast" />}
                    {trustScore.topRatedBadge && <MiniBadge label="⭐ Top Rated" />}
                </div>
            )}

            {/* Details Panel */}
            {showDetails && (
                <div style={{
                    background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                    border: '1px solid #333', width: '100%', maxWidth: '320px',
                }}>
                    <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px' }}>{description}</p>
                    <ScoreBar label="License" value={trustScore.licenseScore} max={25} verified={trustScore.licenseVerified} />
                    <ScoreBar label="Insurance" value={trustScore.insuranceScore} max={20} verified={trustScore.insuranceVerified} />
                    <ScoreBar label="Reviews" value={trustScore.reviewScore} max={20} />
                    <ScoreBar label="Completion" value={Math.round(trustScore.completionRate * 15)} max={15} />
                    <ScoreBar label="Response" value={trustScore.responseTimeScore} max={10} />
                    <ScoreBar label="Disputes" value={trustScore.disputeScore} max={10} />
                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '11px', color: '#888' }}>
                        <span>{trustScore.reviewCount} reviews</span>
                        <span>{trustScore.completedJobs} jobs done</span>
                        <span>~{trustScore.avgResponseMinutes}min response</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniBadge({ label }: { label: string }) {
    return (
        <span style={{
            background: '#2a2a3e', borderRadius: '12px', padding: '2px 8px',
            fontSize: '10px', color: '#ddd', border: '1px solid #444',
            whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

function ScoreBar({ label, value, max, verified }: { label: string; value: number; max: number; verified?: boolean }) {
    const percent = Math.round((value / max) * 100);
    const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', color: '#aaa' }}>
                    {label} {verified !== undefined && (verified ? '✅' : '❌')}
                </span>
                <span style={{ fontSize: '11px', color: '#888' }}>{value}/{max}</span>
            </div>
            <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
        </div>
    );
}
