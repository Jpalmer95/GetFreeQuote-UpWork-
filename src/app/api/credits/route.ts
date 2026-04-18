import { NextResponse } from 'next/server';
import { logVolunteerHours, earnCredits, spendCredits, creditsToDollars, getCreditSummary } from '@/services/communityCredits';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'log_volunteer': {
                const { log, creditsEarned } = logVolunteerHours(params.userId, params.communityProjectId, params.hoursWorked, params.role, params.notes);
                return NextResponse.json({ success: true, data: { log, creditsEarned } });
            }
            case 'earn': {
                const credits = earnCredits(params.credits, params.amount, params.type, params.description, params.relatedProjectId, params.relatedJobId);
                return NextResponse.json({ success: true, data: credits });
            }
            case 'spend': {
                const { credits, success, error } = spendCredits(params.credits, params.amount, params.description, params.relatedJobId);
                if (!success) return NextResponse.json({ success: false, error }, { status: 400 });
                return NextResponse.json({ success: true, data: credits });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const credits = parseInt(searchParams.get('credits') || '0');
    const dollars = creditsToDollars(credits);
    return NextResponse.json({ success: true, data: { credits, dollars } });
}
