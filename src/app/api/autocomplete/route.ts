import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CATEGORY_SUGGESTIONS = [
    'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'Painting', 'Landscaping', 'Cleaning',
    'General Contracting', 'Concrete & Foundation', 'Steel & Framing', 'Interior Finish',
    'Delivery', 'Moving & Hauling', 'Assembly', 'Photography', 'Videography',
    'Catering', 'Event Planning', 'Welding', 'Carpentry', 'Masonry', 'Tile Work',
    'Web Development', 'App Development', 'IT Support', 'Consulting', 'Design',
    'Marketing', 'Accounting', 'Architecture', 'Engineering',
];

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').toLowerCase().trim();

        if (q.length < 2) {
            return NextResponse.json([]);
        }

        const categoryMatches = CATEGORY_SUGGESTIONS
            .filter(c => c.toLowerCase().includes(q))
            .slice(0, 3)
            .map(c => ({ type: 'category', value: c }));

        const { data: locationRows } = await supabaseAdmin
            .from('jobs')
            .select('location')
            .ilike('location', `%${q}%`)
            .limit(50);

        const uniqueLocations = [...new Set((locationRows || []).map(r => r.location))];
        const locationMatches = uniqueLocations
            .slice(0, 3)
            .map(l => ({ type: 'location', value: l }));

        const { data: tagRows } = await supabaseAdmin
            .from('jobs')
            .select('tags')
            .limit(100);

        let tagMatches: { type: string; value: string }[] = [];
        if (tagRows) {
            const allTags = tagRows.flatMap(r => r.tags || []);
            const unique = [...new Set(allTags)];
            tagMatches = unique
                .filter(t => t.toLowerCase().includes(q))
                .slice(0, 3)
                .map(t => ({ type: 'tag', value: t }));
        }

        const results = [...categoryMatches, ...locationMatches, ...tagMatches].slice(0, 6);
        return NextResponse.json(results);
    } catch {
        return NextResponse.json([]);
    }
}
