'use client';
import { VendorAnalytics, AreaBenchmark } from '@/types';
import { generateCompetitiveInsights } from '@/services/vendorAnalytics';

interface VendorAnalyticsDashboardProps {
    analytics: VendorAnalytics;
    benchmarks?: AreaBenchmark[];
}

export default function VendorAnalyticsDashboard({ analytics, benchmarks = [] }: VendorAnalyticsDashboardProps) {
    const insights = generateCompetitiveInsights(analytics, benchmarks);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{
                background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                border: '1px solid #333',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>
                            📊 Performance Dashboard
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            {analytics.period.replace('_', ' ')} · {new Date(analytics.periodStart).toLocaleDateString()} - {new Date(analytics.periodEnd).toLocaleDateString()}
                        </div>
                    </div>
                    <PeriodSelector current={analytics.period} />
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <MetricCard
                        label="Win Rate"
                        value={`${Math.round(analytics.winRate * 100)}%`}
                        icon="🏆"
                        color={analytics.winRate > 0.3 ? '#22c55e' : '#f59e0b'}
                    />
                    <MetricCard
                        label="Avg Rating"
                        value={`${analytics.avgRating}/5`}
                        icon="⭐"
                        color={analytics.avgRating >= 4 ? '#22c55e' : '#f59e0b'}
                        subtitle={analytics.ratingTrend === 'improving' ? '↑ Improving' : analytics.ratingTrend === 'declining' ? '↓ Declining' : '→ Stable'}
                    />
                    <MetricCard
                        label="Revenue"
                        value={`$${(analytics.revenueTotal / 1000).toFixed(1)}K`}
                        icon="💰"
                        color="#3b82f6"
                        subtitle={`$${analytics.revenuePerJob.toLocaleString()}/job`}
                    />
                    <MetricCard
                        label="Response"
                        value={`${analytics.avgResponseTimeMinutes}min`}
                        icon="⚡"
                        color={analytics.avgResponseTimeMinutes < 60 ? '#22c55e' : '#f59e0b'}
                        subtitle={`${analytics.responseTimePercentile}th percentile`}
                    />
                </div>
            </div>

            {/* Competitive Insights */}
            <div style={{
                background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                border: '1px solid #333',
            }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                    💡 Competitive Insights
                </div>

                {insights.strengths.length > 0 && (
                    <InsightSection title="Strengths" items={insights.strengths} color="#22c55e" icon="✅" />
                )}
                {insights.opportunities.length > 0 && (
                    <InsightSection title="Opportunities" items={insights.opportunities} color="#3b82f6" icon="💡" />
                )}
                {insights.alerts.length > 0 && (
                    <InsightSection title="Alerts" items={insights.alerts} color="#ef4444" icon="⚠️" />
                )}
            </div>

            {/* Bid vs Market */}
            <div style={{
                background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                border: '1px solid #333',
            }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                    💵 Pricing Position
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: '#888' }}>Your Avg Bid</span>
                            <span style={{ fontSize: '12px', color: '#fff' }}>${analytics.avgBidAmount.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '8px', background: '#333', borderRadius: '4px', position: 'relative' }}>
                            <div style={{
                                position: 'absolute', height: '100%',
                                width: `${Math.min(100, analytics.bidVsMarketRatio * 50)}%`,
                                background: analytics.bidVsMarketRatio < 0.9 ? '#22c55e' : analytics.bidVsMarketRatio > 1.1 ? '#ef4444' : '#f59e0b',
                                borderRadius: '4px',
                            }} />
                            <div style={{
                                position: 'absolute', left: '50%', top: '-4px',
                                width: '2px', height: '16px', background: '#fff',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ fontSize: '10px', color: '#22c55e' }}>Below Market</span>
                            <span style={{ fontSize: '10px', color: '#888' }}>Market: ${analytics.avgMarketRate.toLocaleString()}</span>
                            <span style={{ fontSize: '10px', color: '#ef4444' }}>Above Market</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Performance */}
            <div style={{
                background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                border: '1px solid #333',
            }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                    🏷️ Top Categories
                </div>
                {analytics.topCategories.map((cat, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', background: '#ffffff06', borderRadius: '8px',
                        marginBottom: '6px',
                    }}>
                        <span style={{ color: '#ddd', fontSize: '13px' }}>{cat.category}</span>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#888' }}>{cat.count} bids</span>
                            <span style={{
                                fontSize: '12px', fontWeight: 600,
                                color: cat.winRate > 0.3 ? '#22c55e' : '#f59e0b',
                            }}>
                                {Math.round(cat.winRate * 100)}% win
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Customer Metrics */}
            <div style={{
                background: '#1a1a2e', borderRadius: '16px', padding: '20px',
                border: '1px solid #333',
            }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                    👥 Customer Metrics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <ProgressBar label="Repeat Customers" value={analytics.repeatCustomerRate * 100} suffix="%" />
                    <ProgressBar label="On-Time Completion" value={analytics.onTimeCompletionRate * 100} suffix="%" />
                    <ProgressBar label="Satisfaction Score" value={analytics.customerSatisfactionScore} suffix="/100" />
                    <ProgressBar label="Dispute Rate" value={analytics.disputeRate * 100} suffix="%" invert />
                </div>
            </div>
        </div>
    );
}

function PeriodSelector({ current }: { current: string }) {
    const periods = ['week', 'month', 'quarter', 'year'];
    return (
        <div style={{ display: 'flex', gap: '4px', background: '#333', borderRadius: '8px', padding: '2px' }}>
            {periods.map(p => (
                <button key={p} style={{
                    background: current === p ? '#3b82f6' : 'transparent',
                    border: 'none', borderRadius: '6px', padding: '4px 10px',
                    color: current === p ? '#fff' : '#888', fontSize: '11px',
                    cursor: 'pointer', textTransform: 'capitalize',
                }}>
                    {p}
                </button>
            ))}
        </div>
    );
}

function MetricCard({ label, value, icon, color, subtitle }: {
    label: string; value: string; icon: string; color: string; subtitle?: string;
}) {
    return (
        <div style={{
            background: '#ffffff06', borderRadius: '12px', padding: '14px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{label}</div>
            {subtitle && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{subtitle}</div>}
        </div>
    );
}

function InsightSection({ title, items, color, icon }: {
    title: string; items: string[]; color: string; icon: string;
}) {
    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color, fontWeight: 600, marginBottom: '6px' }}>
                {icon} {title}
            </div>
            {items.map((item, i) => (
                <div key={i} style={{
                    fontSize: '12px', color: '#aaa', padding: '4px 0 4px 20px',
                    borderLeft: `2px solid ${color}44`,
                }}>
                    {item}
                </div>
            ))}
        </div>
    );
}

function ProgressBar({ label, value, suffix, invert }: {
    label: string; value: number; suffix: string; invert?: boolean;
}) {
    const pct = Math.min(100, Math.max(0, value));
    const color = invert
        ? (pct < 5 ? '#22c55e' : pct < 10 ? '#f59e0b' : '#ef4444')
        : (pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444');

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>{label}</span>
                <span style={{ fontSize: '11px', color }}>{Math.round(value)}{suffix}</span>
            </div>
            <div style={{ height: '6px', background: '#333', borderRadius: '3px' }}>
                <div style={{
                    height: '100%', width: `${pct}%`, background: color,
                    borderRadius: '3px', transition: 'width 0.5s',
                }} />
            </div>
        </div>
    );
}
