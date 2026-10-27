import { supabase } from '@/lib/supabase';

/**
 * Live job updates — the append-only clarification log shown on the public job page.
 *
 * This is the mechanism behind "change a detail once and it reaches everyone":
 * the owner (or their agent) appends an update, it renders on the job page for every
 * bidder, and /api/jobs/[id]/updates fans it out to every open bid thread.
 */

export type JobUpdateKind = 'clarification' | 'scope_change' | 'schedule' | 'media' | 'status';

export interface JobUpdate {
    id: string;
    jobId: string;
    authorId?: string;
    authorName?: string;
    kind: JobUpdateKind;
    body: string;
    attachments: string[];
    createdAt: string;
}

export const UPDATE_KIND_LABEL: Record<JobUpdateKind, string> = {
    clarification: 'Clarification',
    scope_change: 'Scope change',
    schedule: 'Schedule',
    media: 'New media',
    status: 'Status',
};

function mapRow(row: Record<string, unknown>): JobUpdate {
    let attachments: string[] = [];
    const raw = row.attachments;
    if (Array.isArray(raw)) attachments = raw.map(String);
    else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) attachments = parsed.map(String);
        } catch {
            /* ignore malformed json */
        }
    }
    return {
        id: String(row.id),
        jobId: String(row.job_id),
        authorId: row.author_id ? String(row.author_id) : undefined,
        authorName: row.author_name ? String(row.author_name) : undefined,
        kind: ((row.kind as JobUpdateKind) || 'clarification'),
        body: String(row.body || ''),
        attachments,
        createdAt: String(row.created_at),
    };
}

export async function listJobUpdates(jobId: string): Promise<JobUpdate[]> {
    const { data, error } = await supabase
        .from('job_updates')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(mapRow);
}

export async function addJobUpdate(
    jobId: string,
    token: string,
    input: { body: string; kind?: JobUpdateKind; attachments?: string[] },
): Promise<{ ok: true; update: JobUpdate } | { ok: false; error: string }> {
    const res = await fetch(`/api/jobs/${jobId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
    });
    let json: { error?: string; data?: Record<string, unknown> } = {};
    try {
        json = await res.json();
    } catch {
        /* non-json error body */
    }
    if (!res.ok || !json.data) {
        return { ok: false, error: json.error || `Could not post the update (HTTP ${res.status}).` };
    }
    return { ok: true, update: mapRow(json.data) };
}

/** True when a URL points at something we can render as an inline image. */
export function isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

export function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
