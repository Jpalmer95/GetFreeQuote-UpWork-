'use client';

interface FoundingMemberBadgeProps {
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export default function FoundingMemberBadge({ size = 'md', showLabel = true }: FoundingMemberBadgeProps) {
    const sizes = {
        sm: { badge: '24px', font: '12px', label: '10px' },
        md: { badge: '32px', font: '16px', label: '12px' },
        lg: { badge: '48px', font: '24px', label: '14px' },
    };
    const s = sizes[size];

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: s.badge, height: s.badge, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f7e7a0 0%, #d4a843 50%, #f7e7a0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.font, boxShadow: '0 0 12px rgba(212,168,67,0.4)',
                border: '2px solid #f7e7a0',
            }}>
                ⭐
            </div>
            {showLabel && (
                <div>
                    <div style={{
                        fontSize: s.label, fontWeight: 700,
                        background: 'linear-gradient(90deg, #f7e7a0, #d4a843)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Founding Member
                    </div>
                    {size !== 'sm' && (
                        <div style={{ fontSize: '10px', color: '#888' }}>
                            One of our first 100 users
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Badge tier for trust score display
export function TrustBadgeTier({ score }: { score: number }) {
    const tier = score >= 85 ? 'platinum' : score >= 70 ? 'gold' : score >= 50 ? 'silver' : score >= 30 ? 'bronze' : 'unverified';
    const colors: Record<string, { bg: string; border: string; text: string }> = {
        platinum: { bg: 'linear-gradient(135deg, #e5e4e2, #a8a9ad)', border: '#a8a9ad', text: '#333' },
        gold: { bg: 'linear-gradient(135deg, #f7e7a0, #d4a843)', border: '#d4a843', text: '#5a4200' },
        silver: { bg: 'linear-gradient(135deg, #e8e8e8, #b0b0b0)', border: '#b0b0b0', text: '#444' },
        bronze: { bg: 'linear-gradient(135deg, #f0d9b5, #cd7f32)', border: '#cd7f32', text: '#5a3a00' },
        unverified: { bg: '#2a2a2a', border: '#444', text: '#888' },
    };
    const c = colors[tier];

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: c.bg, borderRadius: '20px', padding: '4px 12px',
            border: `1px solid ${c.border}`,
        }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: c.text, textTransform: 'capitalize' }}>
                {tier}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: c.text }}>
                {score}
            </span>
        </div>
    );
}
