import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceCatalog } from '@/services/marketplaceCatalog';

export const dynamic = 'force-dynamic';

/**
 * Public agent catalog — no auth.
 * GET /api/discover?q=&industry=&urgency=&location=&lat=&lng=&radiusMiles=&include=jobs,listings,community
 */
export async function GET(request: NextRequest) {
    try {
        const sp = new URL(request.url).searchParams;
        const includeRaw = (sp.get('include') || 'jobs,listings,community').split(',').map(s => s.trim());
        const include = includeRaw.filter((s): s is 'jobs' | 'listings' | 'community' =>
            s === 'jobs' || s === 'listings' || s === 'community'
        );
        const lat = sp.get('lat') ? Number(sp.get('lat')) : undefined;
        const lng = sp.get('lng') ? Number(sp.get('lng')) : undefined;

        const catalog = await getMarketplaceCatalog({
            q: sp.get('q') || undefined,
            industry: sp.get('industry') || undefined,
            urgency: sp.get('urgency') || undefined,
            location: sp.get('location') || undefined,
            lat: Number.isFinite(lat) ? lat : undefined,
            lng: Number.isFinite(lng) ? lng : undefined,
            radiusMiles: sp.get('radiusMiles') ? Number(sp.get('radiusMiles')) : undefined,
            include,
            limit: sp.get('limit') ? Number(sp.get('limit')) : 20,
        });

        return NextResponse.json({
            success: true,
            platform: 'GetFreeQuote',
            docs: {
                llms: 'https://getfreequote.org/llms.txt',
                mcp: 'https://getfreequote.org/api/mcp',
                wellKnown: 'https://getfreequote.org/.well-known/mcp.json',
                connect: 'https://getfreequote.org/connect',
            },
            ...catalog,
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=30',
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Discover failed';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
