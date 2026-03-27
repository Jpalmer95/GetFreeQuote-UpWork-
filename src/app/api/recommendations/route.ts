import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');
        if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('industry_vertical, subcategory, location, category')
            .eq('id', jobId)
            .single();

        if (jobError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        let query = supabaseAdmin
            .from('vendor_profiles')
            .select('id, user_id, company_name, company_description, contact_email, service_areas, industries, specialties, certifications, is_verified, avg_rating, total_reviews, logo_url')
            .order('avg_rating', { ascending: false })
            .limit(20);

        const { data: vendors, error: vendorError } = await query;
        if (vendorError || !vendors) {
            return NextResponse.json([]);
        }

        const scored = vendors.map(v => {
            let score = 0;

            if (v.industries && Array.isArray(v.industries)) {
                if (v.industries.some((i: string) => i.toLowerCase() === job.industry_vertical?.toLowerCase())) {
                    score += 30;
                }
            }

            if (v.specialties && Array.isArray(v.specialties)) {
                const sub = (job.subcategory || job.category || '').toLowerCase();
                if (v.specialties.some((s: string) => s.toLowerCase().includes(sub) || sub.includes(s.toLowerCase()))) {
                    score += 25;
                }
            }

            if (v.service_areas && Array.isArray(v.service_areas) && job.location) {
                const jobLoc = job.location.toLowerCase();
                if (v.service_areas.some((a: string) => {
                    const aLow = a.toLowerCase();
                    return jobLoc.includes(aLow) || aLow.includes(jobLoc);
                })) {
                    score += 20;
                }
            }

            if (v.is_verified) score += 15;
            if (v.avg_rating && v.avg_rating >= 4) score += 10;

            return { ...v, score };
        });

        const filtered = scored
            .filter(v => v.score >= 15)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        return NextResponse.json(filtered);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
