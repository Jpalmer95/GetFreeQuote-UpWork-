'use client';
import { useState } from 'react';

interface ReferralCardProps {
    userId: string;
    referralCount: number;
    creditsEarned: number;
}

export default function ReferralCard({ userId, referralCount, creditsEarned }: ReferralCardProps) {
    const [copied, setCopied] = useState(false);
    const referralLink = `https://getfreequote.org/join?ref=${userId}`;

    const copyLink = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1a2332 0%, #1a1a2e 100%)',
            borderRadius: '16px', padding: '24px', border: '1px solid #2a3a4e',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>🎁</span>
                <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '20px' }}>Refer & Earn</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>Share GetFreeQuote, earn credits</div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                    background: '#ffffff08', borderRadius: '10px', padding: '16px', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{referralCount}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Referrals</div>
                </div>
                <div style={{
                    background: '#ffffff08', borderRadius: '10px', padding: '16px', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{creditsEarned}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>Credits Earned</div>
                </div>
            </div>

            {/* Referral Link */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                    Your Referral Link
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={referralLink}
                        readOnly
                        style={{
                            flex: 1, padding: '10px 12px', background: '#333',
                            border: '1px solid #444', borderRadius: '8px',
                            color: '#aaa', fontSize: '13px',
                        }}
                    />
                    <button onClick={copyLink} style={{
                        padding: '10px 16px', background: copied ? '#22c55e' : '#3b82f6',
                        border: 'none', borderRadius: '8px', color: '#fff',
                        fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                        {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Reward Tiers */}
            <div style={{ fontSize: '12px', color: '#888' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: '#aaa' }}>Reward Tiers:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>👥 Refer a vendor who completes a job: <span style={{ color: '#22c55e' }}>25 credits ($25)</span></div>
                    <div>👤 Refer a user who posts a job: <span style={{ color: '#22c55e' }}>10 credits ($10)</span></div>
                    <div>⭐ Refer 5 vendors: <span style={{ color: '#f59e0b' }}>Free Pro tier for 1 year</span></div>
                    <div>🏆 Refer 10 vendors: <span style={{ color: '#d4a843' }}>Free Elite tier for 1 year</span></div>
                </div>
            </div>

            {/* Share Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out GetFreeQuote.org - AI-powered contractor marketplace. ' + referralLink)}`)} style={{
                    flex: 1, padding: '10px', background: '#1da1f222',
                    border: '1px solid #1da1f244', borderRadius: '8px',
                    color: '#1da1f2', fontSize: '12px', cursor: 'pointer',
                }}>
                    Share on X
                </button>
                <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`)} style={{
                    flex: 1, padding: '10px', background: '#4267b222',
                    border: '1px solid #4267b244', borderRadius: '8px',
                    color: '#4267b2', fontSize: '12px', cursor: 'pointer',
                }}>
                    Share on Facebook
                </button>
            </div>
        </div>
    );
}
