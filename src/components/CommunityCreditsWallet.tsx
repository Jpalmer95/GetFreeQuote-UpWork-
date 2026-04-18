'use client';
import { CommunityCredits } from '@/types';
import { getCreditSummary, creditsToDollars } from '@/services/communityCredits';

interface CommunityCreditsWalletProps {
    credits: CommunityCredits;
    onRedeem?: (amount: number) => void;
}

export default function CommunityCreditsWallet({ credits, onRedeem }: CommunityCreditsWalletProps) {
    const summary = getCreditSummary(credits);

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1a2332 0%, #1a1a2e 100%)',
            borderRadius: '16px', padding: '20px', border: '1px solid #2a3a4e',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🌟</span>
                <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>Community Credits</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Earn by volunteering, spend on projects</div>
                </div>
            </div>

            {/* Balance */}
            <div style={{
                background: '#ffffff08', borderRadius: '12px', padding: '20px',
                textAlign: 'center', marginBottom: '16px',
            }}>
                <div style={{ fontSize: '40px', fontWeight: 700, color: '#f59e0b' }}>
                    {summary.balance}
                </div>
                <div style={{ fontSize: '14px', color: '#aaa' }}>
                    credits = <span style={{ color: '#22c55e', fontWeight: 600 }}>${summary.dollarValue} value</span>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <StatCard label="Total Earned" value={String(summary.totalEarned)} icon="📈" />
                <StatCard label="Total Spent" value={String(summary.totalSpent)} icon="🎁" />
                <StatCard label="Volunteer Hours" value={String(summary.totalVolunteerHours)} icon="⏰" />
            </div>

            {/* Expiration Warning */}
            {summary.nextExpiration && (
                <div style={{
                    background: '#f59e0b11', border: '1px solid #f59e0b33',
                    borderRadius: '8px', padding: '10px 12px', marginBottom: '16px',
                    fontSize: '12px', color: '#f59e0b',
                }}>
                    ⏳ {summary.nextExpiration.amount} credits expire {new Date(summary.nextExpiration.date).toLocaleDateString()}
                </div>
            )}

            {/* Quick Redeem */}
            {summary.balance > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Quick Redeem:</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[10, 25, 50].filter(amt => amt <= summary.balance).map(amt => (
                            <button
                                key={amt}
                                onClick={() => onRedeem?.(amt)}
                                style={{
                                    flex: 1, padding: '8px', background: '#22c55e22',
                                    border: '1px solid #22c55e44', borderRadius: '8px',
                                    color: '#22c55e', fontSize: '12px', cursor: 'pointer',
                                }}
                            >
                                {amt} credits<br />
                                <span style={{ fontSize: '10px', color: '#888' }}>
                                    = ${creditsToDollars(amt)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent History */}
            {credits.history.length > 0 && (
                <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Recent Activity:</div>
                    {credits.history.slice(-5).reverse().map(tx => (
                        <div key={tx.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 0', borderBottom: '1px solid #ffffff06',
                        }}>
                            <div>
                                <div style={{ fontSize: '12px', color: '#ddd' }}>{tx.description}</div>
                                <div style={{ fontSize: '10px', color: '#666' }}>
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <span style={{
                                fontSize: '13px', fontWeight: 600,
                                color: tx.amount > 0 ? '#22c55e' : '#ef4444',
                            }}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* How to Earn */}
            <div style={{
                marginTop: '16px', padding: '12px', background: '#ffffff06',
                borderRadius: '8px',
            }}>
                <div style={{ fontSize: '12px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>
                    💡 How to Earn Credits:
                </div>
                <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.6 }}>
                    • Volunteer on community projects (1-2 credits/hour)<br />
                    • Refer new users (5 credits per referral)<br />
                    • Organize neighborhood pools (bonus credits)
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
    return (
        <div style={{
            background: '#ffffff06', borderRadius: '8px', padding: '10px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '16px', marginBottom: '2px' }}>{icon}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{value}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>{label}</div>
        </div>
    );
}
