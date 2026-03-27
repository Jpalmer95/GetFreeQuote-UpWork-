import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');
        if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('industry_vertical, subcategory, location, category, user_id')
            .eq('id', jobId)
            .single();

        if (jobError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (job.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: vendors, error: vendorError } = await supabaseAdmin
            .from('vendor_profiles')
            .select('id, user_id, company_name, company_description, service_areas, industries, specialties, is_verified, avg_rating, total_reviews, logo_url')
            .eq('is_verified', true)
            .order('avg_rating', { ascending: false })
            .limit(30);

        if (vendorError || !vendors) {
            return NextResponse.json([]);
        }

        const scored = vendors.map(v => {
            let score = 0;

            const industryMatch = v.industries && Array.isArray(v.industries) &&
                v.industries.some((i: string) => i.toLowerCase() === job.industry_vertical?.toLowerCase());
            if (industryMatch) score += 30;

            const sub = (job.subcategory || job.category || '').toLowerCase();
            const specialtyMatch = v.specialties && Array.isArray(v.specialties) &&
                v.specialties.some((s: string) => s.toLowerCase().includes(sub) || sub.includes(s.toLowerCase()));
            if (specialtyMatch) score += 25;

            if (v.service_areas && Array.isArray(v.service_areas) && job.location) {
                const jobLoc = job.location.toLowerCase();
                if (v.service_areas.some((a: string) => {
                    const aLow = a.toLowerCase();
                    return jobLoc.includes(aLow) || aLow.includes(jobLoc);
                })) {
                    score += 20;
                }
            }

            if (v.avg_rating && v.avg_rating >= 4) score += 15;
            if (v.total_reviews && v.total_reviews >= 5) score += 10;

            return {
                id: v.id,
                company_name: v.company_name,
                company_description: v.company_description,
                service_areas: v.service_areas,
                industries: v.industries,
                specialties: v.specialties,
                is_verified: v.is_verified,
                avg_rating: v.avg_rating,
                total_reviews: v.total_reviews,
                logo_url: v.logo_url,
                score,
            };
        });

        const filtered = scored
            .filter(v => v.score >= 30)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        return NextResponse.json(filtered);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
