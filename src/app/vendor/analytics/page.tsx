'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import VendorAnalyticsDashboard from '@/components/VendorAnalyticsDashboard';
import { VendorAnalytics, AreaBenchmark } from '@/types';

const MOCK_ANALYTICS: VendorAnalytics = {
    vendorId: 'v1', period: 'month', periodStart: '2026-03-18T00:00:00Z', periodEnd: '2026-04-18T00:00:00Z',
    jobsCompleted: 12, jobsWon: 8, jobsBid: 18, winRate: 0.444,
    avgBidAmount: 4250, avgMarketRate: 4800, bidVsMarketRatio: 0.885,
    avgResponseTimeMinutes: 35, responseTimePercentile: 78,
    avgRating: 4.7, ratingTrend: 'improving',
    revenueTotal: 51000, revenuePerJob: 4250,
    repeatCustomerRate: 0.25, totalCustomers: 32, topCategories: [
        { category: 'Plumbing', count: 8, winRate: 0.5 },
        { category: 'HVAC', count: 5, winRate: 0.4 },
        { category: 'Home Services', count: 5, winRate: 0.4 },
    ],
    customerSatisfactionScore: 87, onTimeCompletionRate: 0.92, disputeRate: 0.02,
};

const MOCK_BENCHMARKS: AreaBenchmark[] = [
    { category: 'Plumbing', area: 'Portland OR', avgBidAmount: 4500, medianBidAmount: 4200, avgRating: 4.3, avgResponseTimeMinutes: 65, vendorCount: 45, jobsPerMonth: 120, calculatedAt: '2026-04-18T00:00:00Z' },
    { category: 'HVAC', area: 'Portland OR', avgBidAmount: 5200, medianBidAmount: 4800, avgRating: 4.2, avgResponseTimeMinutes: 75, vendorCount: 30, jobsPerMonth: 80, calculatedAt: '2026-04-18T00:00:00Z' },
];

export default function VendorAnalyticsPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user]);

    return (
        <main style={{ minHeight: '100vh', background: '#0f0f1a' }}>
            <Navbar />
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
                <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                    📊 Vendor Analytics
                </h1>
                <p style={{ color: '#888', marginBottom: '24px' }}>
                    Track your performance, win rate, and competitive position
                </p>

                <VendorAnalyticsDashboard analytics={MOCK_ANALYTICS} benchmarks={MOCK_BENCHMARKS} />
            </div>
        </main>
    );
}
