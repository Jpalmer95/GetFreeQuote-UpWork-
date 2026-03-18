import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

function isPositiveFiniteNumber(val: unknown): val is number {
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as Record<string, unknown>;
        const action = body.action as string | undefined;

        if (action === 'donate') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const communityProjectId = body.communityProjectId as string | undefined;
            const amount = body.amount as number | undefined;
            const isAnonymous = body.isAnonymous === true;
            const message = typeof body.message === 'string' ? body.message : undefined;

            if (!communityProjectId || !isPositiveFiniteNumber(amount)) {
                return NextResponse.json({ error: 'Valid communityProjectId and positive amount required' }, { status: 400 });
            }

            const { data: project, error: projError } = await supabaseAdmin
                .from('community_projects')
                .select('id, status, goal_amount, creator_id')
                .eq('id', communityProjectId)
                .single();

            if (projError || !project) {
                return NextResponse.json({ error: 'Community project not found' }, { status: 404 });
            }

            if (project.status !== 'ACTIVE') {
                return NextResponse.json({ error: 'This project is not currently accepting donations' }, { status: 400 });
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', caller.id)
                .single();

            const donorName = isAnonymous ? 'Anonymous' : (profile?.full_name || 'Anonymous');

            const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

            const { data: donation, error: donError } = await supabaseAdmin
                .from('donations')
                .insert({
                    community_project_id: communityProjectId,
                    donor_id: caller.id,
                    donor_name: donorName,
                    amount,
                    is_anonymous: isAnonymous,
                    transaction_hash: txHash,
                    message: message || null,
                })
                .select()
                .single();

            if (donError) throw donError;

            const { error: updateError } = await supabaseAdmin.rpc('increment_community_funding', {
                p_project_id: communityProjectId,
                p_amount: amount,
            });

            if (updateError) {
                console.error('RPC increment failed, using direct update fallback:', updateError);
                const { data: latestProject } = await supabaseAdmin
                    .from('community_projects')
                    .select('current_funding, goal_amount')
                    .eq('id', communityProjectId)
                    .single();
                if (latestProject) {
                    const newFunding = Number(latestProject.current_funding) + amount;
                    const newStatus = newFunding >= Number(latestProject.goal_amount) ? 'FUNDED' : 'ACTIVE';
                    const { error: fallbackError } = await supabaseAdmin
                        .from('community_projects')
                        .update({
                            current_funding: newFunding,
                            status: newStatus,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', communityProjectId);
                    if (fallbackError) {
                        console.error('Fallback funding update also failed:', fallbackError);
                    }
                }
            }

            const { error: ledgerError } = await supabaseAdmin.from('ledger_entries').insert({
                community_project_id: communityProjectId,
                type: 'DONATION',
                amount,
                description: isAnonymous
                    ? `Anonymous donation${message ? ': ' + message : ''}`
                    : `Donation from ${donorName}${message ? ': ' + message : ''}`,
                reference_id: donation.id,
                transaction_hash: txHash,
            });

            if (ledgerError) {
                console.error('Ledger entry insert failed:', ledgerError);
            }

            const { data: refreshed } = await supabaseAdmin
                .from('community_projects')
                .select('current_funding, status')
                .eq('id', communityProjectId)
                .single();

            return NextResponse.json({
                donation,
                txHash,
                newFunding: refreshed?.current_funding ?? amount,
                newStatus: refreshed?.status ?? 'ACTIVE',
            });
        }

        if (action === 'record-expense') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const communityProjectId = body.communityProjectId as string | undefined;
            const amount = body.amount as number | undefined;
            const description = body.description as string | undefined;

            if (!communityProjectId || !isPositiveFiniteNumber(amount) || !description || !description.trim()) {
                return NextResponse.json({ error: 'communityProjectId, positive amount, and non-empty description required' }, { status: 400 });
            }

            const { data: expProject, error: expProjError } = await supabaseAdmin
                .from('community_projects')
                .select('creator_id')
                .eq('id', communityProjectId)
                .single();

            if (expProjError || !expProject) {
                return NextResponse.json({ error: 'Community project not found' }, { status: 404 });
            }

            if (expProject.creator_id !== caller.id) {
                return NextResponse.json({ error: 'Only the project creator can record expenses' }, { status: 403 });
            }

            const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

            const { data: entry, error: ledgerError } = await supabaseAdmin
                .from('ledger_entries')
                .insert({
                    community_project_id: communityProjectId,
                    type: 'EXPENSE',
                    amount,
                    description,
                    transaction_hash: txHash,
                })
                .select()
                .single();

            if (ledgerError) throw ledgerError;

            return NextResponse.json({ entry, txHash });
        }

        if (action === 'create-project') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const title = body.title as string | undefined;
            const description = typeof body.description === 'string' ? body.description : '';
            const category = typeof body.category === 'string' ? body.category : 'Other';
            const location = typeof body.location === 'string' ? body.location : '';
            const goalAmount = body.goalAmount as number | undefined;
            const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;

            if (!title || !title.trim() || !isPositiveFiniteNumber(goalAmount)) {
                return NextResponse.json({ error: 'Non-empty title and positive goalAmount required' }, { status: 400 });
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', caller.id)
                .single();

            const contractAddress = `0xBF${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`;

            const { data: project, error: createError } = await supabaseAdmin
                .from('community_projects')
                .insert({
                    creator_id: caller.id,
                    creator_name: profile?.full_name || 'Unknown',
                    title,
                    description: description || '',
                    category: category || 'Other',
                    location: location || '',
                    goal_amount: goalAmount,
                    current_funding: 0,
                    status: 'ACTIVE',
                    image_url: imageUrl || null,
                    contract_address: contractAddress,
                })
                .select()
                .single();

            if (createError) throw createError;

            return NextResponse.json({ project });
        }

        if (action === 'post-update') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const communityProjectId = body.communityProjectId as string | undefined;
            const title = body.title as string | undefined;
            const content = body.content as string | undefined;
            const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;
            if (!communityProjectId || !title || !content) {
                return NextResponse.json({ error: 'communityProjectId, title, and content required' }, { status: 400 });
            }

            const { data: project, error: projError } = await supabaseAdmin
                .from('community_projects')
                .select('creator_id')
                .eq('id', communityProjectId)
                .single();

            if (projError || !project) {
                return NextResponse.json({ error: 'Community project not found' }, { status: 404 });
            }

            if (project.creator_id !== caller.id) {
                return NextResponse.json({ error: 'Only the project creator can post updates' }, { status: 403 });
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', caller.id)
                .single();

            const { data: update, error: updateError } = await supabaseAdmin
                .from('community_project_updates')
                .insert({
                    community_project_id: communityProjectId,
                    author_id: caller.id,
                    author_name: profile?.full_name || 'Unknown',
                    title,
                    content,
                    image_url: imageUrl || null,
                })
                .select()
                .single();

            if (updateError) throw updateError;

            return NextResponse.json({ update });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('Community API error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
