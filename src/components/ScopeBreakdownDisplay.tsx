'use client';
import { ScopeBreakdown, ScopePhase } from '@/types';

interface ScopeBreakdownDisplayProps {
    scope: ScopeBreakdown;
    onPhaseSelect?: (phase: ScopePhase) => void;
    selectedPhaseIds?: string[];
}

export default function ScopeBreakdownDisplay({ scope, onPhaseSelect, selectedPhaseIds = [] }: ScopeBreakdownDisplayProps) {
    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '18px' }}>🔍</span>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>Scope Breakdown</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        {scope.phases.length} phases · {scope.suggestedContractors} contractor(s) suggested
                        {scope.canPhaseBid && ' · Per-phase bidding available'}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '20px' }}>
                        ${scope.totalEstimateLow.toLocaleString()} - ${scope.totalEstimateHigh.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Total Estimate</div>
                </div>
            </div>

            {/* Confidence */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', background: '#ffffff08', borderRadius: '6px',
                marginBottom: '16px', fontSize: '11px', color: '#888',
            }}>
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: scope.confidence >= 0.7 ? '#22c55e' : scope.confidence >= 0.5 ? '#f59e0b' : '#ef4444',
                }} />
                Confidence: {Math.round(scope.confidence * 100)}%
                <span style={{ marginLeft: 'auto', color: '#666' }}>AI-generated scope</span>
            </div>

            {/* Phases Timeline */}
            <div style={{ position: 'relative' }}>
                {scope.phases.map((phase, idx) => {
                    const isSelected = selectedPhaseIds.includes(phase.id);
                    const hasDependency = phase.dependsOn.length > 0;

                    return (
                        <div
                            key={phase.id}
                            onClick={() => onPhaseSelect?.(phase)}
                            style={{
                                display: 'flex', gap: '12px', padding: '12px',
                                background: isSelected ? '#3b82f622' : '#ffffff06',
                                borderRadius: '10px', marginBottom: '8px',
                                border: isSelected ? '1px solid #3b82f644' : '1px solid transparent',
                                cursor: onPhaseSelect ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                            }}
                        >
                            {/* Phase Number */}
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: isSelected ? '#3b82f6' : '#333',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '14px', fontWeight: 600, color: '#fff',
                                flexShrink: 0,
                            }}>
                                {idx + 1}
                            </div>

                            {/* Phase Details */}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                                            {phase.name}
                                        </div>
                                        <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
                                            {phase.description}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                        <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }}>
                                            ${phase.estimateLow.toLocaleString()} - ${phase.estimateHigh.toLocaleString()}
                                        </div>
                                        <div style={{ color: '#888', fontSize: '11px' }}>
                                            ~{phase.durationDays} day{phase.durationDays !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Tags */}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                    <PhaseTag label={phase.tradeRequired} color="#3b82f6" />
                                    {phase.permitRequired && <PhaseTag label="Permit Required" color="#f59e0b" />}
                                    {hasDependency && (
                                        <PhaseTag
                                            label={`Depends on: ${phase.dependsOn.length} phase(s)`}
                                            color="#8b5cf6"
                                        />
                                    )}
                                </div>

                                {/* Materials */}
                                {phase.materialsNeeded.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                                        Materials: {phase.materialsNeeded.join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Connector line */}
            {scope.phases.length > 1 && (
                <div style={{
                    position: 'absolute', left: '35px', top: '80px', bottom: '40px',
                    width: '2px', background: '#33333344', zIndex: 0,
                }} />
            )}
        </div>
    );
}

function PhaseTag({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            background: `${color}22`, borderRadius: '6px', padding: '2px 8px',
            fontSize: '10px', color, fontWeight: 500, textTransform: 'capitalize',
        }}>
            {label}
        </span>
    );
}
