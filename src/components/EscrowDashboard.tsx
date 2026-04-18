'use client';
import { EscrowAccount, EscrowMilestone } from '@/types';
import { getEscrowSummary } from '@/services/escrow';

interface EscrowDashboardProps {
    escrow: EscrowAccount;
    userRole: 'payer' | 'payee';
    onFund?: () => void;
    onApproveMilestone?: (milestoneId: string) => void;
    onDispute?: () => void;
    onSubmitProof?: (milestoneId: string) => void;
}

export default function EscrowDashboard({
    escrow, userRole, onFund, onApproveMilestone, onDispute, onSubmitProof
}: EscrowDashboardProps) {
    const summary = getEscrowSummary(escrow);
    const isPayer = userRole === 'payer';

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🔒</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>Escrow Protection</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        {isPayer ? 'Payment protected until work is verified' : 'Funds held securely by platform'}
                    </div>
                </div>
                <StatusBadge status={escrow.status} />
            </div>

            {/* Amount Overview */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
                marginBottom: '20px',
            }}>
                <AmountCard label="Total" amount={escrow.totalAmount} color="#fff" />
                <AmountCard label="Funded" amount={escrow.fundedAmount} color="#3b82f6" />
                <AmountCard label="Released" amount={escrow.releasedAmount} color="#22c55e" />
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {summary.percentFunded}% funded
                    </span>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {summary.percentReleased}% released
                    </span>
                </div>
                <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', width: `${summary.percentReleased}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
                        borderRadius: '4px', transition: 'width 0.5s',
                    }} />
                </div>
            </div>

            {/* Milestones */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '10px' }}>
                    Milestones ({summary.completedMilestones}/{summary.totalMilestones})
                </div>
                {escrow.milestones.map((milestone) => (
                    <MilestoneRow
                        key={milestone.id}
                        milestone={milestone}
                        isPayer={isPayer}
                        onApprove={() => onApproveMilestone?.(milestone.id)}
                        onSubmitProof={() => onSubmitProof?.(milestone.id)}
                    />
                ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {escrow.status === 'pending' && isPayer && (
                    <ActionButton label="💳 Fund Escrow" onClick={onFund} primary />
                )}
                {escrow.status === 'funded' && !isPayer && (
                    <ActionButton label="📸 Submit Proof" onClick={() => onSubmitProof?.(summary.nextMilestone?.id ?? '')} primary />
                )}
                {(escrow.status === 'funded' || escrow.status === 'partial_released') && (
                    <ActionButton label="⚠️ File Dispute" onClick={onDispute} danger />
                )}
            </div>

            {/* Info */}
            <div style={{
                marginTop: '16px', padding: '10px 12px', background: '#ffffff06',
                borderRadius: '8px', fontSize: '11px', color: '#666',
            }}>
                💡 Funds are held securely. Money is only released when milestones are approved.
                Disputes freeze remaining funds until resolved.
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: EscrowAccount['status'] }) {
    const config: Record<string, { color: string; bg: string; label: string }> = {
        pending: { color: '#f59e0b', bg: '#f59e0b22', label: 'Pending Funding' },
        funded: { color: '#3b82f6', bg: '#3b82f622', label: 'Funded' },
        partial_released: { color: '#8b5cf6', bg: '#8b5cf622', label: 'Partially Released' },
        released: { color: '#22c55e', bg: '#22c55e22', label: 'Completed' },
        disputed: { color: '#ef4444', bg: '#ef444422', label: 'Disputed' },
        refunded: { color: '#6b7280', bg: '#6b728022', label: 'Refunded' },
        expired: { color: '#6b7280', bg: '#6b728022', label: 'Expired' },
    };
    const c = config[status] ?? config.pending;

    return (
        <span style={{
            background: c.bg, borderRadius: '8px', padding: '4px 10px',
            fontSize: '12px', color: c.color, fontWeight: 600,
        }}>
            {c.label}
        </span>
    );
}

function AmountCard({ label, amount, color }: { label: string; amount: number; color: string }) {
    return (
        <div style={{
            background: '#ffffff06', borderRadius: '10px', padding: '12px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color }}>
                ${amount.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>{label}</div>
        </div>
    );
}

function MilestoneRow({
    milestone, isPayer, onApprove, onSubmitProof
}: {
    milestone: EscrowMilestone;
    isPayer: boolean;
    onApprove: () => void;
    onSubmitProof: () => void;
}) {
    const statusConfig: Record<string, { icon: string; color: string }> = {
        pending: { icon: '⏳', color: '#888' },
        submitted: { icon: '📋', color: '#f59e0b' },
        approved: { icon: '✅', color: '#22c55e' },
        released: { icon: '💰', color: '#22c55e' },
        disputed: { icon: '⚠️', color: '#ef4444' },
    };
    const sc = statusConfig[milestone.status] ?? statusConfig.pending;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', background: '#ffffff06',
            borderRadius: '8px', marginBottom: '6px',
        }}>
            <span style={{ fontSize: '16px' }}>{sc.icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#ddd', fontWeight: 500 }}>
                    {milestone.name}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                    ${milestone.amount.toLocaleString()} · {milestone.status}
                </div>
            </div>
            {milestone.status === 'submitted' && isPayer && (
                <button onClick={onApprove} style={{
                    background: '#22c55e22', border: '1px solid #22c55e44',
                    borderRadius: '6px', padding: '4px 10px', color: '#22c55e',
                    fontSize: '11px', cursor: 'pointer',
                }}>
                    Approve & Release
                </button>
            )}
            {milestone.status === 'pending' && !isPayer && (
                <button onClick={onSubmitProof} style={{
                    background: '#3b82f622', border: '1px solid #3b82f644',
                    borderRadius: '6px', padding: '4px 10px', color: '#60a5fa',
                    fontSize: '11px', cursor: 'pointer',
                }}>
                    Submit Proof
                </button>
            )}
        </div>
    );
}

function ActionButton({ label, onClick, primary, danger }: {
    label: string; onClick?: () => void; primary?: boolean; danger?: boolean;
}) {
    const bg = danger ? '#ef444422' : primary ? '#3b82f622' : '#ffffff08';
    const border = danger ? '#ef444444' : primary ? '#3b82f644' : '#333';
    const color = danger ? '#ef4444' : primary ? '#60a5fa' : '#aaa';

    return (
        <button onClick={onClick} style={{
            background: bg, border: `1px solid ${border}`,
            borderRadius: '8px', padding: '8px 16px', color,
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        }}>
            {label}
        </button>
    );
}
