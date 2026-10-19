import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeIlike } from '@/lib/safeEval';
import { workKindFromTags } from '@/lib/workKind';

export interface CatalogFilters {
    q?: string;
    industry?: string;
    urgency?: string;
    location?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    include?: Array<'jobs' | 'listings' | 'community'>;
    limit?: number;
}

export interface CatalogJob {
    id: string;
    title: string;
    category: string;
    industry: string | null;
    subcategory: string | null;
    location: string;
    urgency: string | null;
    budget: string | null;
    workKind: 'quote' | 'bounty' | 'local';
    createdAt: string;
    url: string;
    kind: 'job';
}

export interface CatalogListing {
    id: string;
    title: string;
    category: string;
    listingType: string;
    location: string;
    sellPrice: number | null;
    rentPricePerDay: number | null;
    createdAt: string;
    url: string;
    kind: 'jit';
}

export interface CatalogCommunity {
    id: string;
    title: string;
    category: string;
    location: string;
    goalAmount: number | null;
    currentFunding: number | null;
    status: string;
    createdAt: string;
    url: string;
    kind: 'community';
}

function origin(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://getfreequote.org';
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

export async function getMarketplaceCatalog(filters: CatalogFilters = {}) {
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const include = new Set(filters.include && filters.include.length > 0 ? filters.include : ['jobs', 'listings', 'community']);
    const q = sanitizeIlike(filters.q || '');
    const hasGeo = Number.isFinite(filters.lat) && Number.isFinite(filters.lng);
    const radius = Math.min(100, Math.max(1, filters.radiusMiles || 25));
    const base = origin();

    const result: {
        fetchedAt: string;
        jobs: CatalogJob[];
        listings: CatalogListing[];
        community: CatalogCommunity[];
    } = {
        fetchedAt: new Date().toISOString(),
        jobs: [],
        listings: [],
        community: [],
    };

    if (include.has('jobs')) {
        let query = supabaseAdmin
            .from('jobs')
            .select('id, title, category, industry_vertical, subcategory, location, urgency, budget, created_at, location_lat, location_lng, is_public, status, tags, is_local_request')
            .eq('is_public', true)
            .eq('status', 'OPEN')
            .order('created_at', { ascending: false })
            .limit(100);

        if (filters.industry) query = query.eq('industry_vertical', filters.industry);
        if (filters.urgency) query = query.eq('urgency', filters.urgency);
        if (filters.location) query = query.ilike('location', `%${sanitizeIlike(filters.location)}%`);
        if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);

        const { data } = await query;
        let rows = (data || []) as Record<string, unknown>[];
        if (hasGeo) {
            rows = rows.filter(r => {
                const lat = Number(r.location_lat);
                const lng = Number(r.location_lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
                return haversineMiles(filters.lat as number, filters.lng as number, lat, lng) <= radius;
            });
        }
        result.jobs = rows.slice(0, limit).map(r => ({
            id: r.id as string,
            title: r.title as string,
            category: (r.category as string) || 'Other',
            industry: (r.industry_vertical as string) || null,
            subcategory: (r.subcategory as string) || null,
            location: (r.location as string) || '',
            urgency: (r.urgency as string) || null,
            budget: (r.budget as string) || null,
            workKind: workKindFromTags((r.tags as string[]) || [], r.is_local_request as boolean | null),
            createdAt: String(r.created_at || ''),
            url: `${base}/jobs/${r.id}`,
            kind: 'job' as const,
        }));
    }

    if (include.has('listings')) {
        let query = supabaseAdmin
            .from('item_listings')
            .select('id, item_name, category, listing_type, location_text, sell_price, rent_price_per_day, created_at, location_lat, location_lng, is_active, status')
            .eq('is_active', true)
            .eq('status', 'AVAILABLE')
            .order('created_at', { ascending: false })
            .limit(100);
        if (q) query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%`);
        const { data } = await query;
        let rows = (data || []) as Record<string, unknown>[];
        if (hasGeo) {
            rows = rows.filter(r => {
                const lat = Number(r.location_lat);
                const lng = Number(r.location_lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
                return haversineMiles(filters.lat as number, filters.lng as number, lat, lng) <= radius;
            });
        }
        result.listings = rows.slice(0, limit).map(r => ({
            id: r.id as string,
            title: r.item_name as string,
            category: (r.category as string) || 'Tool',
            listingType: (r.listing_type as string) || 'RENT',
            location: (r.location_text as string) || '',
            sellPrice: r.sell_price != null ? Number(r.sell_price) : null,
            rentPricePerDay: r.rent_price_per_day != null ? Number(r.rent_price_per_day) : null,
            createdAt: String(r.created_at || ''),
            url: `${base}/jit`,
            kind: 'jit' as const,
        }));
    }

    if (include.has('community')) {
        let query = supabaseAdmin
            .from('community_projects')
            .select('id, title, category, location, goal_amount, current_funding, status, created_at')
            .in('status', ['ACTIVE', 'FUNDED'])
            .order('created_at', { ascending: false })
            .limit(limit);
        if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
        const { data } = await query;
        result.community = ((data || []) as Record<string, unknown>[]).map(r => ({
            id: r.id as string,
            title: r.title as string,
            category: (r.category as string) || 'Other',
            location: (r.location as string) || '',
            goalAmount: r.goal_amount != null ? Number(r.goal_amount) : null,
            currentFunding: r.current_funding != null ? Number(r.current_funding) : null,
            status: r.status as string,
            createdAt: String(r.created_at || ''),
            url: `${base}/community/${r.id}`,
            kind: 'community' as const,
        }));
    }

    return result;
}
