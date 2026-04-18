import { NextResponse } from 'next/server';
import { buildStructuredQuote, compareQuotes, generateQuoteTemplate } from '@/services/structuredQuote';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'build': {
                const quote = buildStructuredQuote(params);
                return NextResponse.json({ success: true, data: quote });
            }
            case 'compare': {
                const comparison = compareQuotes(params.quoteA, params.quoteB);
                return NextResponse.json({ success: true, data: comparison });
            }
            case 'template': {
                const template = generateQuoteTemplate(params.category, params.subcategory);
                return NextResponse.json({ success: true, data: template });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
