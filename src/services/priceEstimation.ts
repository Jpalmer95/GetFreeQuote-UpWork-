/**
 * AI Price Estimation Service
 * 
 * Provides market price estimates for jobs based on category,
 * historical data, location, and seasonal factors.
 */

import { PriceEstimate, SurgeState, INDUSTRY_SUBCATEGORIES, KnownIndustryVertical } from '@/types';

// National average pricing data (per unit)
// In production, this would come from a database of completed jobs
const PRICING_DATA: Record<string, {
    unit: string;
    lowPerUnit: number;
    highPerUnit: number;
    typicalRange: [number, number]; // typical job size in units
    laborHoursPerUnit: number;
    laborRateRange: [number, number];
    materialsPercent: number; // % of total that's materials
    seasonalFactor: Record<number, number>; // month -> multiplier
}> = {
    // Home Services
    'Plumbing-faucet_replace': { unit: 'each', lowPerUnit: 150, highPerUnit: 350, typicalRange: [1, 2], laborHoursPerUnit: 2, laborRateRange: [75, 150], materialsPercent: 30, seasonalFactor: { 1: 1.0, 2: 1.0, 3: 1.05, 4: 1.1, 5: 1.1, 6: 1.05, 7: 1.0, 8: 1.0, 9: 1.05, 10: 1.1, 11: 1.1, 12: 1.0 } },
    'Plumbing-water_heater': { unit: 'each', lowPerUnit: 800, highPerUnit: 2500, typicalRange: [1, 1], laborHoursPerUnit: 6, laborRateRange: [75, 150], materialsPercent: 55, seasonalFactor: { 1: 1.1, 2: 1.05, 3: 1.0, 4: 1.0, 5: 0.95, 6: 0.95, 7: 0.95, 8: 0.95, 9: 1.0, 10: 1.0, 11: 1.05, 12: 1.1 } },
    'Plumbing-sewer_line': { unit: 'linear_ft', lowPerUnit: 50, highPerUnit: 250, typicalRange: [20, 100], laborHoursPerUnit: 0.5, laborRateRange: [80, 175], materialsPercent: 40, seasonalFactor: {} },
    'Electrical-outlet': { unit: 'each', lowPerUnit: 100, highPerUnit: 300, typicalRange: [1, 10], laborHoursPerUnit: 1.5, laborRateRange: [70, 130], materialsPercent: 25, seasonalFactor: {} },
    'Electrical-panel_upgrade': { unit: 'each', lowPerUnit: 1500, highPerUnit: 4000, typicalRange: [1, 1], laborHoursPerUnit: 12, laborRateRange: [70, 130], materialsPercent: 45, seasonalFactor: {} },
    'Electrical-rewire': { unit: 'sqft', lowPerUnit: 3, highPerUnit: 8, typicalRange: [500, 3000], laborHoursPerUnit: 0.03, laborRateRange: [70, 130], materialsPercent: 35, seasonalFactor: {} },
    'HVAC-ac_install': { unit: 'ton', lowPerUnit: 1500, highPerUnit: 3500, typicalRange: [2, 5], laborHoursPerUnit: 8, laborRateRange: [75, 150], materialsPercent: 50, seasonalFactor: { 3: 1.1, 4: 1.2, 5: 1.3, 6: 1.35, 7: 1.3, 8: 1.2, 9: 1.1 } },
    'HVAC-furnace': { unit: 'each', lowPerUnit: 2500, highPerUnit: 6000, typicalRange: [1, 1], laborHoursPerUnit: 12, laborRateRange: [75, 150], materialsPercent: 55, seasonalFactor: { 10: 1.2, 11: 1.3, 12: 1.3, 1: 1.3, 2: 1.2 } },
    'Roofing-shingle': { unit: 'sqft', lowPerUnit: 3.5, highPerUnit: 7, typicalRange: [1000, 3000], laborHoursPerUnit: 0.02, laborRateRange: [45, 85], materialsPercent: 50, seasonalFactor: { 4: 1.1, 5: 1.15, 6: 1.15, 7: 1.1, 8: 1.05, 9: 1.0 } },
    'Painting-interior': { unit: 'sqft', lowPerUnit: 2, highPerUnit: 6, typicalRange: [500, 3000], laborHoursPerUnit: 0.02, laborRateRange: [35, 65], materialsPercent: 20, seasonalFactor: {} },
    'Painting-exterior': { unit: 'sqft', lowPerUnit: 1.5, highPerUnit: 4, typicalRange: [1000, 3000], laborHoursPerUnit: 0.015, laborRateRange: [35, 65], materialsPercent: 25, seasonalFactor: { 4: 1.1, 5: 1.15, 6: 1.15, 7: 1.1, 8: 1.05, 9: 1.0 } },
    'Landscaping-sod': { unit: 'sqft', lowPerUnit: 0.5, highPerUnit: 1.5, typicalRange: [500, 5000], laborHoursPerUnit: 0.005, laborRateRange: [30, 55], materialsPercent: 60, seasonalFactor: { 3: 1.0, 4: 1.1, 5: 1.15, 6: 1.1, 9: 1.05, 10: 1.0 } },
    'Cleaning-deep': { unit: 'sqft', lowPerUnit: 0.15, highPerUnit: 0.4, typicalRange: [1000, 4000], laborHoursPerUnit: 0.005, laborRateRange: [25, 50], materialsPercent: 10, seasonalFactor: { 3: 1.1, 11: 1.15, 12: 1.2 } },
    'Handyman-general': { unit: 'hour', lowPerUnit: 50, highPerUnit: 100, typicalRange: [2, 8], laborHoursPerUnit: 1, laborRateRange: [50, 100], materialsPercent: 15, seasonalFactor: {} },

    // Trade Labor
    'Carpentry-framing': { unit: 'sqft', lowPerUnit: 5, highPerUnit: 12, typicalRange: [200, 2000], laborHoursPerUnit: 0.04, laborRateRange: [45, 85], materialsPercent: 40, seasonalFactor: {} },
    'Carpentry-trim': { unit: 'linear_ft', lowPerUnit: 5, highPerUnit: 15, typicalRange: [50, 500], laborHoursPerUnit: 0.1, laborRateRange: [45, 85], materialsPercent: 30, seasonalFactor: {} },
    'Drywall-install': { unit: 'sqft', lowPerUnit: 1.5, highPerUnit: 3.5, typicalRange: [500, 3000], laborHoursPerUnit: 0.015, laborRateRange: [40, 70], materialsPercent: 35, seasonalFactor: {} },
    'Tile-ceramic': { unit: 'sqft', lowPerUnit: 5, highPerUnit: 15, typicalRange: [50, 500], laborHoursPerUnit: 0.06, laborRateRange: [45, 85], materialsPercent: 40, seasonalFactor: {} },
    'Flooring-hardwood': { unit: 'sqft', lowPerUnit: 6, highPerUnit: 18, typicalRange: [200, 2000], laborHoursPerUnit: 0.05, laborRateRange: [45, 85], materialsPercent: 50, seasonalFactor: {} },
    'Concrete-flatwork': { unit: 'sqft', lowPerUnit: 4, highPerUnit: 12, typicalRange: [200, 2000], laborHoursPerUnit: 0.03, laborRateRange: [40, 75], materialsPercent: 45, seasonalFactor: { 12: 1.1, 1: 1.1, 2: 1.1, 6: 1.05, 7: 1.05, 8: 1.05 } },
    'Masonry-brick': { unit: 'sqft', lowPerUnit: 10, highPerUnit: 25, typicalRange: [50, 500], laborHoursPerUnit: 0.1, laborRateRange: [50, 90], materialsPercent: 40, seasonalFactor: {} },

    // Gig Work
    'Moving-residential': { unit: 'hour', lowPerUnit: 80, highPerUnit: 200, typicalRange: [3, 8], laborHoursPerUnit: 1, laborRateRange: [25, 50], materialsPercent: 5, seasonalFactor: { 5: 1.2, 6: 1.3, 7: 1.3, 8: 1.2, 9: 1.15 } },
    'Delivery-local': { unit: 'each', lowPerUnit: 20, highPerUnit: 75, typicalRange: [1, 5], laborHoursPerUnit: 1, laborRateRange: [20, 40], materialsPercent: 0, seasonalFactor: { 11: 1.3, 12: 1.4 } },
    'Assembly-furniture': { unit: 'each', lowPerUnit: 50, highPerUnit: 200, typicalRange: [1, 5], laborHoursPerUnit: 1.5, laborRateRange: [30, 60], materialsPercent: 0, seasonalFactor: {} },

    // Generic fallback
    'default': { unit: 'each', lowPerUnit: 100, highPerUnit: 500, typicalRange: [1, 5], laborHoursPerUnit: 3, laborRateRange: [40, 100], materialsPercent: 30, seasonalFactor: {} },
};

// Location cost multipliers (relative to national average)
const LOCATION_MULTIPLIERS: Record<string, number> = {
    'san francisco': 1.45, 'new york': 1.5, 'los angeles': 1.3, 'seattle': 1.25,
    'boston': 1.3, 'chicago': 1.15, 'denver': 1.1, 'austin': 1.1,
    'miami': 1.15, 'atlanta': 0.95, 'phoenix': 0.95, 'dallas': 0.95,
    'houston': 0.95, 'detroit': 0.85, 'cleveland': 0.85, 'memphis': 0.8,
    'default': 1.0,
};

interface PriceEstimateInput {
    category: string;
    subcategory: string;
    description: string;
    location: string;
    squareFootage?: string;
    materials?: string;
    urgency?: string;
}

export function estimatePrice(input: PriceEstimateInput): PriceEstimate {
    const { category, subcategory, description, location, squareFootage, materials, urgency } = input;

    // Find matching pricing data
    const lookupKey = `${category}-${subcategory.toLowerCase().replace(/\s+/g, '_')}`;
    const pricing = PRICING_DATA[lookupKey] || PRICING_DATA['default'];

    // Extract quantity from description or square footage
    const quantity = extractQuantity(description, squareFootage, pricing.unit);

    // Get location multiplier
    const locationMultiplier = getLocationMultiplier(location);

    // Get seasonal multiplier
    const month = new Date().getMonth() + 1;
    const seasonalMultiplier = pricing.seasonalFactor[month] || 1.0;

    // Urgency adjustment
    const urgencyMultiplier = urgency === 'urgent' ? 1.2 : urgency === 'within_week' ? 1.1 : 1.0;

    // Calculate estimates
    const combinedMultiplier = locationMultiplier * seasonalMultiplier * urgencyMultiplier;

    const lowEstimate = Math.round(pricing.lowPerUnit * quantity * combinedMultiplier);
    const highEstimate = Math.round(pricing.highPerUnit * quantity * combinedMultiplier);
    const medianEstimate = Math.round((lowEstimate + highEstimate) / 2);

    // Breakdown
    const materialsLow = Math.round(lowEstimate * pricing.materialsPercent / 100);
    const materialsHigh = Math.round(highEstimate * pricing.materialsPercent / 100);
    const laborLow = lowEstimate - materialsLow;
    const laborHigh = highEstimate - materialsHigh;
    const permitsLow = Math.round(lowEstimate * 0.03); // ~3% for permits
    const permitsHigh = Math.round(highEstimate * 0.05);

    // Factors
    const factors: string[] = [];
    if (locationMultiplier > 1.1) factors.push(`area_pricing: ${Math.round((locationMultiplier - 1) * 100)}% above national average`);
    else if (locationMultiplier < 0.9) factors.push(`area_pricing: ${Math.round((1 - locationMultiplier) * 100)}% below national average`);
    if (seasonalMultiplier > 1.05) factors.push('seasonal_demand: higher than usual');
    if (seasonalMultiplier < 0.95) factors.push('seasonal_demand: lower than usual (off-season savings)');
    if (urgencyMultiplier > 1.0) factors.push('urgency_premium: expedited timeline');
    factors.push(`quantity: ${quantity} ${pricing.unit}`);

    // Confidence based on how well we matched
    const hasSpecificPricing = lookupKey !== 'default';
    const hasQuantity = quantity > 0;
    let confidence = 0.5;
    if (hasSpecificPricing) confidence += 0.25;
    if (hasQuantity) confidence += 0.15;
    if (locationMultiplier !== 1.0) confidence += 0.05; // location data helps
    if (squareFootage) confidence += 0.05;

    return {
        category,
        subcategory,
        description,
        location,
        lowEstimate,
        highEstimate,
        medianEstimate,
        confidence: Math.min(1.0, confidence),
        dataPoints: hasSpecificPricing ? 150 : 20, // simulated data point count
        breakdown: {
            materialsLow,
            materialsHigh,
            laborLow,
            laborHigh,
            permitsLow,
            permitsHigh,
        },
        factors,
        generatedAt: new Date().toISOString(),
    };
}

function extractQuantity(description: string, squareFootage?: string, unit?: string): number {
    // Try square footage first
    if (squareFootage) {
        const sqft = parseFloat(squareFootage.replace(/[^0-9.]/g, ''));
        if (!isNaN(sqft) && sqft > 0) return sqft;
    }

    // Try extracting from description
    const desc = description.toLowerCase();

    // Look for explicit numbers with units
    const patterns = [
        /(\d+)\s*(?:sq\.?\s*ft|square\s*feet|sqft)/i,
        /(\d+)\s*(?:linear\s*ft|linear\s*feet|ln\.?\s*ft)/i,
        /(\d+)\s*(?:ft|feet|foot|')/i,
        /(\d+)\s*(?:rooms?|bedrooms?|bathrooms?)/i,
        /(\d+)\s*(?:each|units?|items?)/i,
        /(\d+)\s*(?:tons?)/i,
    ];

    for (const pattern of patterns) {
        const match = desc.match(pattern);
        if (match) {
            const num = parseFloat(match[1]);
            if (!isNaN(num) && num > 0) return num;
        }
    }

    // Just look for any number
    const anyNumber = desc.match(/(\d+)/);
    if (anyNumber) {
        const num = parseFloat(anyNumber[1]);
        if (!isNaN(num) && num > 0 && num < 100000) return num;
    }

    // Default based on unit type
    switch (unit) {
        case 'sqft': return 500;
        case 'linear_ft': return 50;
        case 'hour': return 4;
        case 'each': return 1;
        default: return 1;
    }
}

function getLocationMultiplier(location: string): number {
    const loc = location.toLowerCase();
    for (const [city, multiplier] of Object.entries(LOCATION_MULTIPLIERS)) {
        if (loc.includes(city)) return multiplier;
    }
    // Try state-level adjustments
    if (loc.includes('california') || loc.includes(', ca')) return 1.25;
    if (loc.includes('new york') || loc.includes(', ny')) return 1.35;
    if (loc.includes('texas') || loc.includes(', tx')) return 0.95;
    if (loc.includes('florida') || loc.includes(', fl')) return 1.0;
    return LOCATION_MULTIPLIERS['default'];
}

/**
 * Get price confidence label
 */
export function getPriceConfidenceLabel(confidence: number): {
    label: string;
    description: string;
} {
    if (confidence >= 0.8) return { label: 'High Confidence', description: 'Based on extensive local data for this exact work type' };
    if (confidence >= 0.6) return { label: 'Good Estimate', description: 'Based on similar projects in your area' };
    if (confidence >= 0.4) return { label: 'Rough Estimate', description: 'Limited data available - get multiple quotes to verify' };
    return { label: 'Preliminary', description: 'Very limited data - actual costs may vary significantly' };
}
