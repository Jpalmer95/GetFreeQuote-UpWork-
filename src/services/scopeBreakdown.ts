/**
 * Scope Breakdown AI Service
 * 
 * Parses natural language job descriptions into structured phases
 * with dependencies, trade requirements, and cost estimates.
 */

import { ScopeBreakdown, ScopePhase, PriceEstimate } from '@/types';
import { estimatePrice } from './priceEstimation';

// Trade detection keywords
const TRADE_KEYWORDS: Record<string, string[]> = {
    'plumbing': ['plumb', 'pipe', 'faucet', 'toilet', 'drain', 'water heater', 'sewer', 'valve', 'fixture', 'sink', 'shower', 'bathtub', 'garbage disposal'],
    'electrical': ['electric', 'wire', 'outlet', 'panel', 'breaker', 'switch', 'light', 'circuit', 'fuse', 'gfci', 'ev charger', 'subpanel'],
    'hvac': ['hvac', 'ac', 'air condition', 'furnace', 'heating', 'cooling', 'duct', 'vent', 'thermostat', 'heat pump', 'mini split'],
    'roofing': ['roof', 'shingle', 'flashing', 'gutter', 'soffit', 'fascia', 'ridge', 'skylight', 'leak'],
    'painting': ['paint', 'primer', 'stain', 'caulk', 'drywall finish', 'texture', 'wallpaper'],
    'landscaping': ['landscap', 'lawn', 'sod', 'tree', 'shrub', 'irrigation', 'sprinkler', 'mulch', 'garden', 'retaining wall', 'patio', 'deck'],
    'concrete': ['concrete', 'cement', 'slab', 'foundation', 'driveway', 'sidewalk', 'patio', 'stamped'],
    'carpentry': ['framing', 'trim', 'crown molding', 'baseboard', 'door', 'window', 'cabinet', 'shelf', 'built-in', 'closet'],
    'flooring': ['floor', 'hardwood', 'tile', 'laminate', 'vinyl', 'carpet', 'lvp', 'grout', 'subfloor'],
    'drywall': ['drywall', 'sheetrock', 'mud', 'tape', 'texture', 'popcorn ceiling', 'smooth wall'],
    'masonry': ['brick', 'stone', 'block', 'mortar', 'mason', 'chimney', 'paver'],
    'demolition': ['demo', 'demolish', 'tear out', 'remove', 'gut', 'rip out'],
    'general': ['clean', 'haul', 'dumpster', 'debris', 'organize'],
};

// Phase dependency patterns
const DEPENDENCY_PATTERNS: { before: string; after: string }[] = [
    { before: 'demolition', after: 'framing' },
    { before: 'framing', after: 'electrical' },
    { before: 'framing', after: 'plumbing' },
    { before: 'electrical', after: 'drywall' },
    { before: 'plumbing', after: 'drywall' },
    { before: 'drywall', after: 'painting' },
    { before: 'painting', after: 'flooring' },
    { before: 'flooring', after: 'trim' },
];

interface ScopeInput {
    jobId: string;
    description: string;
    category: string;
    subcategory: string;
    location: string;
    squareFootage?: string;
}

export function parseScope(input: ScopeInput): ScopeBreakdown {
    const { jobId, description, category, subcategory, location, squareFootage } = input;
    const descLower = description.toLowerCase();

    // Detect required trades
    const detectedTrades = detectTrades(descLower);

    // Generate phases from detected trades
    const phases = generatePhases(detectedTrades, descLower, location, squareFootage);

    // Set up dependencies
    setDependencies(phases);

    // Calculate totals
    const totalEstimateLow = phases.reduce((sum, p) => sum + p.estimateLow, 0);
    const totalEstimateHigh = phases.reduce((sum, p) => sum + p.estimateHigh, 0);

    // Determine how many contractors needed
    const uniqueTrades = new Set(phases.map(p => p.tradeRequired));
    const suggestedContractors = Math.max(1, uniqueTrades.size);

    // Can vendors bid per-phase if multiple trades?
    const canPhaseBid = phases.length > 1 && uniqueTrades.size > 1;

    // Confidence based on how well we parsed
    let confidence = 0.4;
    if (detectedTrades.length > 0) confidence += 0.2;
    if (phases.length >= 2) confidence += 0.15;
    if (squareFootage) confidence += 0.1;
    if (phases.some(p => p.materialsNeeded.length > 0)) confidence += 0.1;
    confidence = Math.min(1.0, confidence);

    return {
        id: `scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobId,
        phases,
        totalEstimateLow,
        totalEstimateHigh,
        suggestedContractors,
        canPhaseBid,
        generatedAt: new Date().toISOString(),
        confidence,
    };
}

function detectTrades(description: string): string[] {
    const found: string[] = [];

    for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
        if (trade === 'general') continue; // skip general unless nothing else matches
        if (keywords.some(kw => description.includes(kw))) {
            found.push(trade);
        }
    }

    // If nothing specific found, add general
    if (found.length === 0) {
        found.push('general');
    }

    return found;
}

function generatePhases(
    trades: string[],
    description: string,
    location: string,
    squareFootage?: string
): ScopePhase[] {
    const phases: ScopePhase[] = [];
    let orderIndex = 0;

    for (const trade of trades) {
        const phase = createPhaseForTrade(trade, orderIndex, description, location, squareFootage);
        if (phase) {
            phases.push(phase);
            orderIndex++;
        }
    }

    // If only one trade detected, break into typical sub-phases
    if (phases.length === 1 && trades[0] !== 'general') {
        return expandSingleTradePhases(trades[0], description, location, squareFootage);
    }

    return phases;
}

function createPhaseForTrade(
    trade: string,
    orderIndex: number,
    description: string,
    location: string,
    squareFootage?: string
): ScopePhase | null {
    const sqft = squareFootage ? parseFloat(squareFootage) : 500;

    const phaseTemplates: Record<string, { name: string; desc: string; materials: string[]; duration: number; unit: string }> = {
        'demolition': { name: 'Demolition & Removal', desc: 'Remove existing materials and prep work area', materials: ['dumpster rental', 'disposal fees'], duration: 1, unit: 'sqft' },
        'plumbing': { name: 'Plumbing Work', desc: 'Install/repair plumbing fixtures and connections', materials: ['pipes', 'fittings', 'fixtures'], duration: 2, unit: 'sqft' },
        'electrical': { name: 'Electrical Work', desc: 'Install/repair electrical systems', materials: ['wire', 'outlets', 'breakers', 'junction boxes'], duration: 2, unit: 'sqft' },
        'hvac': { name: 'HVAC Installation/Repair', desc: 'Install or repair heating/cooling systems', materials: ['unit', 'ductwork', 'thermostat', 'refrigerant'], duration: 3, unit: 'each' },
        'roofing': { name: 'Roofing Work', desc: 'Install or repair roofing materials', materials: ['shingles', 'underlayment', 'flashing', 'nails'], duration: 2, unit: 'sqft' },
        'painting': { name: 'Painting & Finishing', desc: 'Prep, prime, and paint surfaces', materials: ['paint', 'primer', 'caulk', 'tape'], duration: 2, unit: 'sqft' },
        'landscaping': { name: 'Landscaping', desc: 'Install landscaping features', materials: ['plants', 'mulch', 'soil', 'edging'], duration: 2, unit: 'sqft' },
        'concrete': { name: 'Concrete Work', desc: 'Pour and finish concrete', materials: ['concrete mix', 'rebar', 'forms', 'sealant'], duration: 3, unit: 'sqft' },
        'carpentry': { name: 'Carpentry & Framing', desc: 'Build structural and finish carpentry', materials: ['lumber', 'fasteners', 'hardware'], duration: 3, unit: 'sqft' },
        'flooring': { name: 'Flooring Installation', desc: 'Install flooring materials', materials: ['flooring material', 'underlayment', 'adhesive', 'trim'], duration: 2, unit: 'sqft' },
        'drywall': { name: 'Drywall Installation', desc: 'Hang, tape, mud, and finish drywall', materials: ['drywall sheets', 'joint compound', 'tape', 'screws'], duration: 2, unit: 'sqft' },
        'masonry': { name: 'Masonry Work', desc: 'Build or repair masonry structures', materials: ['brick/block', 'mortar', 'rebar'], duration: 3, unit: 'sqft' },
        'general': { name: 'General Labor', desc: 'General construction and labor tasks', materials: ['miscellaneous supplies'], duration: 1, unit: 'hour' },
    };

    const template = phaseTemplates[trade];
    if (!template) return null;

    const estimate = estimatePrice({
        category: trade.charAt(0).toUpperCase() + trade.slice(1),
        subcategory: 'default',
        description: `${template.desc} - ${description}`,
        location,
        squareFootage,
    });

    return {
        id: `phase_${Date.now()}_${orderIndex}`,
        name: template.name,
        description: template.desc,
        orderIndex,
        tradeRequired: trade,
        estimateLow: estimate.lowEstimate,
        estimateHigh: estimate.highEstimate,
        durationDays: template.duration,
        dependsOn: [],
        permitRequired: ['electrical', 'plumbing', 'hvac', 'structural', 'roofing'].includes(trade),
        materialsNeeded: template.materials,
    };
}

function expandSingleTradePhases(
    trade: string,
    description: string,
    location: string,
    squareFootage?: string
): ScopePhase[] {
    const phases: ScopePhase[] = [];

    // Always start with demolition if it's a renovation
    if (description.match(/replace|remodel|renovate|update|upgrade|old|existing/i)) {
        const demoPhase = createPhaseForTrade('demolition', 0, description, location, squareFootage);
        if (demoPhase) phases.push(demoPhase);
    }

    // Main trade work
    const mainPhase = createPhaseForTrade(trade, phases.length, description, location, squareFootage);
    if (mainPhase) {
        if (phases.length > 0) mainPhase.dependsOn = [phases[0].id];
        phases.push(mainPhase);
    }

    // Add finishing/cleanup
    const estimate = estimatePrice({
        category: 'Cleaning',
        subcategory: 'deep',
        description: 'Job site cleanup',
        location,
    });

    phases.push({
        id: `phase_${Date.now()}_cleanup`,
        name: 'Cleanup & Final Inspection',
        description: 'Clean up job site and final walkthrough',
        orderIndex: phases.length,
        tradeRequired: trade,
        estimateLow: Math.round(estimate.lowEstimate * 0.3),
        estimateHigh: Math.round(estimate.highEstimate * 0.3),
        durationDays: 0.5,
        dependsOn: phases.length > 0 ? [phases[phases.length - 1].id] : [],
        permitRequired: false,
        materialsNeeded: [],
    });

    return phases;
}

function setDependencies(phases: ScopePhase[]): void {
    const tradeOrder = phases.map(p => p.tradeRequired);

    for (const dep of DEPENDENCY_PATTERNS) {
        const beforeIdx = tradeOrder.indexOf(dep.before);
        const afterIdx = tradeOrder.indexOf(dep.after);

        if (beforeIdx !== -1 && afterIdx !== -1 && beforeIdx < afterIdx) {
            if (!phases[afterIdx].dependsOn.includes(phases[beforeIdx].id)) {
                phases[afterIdx].dependsOn.push(phases[beforeIdx].id);
            }
        }
    }
}
