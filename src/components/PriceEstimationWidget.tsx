'use client';
import { useState, useEffect } from 'react';
import { PriceEstimate } from '@/types';
import { estimatePrice, getPriceConfidenceLabel } from '@/services/priceEstimation';

interface PriceEstimationWidgetProps {
    category: string;
    subcategory: string;
    description: string;
    location: string;
    squareFootage?: string;
    urgency?: string;
    onEstimateReady?: (estimate: PriceEstimate) => void;
}

export default function PriceEstimationWidget({
    category, subcategory, description, location, squareFootage, urgency, onEstimateReady
}: PriceEstimationWidgetProps) {
    const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (category && description.length > 10) {
            const result = estimatePrice({ category, subcategory, description, location, squareFootage, urgency });
            setEstimate(result);
            onEstimateReady?.(result);
        }
    }, [category, subcategory, description, location, squareFootage, urgency]);

    if (!estimate) return null;

    const confidence = getPriceConfidenceLabel(estimate.confidence);

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1a2332 0%, #1a1a2e 100%)',
            borderRadius: '16px', padding: '20px', border: '1px solid #2a3a4e',
            position: 'relative', overflow: 'hidden',
        }}>
            {/* AI indicator */}
            <div style={{
                position: 'absolute', top: '12px', right: '12px',
                background: '#3b82f622', borderRadius: '8px', padding: '2px 8px',
                fontSize: '10px', color: '#60a5fa', fontWeight: 600,
            }}>
                🤖 AI ESTIMATE
            </div>

            {/* Main Price Range */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>
                    Estimated Market Range
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
                        ${estimate.lowEstimate.toLocaleString()}
                    </span>
                    <span style={{ color: '#666', fontSize: '18px' }}>—</span>
                    <span style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
                        ${estimate.highEstimate.toLocaleString()}
                    </span>
                </div>
                <div style={{ color: '#60a5fa', fontSize: '13px', marginTop: '4px' }}>
                    Most common: ${estimate.medianEstimate.toLocaleString()}
                </div>
            </div>

            {/* Confidence */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', background: '#ffffff08', borderRadius: '8px',
                marginBottom: '16px',
            }}>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: estimate.confidence >= 0.7 ? '#22c55e' : estimate.confidence >= 0.5 ? '#f59e0b' : '#ef4444',
                }} />
                <span style={{ fontSize: '12px', color: '#ccc' }}>{confidence.label}</span>
                <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
                    Based on {estimate.dataPoints} data points
                </span>
            </div>

            {/* Breakdown Toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    background: 'none', border: 'none', color: '#60a5fa',
                    cursor: 'pointer', fontSize: '12px', padding: '4px 0',
                    display: 'flex', alignItems: 'center', gap: '4px',
                }}
            >
                {expanded ? '▼' : '▶'} Cost Breakdown
            </button>

            {expanded && (
                <div style={{ marginTop: '12px' }}>
                    <BreakdownRow
                        label="Materials"
                        low={estimate.breakdown.materialsLow}
                        high={estimate.breakdown.materialsHigh}
                        color="#f59e0b"
                    />
                    <BreakdownRow
                        label="Labor"
                        low={estimate.breakdown.laborLow}
                        high={estimate.breakdown.laborHigh}
                        color="#3b82f6"
                    />
                    <BreakdownRow
                        label="Permits & Fees"
                        low={estimate.breakdown.permitsLow}
                        high={estimate.breakdown.permitsHigh}
                        color="#8b5cf6"
                    />

                    {/* Factors */}
                    {estimate.factors.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                                Pricing Factors:
                            </div>
                            {estimate.factors.map((factor, i) => (
                                <div key={i} style={{
                                    fontSize: '11px', color: '#888', padding: '2px 0',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}>
                                    <span style={{ color: '#555' }}>•</span> {factor}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Disclaimer */}
            <div style={{
                marginTop: '16px', fontSize: '10px', color: '#555',
                borderTop: '1px solid #ffffff08', paddingTop: '12px',
            }}>
                ⚠️ This is an AI-generated estimate based on market data. Actual costs vary based on
                specific requirements, materials, and contractor. Get multiple quotes to verify.
            </div>
        </div>
    );
}

function BreakdownRow({ label, low, high, color }: { label: string; low: number; high: number; color: string }) {
    const total = high || 1;
    const lowPct = Math.round((low / total) * 100);
    const barWidth = Math.max(20, lowPct);

    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>{label}</span>
                <span style={{ fontSize: '12px', color: '#ccc' }}>
                    ${low.toLocaleString()} - ${high.toLocaleString()}
                </span>
            </div>
            <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${barWidth}%`, background: color,
                    borderRadius: '3px', opacity: 0.8,
                }} />
            </div>
        </div>
    );
}
