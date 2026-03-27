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

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', caller.id)
                .single();

            const donorName = isAnonymous ? 'Anonymous' : (profile?.full_name || 'Anonymous');
            const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

            const { data: donationId, error: rpcError } = await supabaseAdmin.rpc('process_donation', {
                p_project_id: communityProjectId,
                p_donor_id: caller.id,
                p_donor_name: donorName,
                p_amount: amount,
                p_is_anonymous: isAnonymous,
                p_tx_hash: txHash,
                p_message: message || null,
            });

            if (rpcError) {
                const msg = rpcError.message || 'Donation failed';
                const status = msg.includes('not found') ? 404 : msg.includes('not accepting') ? 400 : 500;
                return NextResponse.json({ error: msg }, { status });
            }

            const { data: refreshed } = await supabaseAdmin
                .from('community_projects')
                .select('current_funding, status')
                .eq('id', communityProjectId)
                .single();

            return NextResponse.json({
                donationId,
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

            const { data: result, error: rpcError } = await supabaseAdmin.rpc('record_community_expense', {
                p_project_id: communityProjectId,
                p_creator_id: caller.id,
                p_amount: amount,
                p_description: description.trim(),
            });

            if (rpcError) {
                const msg = rpcError.message || 'Failed to record expense';
                const status = msg.includes('not found') ? 404 : msg.includes('creator') ? 403 : msg.includes('Insufficient') ? 400 : 500;
                return NextResponse.json({ error: msg }, { status });
            }

            return NextResponse.json(result);
        }

        if (action === 'post-to-marketplace') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const communityProjectId = body.communityProjectId as string | undefined;
            const jobTitle = typeof body.jobTitle === 'string' ? body.jobTitle : undefined;
            const jobDescription = typeof body.jobDescription === 'string' ? body.jobDescription : '';
            const jobCategory = typeof body.jobCategory === 'string' ? body.jobCategory : 'Other';
            const industryVertical = typeof body.industryVertical === 'string' ? body.industryVertical : 'Other';
            const subcategory = typeof body.subcategory === 'string' ? body.subcategory : 'Other';

            if (!communityProjectId || !jobTitle || !jobTitle.trim()) {
                return NextResponse.json({ error: 'communityProjectId and jobTitle required' }, { status: 400 });
            }

            const { data: cpProject, error: cpError } = await supabaseAdmin
                .from('community_projects')
                .select('creator_id, title, location, current_funding, goal_amount, status')
                .eq('id', communityProjectId)
                .single();

            if (cpError || !cpProject) {
                return NextResponse.json({ error: 'Community project not found' }, { status: 404 });
            }

            if (cpProject.creator_id !== caller.id) {
                return NextResponse.json({ error: 'Only the project creator can post jobs to marketplace' }, { status: 403 });
            }

            const allowedStatuses = ['ACTIVE', 'FUNDED', 'IN_PROGRESS'];
            if (!allowedStatuses.includes(cpProject.status)) {
                return NextResponse.json({ error: `Cannot post to marketplace: project status is ${cpProject.status}` }, { status: 400 });
            }

            const { data: job, error: jobError } = await supabaseAdmin
                .from('jobs')
                .insert({
                    user_id: caller.id,
                    title: jobTitle,
                    category: jobCategory,
                    description: jobDescription || `Community project: ${cpProject.title}`,
                    location: cpProject.location || '',
                    tags: ['community-funded'],
                    is_public: true,
                    requires_permit: false,
                    budget: cpProject.goal_amount ? String(cpProject.goal_amount) : undefined,
                    industry_vertical: industryVertical,
                    subcategory,
                    urgency: 'flexible',
                    community_project_id: communityProjectId,
                    status: 'OPEN',
                })
                .select()
                .single();

            if (jobError) throw jobError;

            return NextResponse.json({ job });
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
        console.error('Community API error:', message);
        const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('SUPABASE_URL') ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
