'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import EscrowDashboard from '@/components/EscrowDashboard';
import { EscrowAccount, EscrowMilestone } from '@/types';

// Mock data for demo
const MOCK_ESCROW: EscrowAccount = {
    id: 'esc_001',
    jobId: 'job_001',
    quoteId: 'quote_001',
    payerId: 'user_001',
    payeeId: 'vendor_001',
    totalAmount: 5000,
    fundedAmount: 5000,
    releasedAmount: 2000,
    status: 'partial_released',
    milestones: [
        { id: 'm1', escrowAccountId: 'esc_001', name: 'Demo & Prep Complete', amount: 1500, status: 'released', releasedAt: '2026-04-10T00:00:00Z', approvedBy: 'user_001' },
        { id: 'm2', escrowAccountId: 'esc_001', name: 'Rough-In Complete', amount: 1500, status: 'submitted', proofDescription: 'All plumbing roughed in, ready for inspection', submittedAt: '2026-04-15T00:00:00Z' },
        { id: 'm3', escrowAccountId: 'esc_001', name: 'Final Inspection & Completion', amount: 2000, status: 'pending' },
    ],
    createdAt: '2026-04-01T00:00:00Z',
    fundedAt: '2026-04-02T00:00:00Z',
};

export default function EscrowPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [escrows, setEscrows] = useState<EscrowAccount[]>([MOCK_ESCROW]);
    const [selectedEscrow, setSelectedEscrow] = useState<EscrowAccount | null>(MOCK_ESCROW);
    const [userRole, setUserRole] = useState<'payer' | 'payee'>('payer');

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user]);

    return (
        <main style={{ minHeight: '100vh', background: '#0f0f1a' }}>
            <Navbar />
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
                <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                    🔒 Escrow Protection
                </h1>
                <p style={{ color: '#888', marginBottom: '24px' }}>
                    Secure milestone-based payments for your projects
                </p>

                {/* Escrow List */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {escrows.map(e => (
                        <button key={e.id} onClick={() => setSelectedEscrow(e)} style={{
                            background: selectedEscrow?.id === e.id ? '#3b82f622' : '#1a1a2e',
                            border: `1px solid ${selectedEscrow?.id === e.id ? '#3b82f6' : '#333'}`,
                            borderRadius: '10px', padding: '12px 16px', cursor: 'pointer',
                            textAlign: 'left', minWidth: '200px',
                        }}>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                                ${e.totalAmount.toLocaleString()}
                            </div>
                            <div style={{ color: '#888', fontSize: '11px' }}>
                                {e.status} · {e.milestones.length} milestones
                            </div>
                        </button>
                    ))}
                </div>

                {/* Role Toggle */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: '#888', fontSize: '12px', marginRight: '8px' }}>Viewing as:</label>
                    <select value={userRole} onChange={e => setUserRole(e.target.value as any)} style={{
                        background: '#333', border: '1px solid #444', borderRadius: '6px',
                        padding: '6px 10px', color: '#ddd', fontSize: '12px',
                    }}>
                        <option value="payer">Payer (Customer)</option>
                        <option value="payee">Payee (Vendor)</option>
                    </select>
                </div>

                {/* Escrow Dashboard */}
                {selectedEscrow && (
                    <EscrowDashboard
                        escrow={selectedEscrow}
                        userRole={userRole}
                        onFund={() => alert('Fund escrow - integrate Stripe')}
                        onApproveMilestone={(id) => alert(`Approve milestone ${id}`)}
                        onDispute={() => alert('File dispute')}
                        onSubmitProof={(id) => alert(`Submit proof for ${id}`)}
                    />
                )}
            </div>
        </main>
    );
}
