import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { rankQuotes } from '@/services/quoteRanker';
import {
    computeEscrowManifestHash,
    verifyAuditHashChain,
    AuditChainItem,
} from '@/services/verifiableEscrow';
import type { RankedQuote } from '@/types';

function isPositiveFiniteNumber(val: unknown): val is number {
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

export async function GET(request: NextRequest) {
    try {
        const projectId = new URL(request.url).searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        const [jobsRes, ledgerRes, escrowRes] = await Promise.all([
            supabaseAdmin
                .from('jobs')
                .select('*')
                .eq('community_project_id', projectId)
                .order('created_at', { ascending: false }),
            supabaseAdmin
                .from('ledger_entries')
                .select('*')
                .eq('community_project_id', projectId)
                .order('created_at', { ascending: true }),
            supabaseAdmin
                .from('escrow_accounts')
                .select('*')
                .eq('community_project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(1),
        ]);

        const jobs = jobsRes.data || [];
        const jobIds = jobs.map((j: Record<string, unknown>) => j.id as string);

        let quotes: Record<string, unknown>[] = [];
        if (jobIds.length > 0) {
            const { data: qRows } = await supabaseAdmin
                .from('quotes')
                .select('*')
                .in('job_id', jobIds)
                .order('amount', { ascending: true });
            quotes = (qRows || []) as Record<string, unknown>[];
        }

        const vendorIds = [...new Set(quotes.map(q => q.vendor_id as string))];
        const vendorMap = new Map<string, { isVerified: boolean; avgRating: number; walletAddress?: string }>();
        if (vendorIds.length > 0) {
            const { data: vRows } = await supabaseAdmin
                .from('vendor_profiles')
                .select('user_id, is_verified, avg_rating, wallet_address')
                .in('user_id', vendorIds);
            for (const v of vRows || []) {
                vendorMap.set(v.user_id as string, {
                    isVerified: !!v.is_verified,
                    avgRating: Number(v.avg_rating || 0),
                    walletAddress: (v.wallet_address as string) || undefined,
                });
            }
        }

        const pseudoRankedInputs: RankedQuote[] = quotes.map(q => {
            const v = vendorMap.get(q.vendor_id as string);
            return {
                id: q.id as string,
                thread_id: q.id as string,
                quote_amount: Number(q.amount),
                estimated_days: Number(q.estimated_days || 1),
                exclusions: /exclud/i.test(String(q.details || '')) ? 'Has exclusions' : null,
                license_verified: v?.isVerified ?? false,
                coi_verified: v?.isVerified ?? false,
                rating: v?.avgRating ?? 4.5,
                distance_mi: 5,
                rank: null,
                notes: String(q.details || ''),
                created_at: String(q.created_at || ''),
            };
        });

        const rankedRows = rankQuotes(pseudoRankedInputs).map(r => {
            const orig = quotes.find(q => q.id === r.threadId);
            return {
                quoteId: r.threadId,
                jobId: orig?.job_id as string,
                vendorId: orig?.vendor_id as string,
                vendorName: orig?.vendor_name as string,
                status: orig?.status as string,
                amount: r.amount,
                estimatedDays: r.days,
                licenseVerified: r.licenseVerified,
                rating: r.rating,
                rawScore: Math.round(r.rawScore * 10) / 10,
                rank: r.rank,
                details: r.notes,
            };
        });

        const ledgerAsc = (ledgerRes.data || []) as Record<string, unknown>[];
        const chainItems: AuditChainItem[] = ledgerAsc
            .filter(e => e.prev_hash && e.receipt_hash)
            .map(e => ({
                type: e.type as string,
                entityId: projectId,
                amount: Number(e.amount),
                txHash: (e.transaction_hash as string) || null,
                prevHash: e.prev_hash as string,
                receiptHash: e.receipt_hash as string,
            }));

        const ledgerVerification = verifyAuditHashChain(chainItems);

        return NextResponse.json({
            success: true,
            jobs,
            rankedQuotes: rankedRows,
            escrow: (escrowRes.data || [])[0] || null,
            ledgerVerification,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error loading community details';
        return NextResponse.json({ error: message }, { status: 500 });
    }
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
            const customTxHash = typeof body.txHash === 'string' && body.txHash.trim() ? body.txHash.trim() : undefined;

            if (!communityProjectId || !isPositiveFiniteNumber(amount)) {
                return NextResponse.json({ error: 'Valid communityProjectId and positive amount required' }, { status: 400 });
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', caller.id)
                .single();

            const donorName = isAnonymous ? 'Anonymous' : (profile?.full_name || 'Anonymous');
            const txHash = customTxHash || `0x8453${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

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

        if (action === 'award-best-contractor') {
            const caller = await getAuthenticatedUser(request);
            if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

            const communityProjectId = body.communityProjectId as string | undefined;
            const quoteId = body.quoteId as string | undefined;
            if (!communityProjectId || !quoteId) {
                return NextResponse.json({ error: 'communityProjectId and quoteId required' }, { status: 400 });
            }

            const { data: project } = await supabaseAdmin
                .from('community_projects')
                .select('*')
                .eq('id', communityProjectId)
                .single();
            if (!project) return NextResponse.json({ error: 'Community project not found' }, { status: 404 });
            if (project.creator_id !== caller.id) {
                return NextResponse.json({ error: 'Only the project creator can award contractors' }, { status: 403 });
            }

            const { data: quote } = await supabaseAdmin
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .single();
            if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

            const totalAmount = Number(quote.amount);
            const milestones = [
                { name: 'Milestone 1: Site Prep & Materials (30%)', amount: Math.round(totalAmount * 0.3) },
                { name: 'Milestone 2: Primary Construction & Rough-In (45%)', amount: Math.round(totalAmount * 0.45) },
                { name: 'Milestone 3: Final Inspection & Community Sign-Off (25%)', amount: totalAmount - Math.round(totalAmount * 0.3) - Math.round(totalAmount * 0.45) },
            ];

            const manifestHash = computeEscrowManifestHash({
                jobId: quote.job_id,
                communityProjectId,
                quoteId,
                payerId: caller.id,
                payeeId: quote.vendor_id,
                chainId: 8453,
                tokenSymbol: 'USDC',
                totalAmount,
                milestones,
            });

            await supabaseAdmin.from('quotes').update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() }).eq('id', quoteId);
            if (quote.job_id) {
                await supabaseAdmin.from('jobs').update({ status: 'IN_PROGRESS' }).eq('id', quote.job_id);
            }

            const { data: escrow } = await supabaseAdmin
                .from('escrow_accounts')
                .insert({
                    job_id: quote.job_id,
                    community_project_id: communityProjectId,
                    quote_id: quoteId,
                    payer_id: caller.id,
                    payee_id: quote.vendor_id,
                    chain_id: 8453,
                    token_symbol: 'USDC',
                    contract_address: project.contract_address || `0x8453${manifestHash.slice(0, 36)}`,
                    manifest_hash: manifestHash,
                    total_amount: totalAmount,
                    funded_amount: Math.min(Number(project.current_funding || 0), totalAmount),
                    released_amount: 0,
                    status: Number(project.current_funding || 0) >= totalAmount ? 'funded' : 'pending',
                    funded_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (escrow) {
                for (let i = 0; i < milestones.length; i++) {
                    await supabaseAdmin.from('escrow_milestones').insert({
                        escrow_account_id: escrow.id,
                        name: milestones[i].name,
                        amount: milestones[i].amount,
                        status: 'pending',
                        sort_order: i + 1,
                    });
                }
            }

            await supabaseAdmin
                .from('community_projects')
                .update({
                    status: 'IN_PROGRESS',
                    awarded_job_id: quote.job_id,
                    awarded_quote_id: quoteId,
                    awarded_vendor_name: quote.vendor_name,
                    escrow_account_id: escrow?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', communityProjectId);

            return NextResponse.json({
                success: true,
                escrowId: escrow?.id,
                manifestHash,
                vendorName: quote.vendor_name,
                amount: totalAmount,
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
            const industryVertical = typeof body.industryVertical === 'string' ? body.industryVertical : 'Commercial Construction';
            const subcategory = typeof body.subcategory === 'string' ? body.subcategory : 'General Contracting';

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

            const contractAddress = `0x8453${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`;

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
