'use client';
import { useState } from 'react';
import { MaterialGroupBuy } from '@/types';
import { getGroupBuyProgress, calculateParticipantSavings } from '@/services/materialGroupBuy';

interface MaterialGroupBuyCardProps {
    groupBuy: MaterialGroupBuy;
    onJoin?: (quantity: number) => void;
    onLeave?: () => void;
    isParticipant?: boolean;
    vendorId?: string;
}

export default function MaterialGroupBuyCard({ groupBuy, onJoin, onLeave, isParticipant, vendorId }: MaterialGroupBuyCardProps) {
    const [quantity, setQuantity] = useState(1);
    const progress = getGroupBuyProgress(groupBuy);
    const savings = calculateParticipantSavings(groupBuy, quantity);

    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
        gathering: { color: '#3b82f6', bg: '#3b82f622', label: 'Gathering' },
        confirmed: { color: '#22c55e', bg: '#22c55e22', label: 'Confirmed - Order Ready' },
        ordered: { color: '#8b5cf6', bg: '#8b5cf622', label: 'Ordered' },
        delivered: { color: '#22c55e', bg: '#22c55e22', label: 'Delivered' },
        cancelled: { color: '#ef4444', bg: '#ef444422', label: 'Cancelled' },
    };
    const sc = statusConfig[groupBuy.status] ?? statusConfig.gathering;

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                        🏗️ {groupBuy.materialCategory}
                    </div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
                        {groupBuy.materialDescription}
                    </div>
                </div>
                <span style={{
                    background: sc.bg, borderRadius: '8px', padding: '4px 10px',
                    fontSize: '11px', color: sc.color, fontWeight: 600,
                }}>
                    {sc.label}
                </span>
            </div>

            {/* Pricing */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
                marginBottom: '16px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Retail Price</div>
                    <div style={{ fontSize: '16px', color: '#888', textDecoration: 'line-through' }}>
                        ${groupBuy.retailPricePerUnit}/unit
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Group Price</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e' }}>
                        ${groupBuy.groupPricePerUnit}/unit
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>You Save</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b' }}>
                        {groupBuy.savingsPercent}%
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {groupBuy.currentQuantity} / {groupBuy.targetQuantity} units
                    </span>
                    <span style={{ fontSize: '12px', color: progress.isMinimumMet ? '#22c55e' : '#f59e0b' }}>
                        {progress.isMinimumMet ? '✅ Minimum met' : `${progress.percentToMinimum}% to minimum`}
                    </span>
                </div>
                <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${Math.min(100, progress.percentToTarget)}%`,
                        background: progress.isMinimumMet
                            ? 'linear-gradient(90deg, #22c55e, #3b82f6)'
                            : '#f59e0b',
                        borderRadius: '4px', transition: 'width 0.5s',
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                        {groupBuy.participants.length} participants
                    </span>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                        {progress.daysRemaining} days left
                    </span>
                </div>
            </div>

            {/* Join/Leave */}
            {groupBuy.status === 'gathering' && (
                <div style={{ marginBottom: '12px' }}>
                    {isParticipant ? (
                        <button onClick={onLeave} style={{
                            width: '100%', padding: '10px', background: '#ef444422',
                            border: '1px solid #ef444444', borderRadius: '8px',
                            color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Leave Group Buy
                        </button>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                                        Quantity (units)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        style={{
                                            width: '100%', padding: '8px 12px', background: '#333',
                                            border: '1px solid #444', borderRadius: '6px',
                                            color: '#fff', fontSize: '14px',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                                        Your Total
                                    </label>
                                    <div style={{
                                        padding: '8px 12px', background: '#22c55e22',
                                        border: '1px solid #22c55e44', borderRadius: '6px',
                                        color: '#22c55e', fontSize: '14px', fontWeight: 600,
                                    }}>
                                        ${savings.groupTotal.toLocaleString()}
                                        <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>
                                            Save ${savings.savings}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => onJoin?.(quantity)} style={{
                                width: '100%', padding: '10px', background: '#3b82f6',
                                border: 'none', borderRadius: '8px',
                                color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            }}>
                                Join Group Buy
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Delivery Info */}
            {groupBuy.deliveryLocation && (
                <div style={{
                    padding: '8px 12px', background: '#ffffff06', borderRadius: '8px',
                    fontSize: '11px', color: '#888',
                }}>
                    📍 Delivery: {groupBuy.deliveryLocation}
                    {groupBuy.deliveryDate && ` · ${new Date(groupBuy.deliveryDate).toLocaleDateString()}`}
                </div>
            )}

            {/* Deadline */}
            <div style={{
                marginTop: '8px', fontSize: '11px', color: progress.daysRemaining <= 3 ? '#f59e0b' : '#666',
                textAlign: 'center',
            }}>
                ⏰ Deadline: {new Date(groupBuy.deadline).toLocaleDateString()}
                {progress.daysRemaining <= 3 && ' - Almost closed!'}
            </div>
        </div>
    );
}
