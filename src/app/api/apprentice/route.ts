import { NextResponse } from 'next/server';
import { matchApprenticeToMentors, logApprenticeHours, calculateProgress, getTradeSkills } from '@/services/apprenticeMatching';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'match': {
                const matches = matchApprenticeToMentors(params.apprentice, params.mentors, new Map(Object.entries(params.mentorLocations || {})));
                return NextResponse.json({ success: true, data: matches });
            }
            case 'log_hours': {
                const log = logApprenticeHours(params.apprenticeId, params.mentorId, params.hoursWorked, params.skillsPracticed, params.jobId, params.mentorNotes, params.apprenticeNotes);
                return NextResponse.json({ success: true, data: log });
            }
            case 'progress': {
                const progress = calculateProgress(params.logs, params.hoursRequired);
                return NextResponse.json({ success: true, data: progress });
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
    const trade = searchParams.get('trade');
    if (trade) {
        const skills = getTradeSkills(trade);
        return NextResponse.json({ success: true, data: skills });
    }
    return NextResponse.json({ success: false, error: 'Trade required' }, { status: 400 });
}
