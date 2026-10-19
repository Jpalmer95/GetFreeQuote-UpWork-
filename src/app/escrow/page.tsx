'use client';
import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

interface VerifiableMilestone {
    id: string;
    escrowAccountId: string;
    name: string;
    amount: number;
    status: 'pending' | 'submitted' | 'approved' | 'released' | 'disputed';
    proofDescription?: string;
    proofHash?: string;
    releaseTxHash?: string;
    submittedAt?: string;
    releasedAt?: string;
}

interface VerifiableReceipt {
    id: string;
    seq: number;
    action_type: string;
    amount: number;
    tx_hash?: string;
    prev_hash: string;
    receipt_hash: string;
    signature: string;
    created_at: string;
}

interface VerifiableEscrow {
    id: string;
    jobId: string;
    communityProjectId?: string;
    payerId: string;
    payeeId: string;
    payerWallet?: string;
    payeeWallet?: string;
    chainId: number;
    tokenSymbol: string;
    contractAddress?: string;
    manifestHash: string;
    totalAmount: number;
    fundedAmount: number;
    releasedAmount: number;
    status: string;
    milestones: VerifiableMilestone[];
    receipts: VerifiableReceipt[];
    auditVerification: {
        valid: boolean;
        checkedCount: number;
        headHash: string;
    };
    nonCustodialSpec: {
        protocol: string;
        custodyModel: string;
        platformLiability: string;
        chainName: string;
        explorerTxPrefix: string;
    };
}

export default function EscrowPage() {
    const { user, session } = useAuth();
    const [escrows, setEscrows] = useState<VerifiableEscrow[]>([]);
    const [selected, setSelected] = useState<VerifiableEscrow | null>(null);
    const [loading, setLoading] = useState(true);
    const [proofText, setProofText] = useState<Record<string, string>>({});
    const [releaseTxInput, setReleaseTxInput] = useState<Record<string, string>>({});
    const [depositTxInput, setDepositTxInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    const loadEscrows = useCallback(async (keepId?: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/escrow');
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setEscrows(json.data);
                const target = keepId ? json.data.find((e: VerifiableEscrow) => e.id === keepId) : json.data[0];
                setSelected(target || json.data[0] || null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEscrows();
    }, [loadEscrows]);

    const authHeaders = (): Record<string, string> => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
        return h;
    };

    const handleFund = async () => {
        if (!selected || !session) {
            setNotice({ ok: false, text: 'Sign in to record a non-custodial deposit transaction.' });
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            const res = await fetch('/api/escrow', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'fund',
                    escrowId: selected.id,
                    txHash: depositTxInput.trim() || undefined,
                }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to record deposit');
            setDepositTxInput('');
            setNotice({ ok: true, text: 'Deposit transaction verified and appended to hash chain.' });
            await loadEscrows(selected.id);
        } catch (e: unknown) {
            setNotice({ ok: false, text: e instanceof Error ? e.message : 'Error' });
        } finally {
            setBusy(false);
        }
    };

    const handleSubmitProof = async (milestoneId: string) => {
        if (!selected || !session) {
            setNotice({ ok: false, text: 'Sign in to submit milestone completion proof.' });
            return;
        }
        const desc = (proofText[milestoneId] || '').trim();
        if (!desc) {
            setNotice({ ok: false, text: 'Enter completion proof notes (measurements, inspection pass, photo summary).' });
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            const res = await fetch('/api/escrow', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'submit_proof',
                    milestoneId,
                    proofDescription: desc,
                }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to submit proof');
            setProofText(prev => ({ ...prev, [milestoneId]: '' }));
            setNotice({ ok: true, text: 'Milestone proof hashed (SHA-256) and recorded on the audit chain.' });
            await loadEscrows(selected.id);
        } catch (e: unknown) {
            setNotice({ ok: false, text: e instanceof Error ? e.message : 'Error' });
        } finally {
            setBusy(false);
        }
    };

    const handleApproveRelease = async (milestoneId: string) => {
        if (!selected || !session) {
            setNotice({ ok: false, text: 'Sign in to approve and record milestone release.' });
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            const res = await fetch('/api/escrow', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    action: 'approve_milestone',
                    milestoneId,
                    releaseTxHash: (releaseTxInput[milestoneId] || '').trim() || undefined,
                }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to release milestone');
            setNotice({ ok: true, text: 'Milestone approved & non-custodial payout receipt chained.' });
            await loadEscrows(selected.id);
        } catch (e: unknown) {
            setNotice({ ok: false, text: e instanceof Error ? e.message : 'Error' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: 'var(--background)' }}>
            <Navbar />
            <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '96px 20px 60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0fd98e', marginBottom: '6px' }}>
                            Pattern 2 · Non-Custodial Verifiable Milestone Escrow
                        </div>
                        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>
                            Openly Auditable Milestone Escrow
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', maxWidth: '720px' }}>
                            GetFreeQuote never holds custody of private keys or user funds. Every contract scope, milestone proof, and on-chain settlement is locked into a deterministic SHA-256 manifest and hash-chained receipt log so both payer and contractor can verify every dollar.
                        </p>
                    </div>
                </div>

                {notice && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        marginBottom: '20px',
                        background: notice.ok ? 'rgba(15,217,142,0.12)' : 'rgba(240,92,92,0.15)',
                        border: `1px solid ${notice.ok ? 'rgba(15,217,142,0.35)' : 'rgba(240,92,92,0.4)'}`,
                        color: notice.ok ? '#4ade80' : '#f87171',
                        fontSize: '14px',
                    }}>
                        {notice.text}
                    </div>
                )}

                {loading ? (
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading verifiable escrow accounts…</p>
                ) : (
                    <>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            {escrows.map(e => (
                                <button
                                    key={e.id}
                                    onClick={() => setSelected(e)}
                                    style={{
                                        background: selected?.id === e.id ? 'rgba(79,142,247,0.16)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${selected?.id === e.id ? '#4f8ef7' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '12px',
                                        padding: '14px 18px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        minWidth: '240px',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                                            ${e.totalAmount.toLocaleString()} {e.tokenSymbol}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(15,217,142,0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                            {e.nonCustodialSpec.chainName}
                                        </span>
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>
                                        {e.status.replace('_', ' ')} · {e.milestones.filter(m => m.status === 'released').length}/{e.milestones.length} milestones released
                                    </div>
                                </button>
                            ))}
                        </div>

                        {selected && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                {/* Cryptographic Manifest & Non-Custodial Spec Card */}
                                <div className="glass-panel" style={{ padding: '22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                                                Cryptographic Escrow Manifest & Custody Proof
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                                                {selected.nonCustodialSpec.protocol} · {selected.nonCustodialSpec.platformLiability}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '999px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            background: selected.auditVerification.valid ? 'rgba(15,217,142,0.15)' : 'rgba(240,92,92,0.2)',
                                            color: selected.auditVerification.valid ? '#4ade80' : '#f87171',
                                            border: '1px solid rgba(15,217,142,0.35)',
                                        }}>
                                            {selected.auditVerification.valid
                                                ? `✓ SHA-256 Chain Verified (${selected.milestones.filter(m => m.status !== 'pending').length} proofs)`
                                                : '⚠ Chain Mismatch'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Total Escrowed Scope</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>${selected.totalAmount.toLocaleString()} {selected.tokenSymbol}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Verified Funded</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#4f8ef7' }}>${selected.fundedAmount.toLocaleString()} {selected.tokenSymbol}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Released on Proof</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0fd98e' }}>${selected.releasedAmount.toLocaleString()} {selected.tokenSymbol}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Remaining Locked</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5a623' }}>${Math.max(0, selected.fundedAmount - selected.releasedAmount).toLocaleString()} {selected.tokenSymbol}</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', display: 'grid', gap: '6px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', padding: '12px', borderRadius: '8px' }}>
                                        <div><strong>Manifest SHA-256:</strong> 0x{selected.manifestHash}</div>
                                        <div><strong>Escrow Vault / Contract:</strong> {selected.contractAddress || 'Direct Non-Custodial Settlement'} ({selected.nonCustodialSpec.chainName})</div>
                                        <div><strong>Payer Wallet:</strong> {selected.payerWallet || 'Not linked'} → <strong>Contractor Wallet:</strong> {selected.payeeWallet || 'Not linked'}</div>
                                    </div>

                                    {selected.fundedAmount < selected.totalAmount && (
                                        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <input
                                                className="field-input"
                                                placeholder="Paste Base/USDC deposit tx hash (0x...) or leave blank to auto-stamp receipt"
                                                value={depositTxInput}
                                                onChange={e => setDepositTxInput(e.target.value)}
                                                style={{ flex: 1, minWidth: '240px' }}
                                            />
                                            <button className="btn-primary" disabled={busy} onClick={handleFund}>
                                                Record Deposit & Lock Scope
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Milestones & Verifiable Proof Workflow */}
                                <div className="glass-panel" style={{ padding: '22px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                                        Milestone Verification & Direct Release Schedule
                                    </h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {selected.milestones.map((m) => (
                                            <div key={m.id} style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>{m.name}</div>
                                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                                                            ${m.amount.toLocaleString()} {selected.tokenSymbol} · Status: <strong>{m.status.toUpperCase()}</strong>
                                                        </div>
                                                    </div>
                                                    <span className={`badge ${m.status === 'released' ? 'badge-green' : m.status === 'submitted' ? 'badge-amber' : 'badge-blue'}`}>
                                                        {m.status}
                                                    </span>
                                                </div>

                                                {m.proofDescription && (
                                                    <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                                                        <div><strong>Contractor Proof:</strong> {m.proofDescription}</div>
                                                        {m.proofHash && (
                                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                                                                Proof SHA-256: 0x{m.proofHash}
                                                            </div>
                                                        )}
                                                        {m.releaseTxHash && (
                                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4ade80', marginTop: '4px' }}>
                                                                Settlement TX: {m.releaseTxHash}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {user && m.status === 'pending' && (
                                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <input
                                                            className="field-input"
                                                            placeholder="Describe completed work / inspection pass to generate SHA-256 proof..."
                                                            value={proofText[m.id] || ''}
                                                            onChange={e => setProofText(prev => ({ ...prev, [m.id]: e.target.value }))}
                                                            style={{ flex: 1, minWidth: '240px' }}
                                                        />
                                                        <button className="btn-secondary" disabled={busy} onClick={() => handleSubmitProof(m.id)}>
                                                            Submit Verifiable Proof
                                                        </button>
                                                    </div>
                                                )}

                                                {user && m.status === 'submitted' && (
                                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <input
                                                            className="field-input"
                                                            placeholder="Optional on-chain release tx hash (0x...)"
                                                            value={releaseTxInput[m.id] || ''}
                                                            onChange={e => setReleaseTxInput(prev => ({ ...prev, [m.id]: e.target.value }))}
                                                            style={{ flex: 1, minWidth: '220px' }}
                                                        />
                                                        <button className="btn-primary" disabled={busy} onClick={() => handleApproveRelease(m.id)}>
                                                            Approve Proof & Release ${m.amount.toLocaleString()}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
