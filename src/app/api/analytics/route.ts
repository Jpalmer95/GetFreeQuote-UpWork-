import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!auth) return null;
    const { data: { user } } = await supabase.auth.getUser(auth);
    return user;
}

interface QuoteRow {
    amount: number;
    status: string;
    created_at: string;
    job_id: string;
}

interface JobRow {
    id: string;
    status: string;
    created_at: string;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'platform-stats') {
        const [jobsRes, vendorsRes, quotesRes] = await Promise.all([
            supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('vendor_profiles').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }),
        ]);

        return NextResponse.json({
            totalJobs: jobsRes.count ?? 0,
            totalVendors: vendorsRes.count ?? 0,
            totalQuotes: quotesRes.count ?? 0,
        });
    }

    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'vendor-stats') {
        const { data: quotes } = await supabaseAdmin
            .from('quotes')
            .select('amount, status, created_at, job_id')
            .eq('vendor_id', user.id);

        const allQuotes = (quotes ?? []) as QuoteRow[];
        const totalQuotes = allQuotes.length;
        const acceptedQuotes = allQuotes.filter(q => q.status === 'ACCEPTED');
        const winRate = totalQuotes > 0 ? Math.round((acceptedQuotes.length / totalQuotes) * 100) : 0;
        const avgAmount = totalQuotes > 0
            ? Math.round(allQuotes.reduce((s, q) => s + q.amount, 0) / totalQuotes)
            : 0;
        const revenue = acceptedQuotes.reduce((s, q) => s + q.amount, 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentQuotes = allQuotes.filter(q => new Date(q.created_at) >= thirtyDaysAgo);

        const activityByDay: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            activityByDay[d.toISOString().slice(0, 10)] = 0;
        }
        for (const q of recentQuotes) {
            const day = new Date(q.created_at).toISOString().slice(0, 10);
            if (activityByDay[day] !== undefined) {
                activityByDay[day]++;
            }
        }

        const activity30d = Object.entries(activityByDay).map(([date, count]) => ({
            date,
            count,
        }));

        return NextResponse.json({
            totalQuotes,
            winRate,
            avgAmount,
            revenue,
            acceptedCount: acceptedQuotes.length,
            activity30d,
        });
    }

    if (action === 'client-stats') {
        const { data: jobs } = await supabaseAdmin
            .from('jobs')
            .select('id, status, created_at')
            .eq('user_id', user.id);

        const allJobs = (jobs ?? []) as JobRow[];
        const totalJobs = allJobs.length;

        if (totalJobs === 0) {
            return NextResponse.json({
                totalJobs: 0,
                avgQuotesPerJob: 0,
                totalSpent: 0,
                avgSavings: 0,
                completionRate: 0,
            });
        }

        const jobIds = allJobs.map(j => j.id);
        const { data: quotes } = await supabaseAdmin
            .from('quotes')
            .select('amount, status, job_id')
            .in('job_id', jobIds);

        const allQuotes = (quotes ?? []) as QuoteRow[];
        const avgQuotesPerJob = totalJobs > 0
            ? Math.round((allQuotes.length / totalJobs) * 10) / 10
            : 0;

        const acceptedQuotes = allQuotes.filter(q => q.status === 'ACCEPTED');
        const totalSpent = acceptedQuotes.reduce((s, q) => s + q.amount, 0);

        let avgSavings = 0;
        if (acceptedQuotes.length > 0) {
            let totalSavingsPercent = 0;
            let savingsCount = 0;
            for (const aq of acceptedQuotes) {
                const jobQuotes = allQuotes.filter(q => q.job_id === aq.job_id);
                if (jobQuotes.length >= 2) {
                    const highest = Math.max(...jobQuotes.map(q => q.amount));
                    if (highest > 0 && highest > aq.amount) {
                        totalSavingsPercent += Math.round(((highest - aq.amount) / highest) * 100);
                        savingsCount++;
                    }
                }
            }
            avgSavings = savingsCount > 0 ? Math.round(totalSavingsPercent / savingsCount) : 0;
        }

        const completedJobs = allJobs.filter(j => j.status === 'COMPLETED').length;
        const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

        return NextResponse.json({
            totalJobs,
            avgQuotesPerJob,
            totalSpent,
            avgSavings,
            completionRate,
        });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
