'use client';
import { SurgeState } from '@/types';
import { applySurgePrice, getSurgeExplanation } from '@/services/surgePricing';

interface SurgePricingIndicatorProps {
    surge: SurgeState;
    basePrice: number;
    showDetails?: boolean;
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    normal: { color: '#22c55e', bg: '#22c55e22', icon: '✅' },
    moderate: { color: '#f59e0b', bg: '#f59e0b22', icon: '⚠️' },
    high: { color: '#f97316', bg: '#f9731622', icon: '🔥' },
    extreme: { color: '#ef4444', bg: '#ef444422', icon: '🚨' },
};

export default function SurgePricingIndicator({ surge, basePrice, showDetails = false }: SurgePricingIndicatorProps) {
    const { surgePrice, surgeAmount, isSurging } = applySurgePrice(basePrice, surge);
    const config = LEVEL_CONFIG[surge.level];
    const explanation = getSurgeExplanation(surge);

    if (!isSurging) {
        return (
            <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: config.bg, borderRadius: '8px', padding: '4px 10px',
                fontSize: '12px', color: config.color,
            }}>
                {config.icon} Normal pricing
            </div>
        );
    }

    return (
        <div style={{
            background: config.bg, borderRadius: '12px', padding: '12px 16px',
            border: `1px solid ${config.color}33`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{config.icon}</span>
                    <div>
                        <div style={{ color: config.color, fontWeight: 700, fontSize: '14px' }}>
                            Surge Pricing Active
                        </div>
                        <div style={{ color: '#aaa', fontSize: '12px' }}>
                            {explanation}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#888', fontSize: '12px', textDecoration: 'line-through' }}>
                        ${basePrice}
                    </div>
                    <div style={{ color: config.color, fontWeight: 700, fontSize: '20px' }}>
                        ${surgePrice}
                    </div>
                </div>
            </div>

            {showDetails && (
                <div style={{
                    marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                }}>
                    <DetailCard label="Multiplier" value={`${surge.currentMultiplier}x`} />
                    <DetailCard label="Jobs in Area" value={String(surge.demandCount)} />
                    <DetailCard label="Workers Available" value={String(surge.supplyCount)} />
                </div>
            )}

            {surge.expiresAt && (
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                    Surge recalculates every 15 minutes · Next update: {new Date(surge.expiresAt).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}

function DetailCard({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            background: '#ffffff08', borderRadius: '6px', padding: '8px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{value}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>{label}</div>
        </div>
    );
}
