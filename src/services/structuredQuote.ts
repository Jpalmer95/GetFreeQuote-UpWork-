/**
 * Structured Quote Builder Service
 * 
 * Builds structured quotes from line items, calculates totals,
 * validates milestones, and generates apples-to-apples comparisons.
 */

import {
    StructuredQuote,
    QuoteLineItem,
    QuoteMilestone,
    QuoteLineItemType,
    PaymentTerms,
    Quote,
} from '@/types';

interface QuoteBuilderInput {
    quoteId: string;
    lineItems: Omit<QuoteLineItem, 'id' | 'totalPrice'>[];
    milestones?: Omit<QuoteMilestone, 'id'>[];
    paymentTerms: PaymentTerms;
    taxRate?: number;
    warrantyDescription?: string;
    warrantyDurationMonths?: number;
}

/**
 * Build a structured quote with calculated subtotals
 */
export function buildStructuredQuote(input: QuoteBuilderInput): StructuredQuote {
    const { quoteId, lineItems, milestones, paymentTerms, taxRate = 0 } = input;

    // Calculate line item totals
    const calculatedItems: QuoteLineItem[] = lineItems.map((item, i) => ({
        ...item,
        id: `li_${Date.now()}_${i}`,
        totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

    // Calculate subtotals by type
    const subtotals = calculateSubtotals(calculatedItems);

    // Validate and calculate milestones
    const calculatedMilestones: QuoteMilestone[] = (milestones || []).map((m, i) => ({
        ...m,
        id: `ms_${Date.now()}_${i}`,
    }));
    validateMilestones(calculatedMilestones, subtotals.subtotal);

    // Calculate tax
    const taxAmount = Math.round(subtotals.subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotals.subtotal + taxAmount) * 100) / 100;

    return {
        id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        quoteId,
        lineItems: calculatedItems,
        milestones: calculatedMilestones,
        materialsSubtotal: subtotals.materials,
        laborSubtotal: subtotals.labor,
        permitsSubtotal: subtotals.permits,
        equipmentSubtotal: subtotals.equipment,
        overheadSubtotal: subtotals.overhead,
        optionalAddOns: subtotals.addOns,
        discounts: subtotals.discounts,
        subtotal: subtotals.subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        paymentTerms,
        warrantyDescription: input.warrantyDescription,
        warrantyDurationMonths: input.warrantyDurationMonths,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

function calculateSubtotals(items: QuoteLineItem[]): {
    materials: number;
    labor: number;
    permits: number;
    equipment: number;
    overhead: number;
    addOns: number;
    discounts: number;
    subtotal: number;
} {
    const result = {
        materials: 0,
        labor: 0,
        permits: 0,
        equipment: 0,
        overhead: 0,
        addOns: 0,
        discounts: 0,
        subtotal: 0,
    };

    let regularSubtotal = 0;

    for (const item of items) {
        if (item.isOptional) {
            result.addOns += item.totalPrice;
            continue;
        }

        switch (item.type) {
            case 'materials': result.materials += item.totalPrice; break;
            case 'labor': result.labor += item.totalPrice; break;
            case 'permits': result.permits += item.totalPrice; break;
            case 'equipment': result.equipment += item.totalPrice; break;
            case 'overhead': result.overhead += item.totalPrice; break;
            case 'discount': result.discounts += item.totalPrice; break;
            default: break;
        }
        regularSubtotal += item.totalPrice;
    }

    result.subtotal = regularSubtotal;
    return result;
}

function validateMilestones(milestones: QuoteMilestone[], totalAmount: number): void {
    if (milestones.length === 0) return;

    const totalPercentage = milestones.reduce((sum, m) => sum + m.percentageOfTotal, 0);
    if (Math.abs(totalPercentage - 100) > 1) {
        console.warn(`Milestone percentages sum to ${totalPercentage}%, expected 100%`);
    }
}

/**
 * Compare two structured quotes side-by-side
 */
export function compareQuotes(
    quoteA: StructuredQuote,
    quoteB: StructuredQuote
): {
    comparison: {
        category: string;
        quoteA: number;
        quoteB: number;
        difference: number;
        percentDifference: number;
        winner: 'A' | 'B' | 'tie';
    }[];
    totalDifference: number;
    totalPercentDifference: number;
    summary: string;
} {
    const categories = [
        { key: 'materials', label: 'Materials' },
        { key: 'labor', label: 'Labor' },
        { key: 'permits', label: 'Permits' },
        { key: 'equipment', label: 'Equipment' },
        { key: 'overhead', label: 'Overhead' },
        { key: 'optionalAddOns', label: 'Optional Add-ons' },
    ];

    const comparison = categories.map(cat => {
        const valA = (quoteA as any)[`${cat.key}Subtotal`] ?? (quoteA as any)[cat.key] ?? 0;
        const valB = (quoteB as any)[`${cat.key}Subtotal`] ?? (quoteB as any)[cat.key] ?? 0;
        const difference = valB - valA;
        const avgVal = (valA + valB) / 2;
        const percentDifference = avgVal > 0 ? (difference / avgVal) * 100 : 0;

        let winner: 'A' | 'B' | 'tie' = 'tie';
        if (Math.abs(difference) > 1) {
            winner = difference < 0 ? 'B' : 'A';
        }

        return {
            category: cat.label,
            quoteA: Math.round(valA),
            quoteB: Math.round(valB),
            difference: Math.round(difference),
            percentDifference: Math.round(percentDifference),
            winner,
        };
    });

    const totalDifference = quoteB.totalAmount - quoteA.totalAmount;
    const avgTotal = (quoteA.totalAmount + quoteB.totalAmount) / 2;
    const totalPercentDifference = avgTotal > 0 ? Math.round((totalDifference / avgTotal) * 100) : 0;

    let summary: string;
    if (Math.abs(totalPercentDifference) < 5) {
        summary = 'Both quotes are similarly priced. Compare line items and warranties to decide.';
    } else if (totalDifference < 0) {
        summary = `Quote B is ${Math.abs(totalPercentDifference)}% cheaper ($${Math.abs(totalDifference)} less). Check if materials or scope differ.`;
    } else {
        summary = `Quote A is ${Math.abs(totalPercentDifference)}% cheaper ($${Math.abs(totalDifference)} less). Check if materials or scope differ.`;
    }

    return { comparison, totalDifference, totalPercentDifference, summary };
}

/**
 * Generate quote template for a category
 */
export function generateQuoteTemplate(
    category: string,
    subcategory: string
): Omit<QuoteLineItem, 'id' | 'totalPrice'>[] {
    // Common templates - vendors customize these
    const templates: Record<string, Omit<QuoteLineItem, 'id' | 'totalPrice'>[]> = {
        'Plumbing-default': [
            { type: 'labor', name: 'Plumber labor', quantity: 4, unit: 'hours', unitPrice: 100, isOptional: false, laborHours: 4, laborRate: 100 },
            { type: 'materials', name: 'Pipes and fittings', quantity: 1, unit: 'lot', unitPrice: 150, isOptional: false, materialGrade: 'standard' },
            { type: 'permits', name: 'Plumbing permit', quantity: 1, unit: 'each', unitPrice: 75, isOptional: false },
            { type: 'overhead', name: 'Overhead (truck, tools, insurance)', quantity: 1, unit: 'each', unitPrice: 100, isOptional: false },
        ],
        'Electrical-default': [
            { type: 'labor', name: 'Electrician labor', quantity: 4, unit: 'hours', unitPrice: 90, isOptional: false, laborHours: 4, laborRate: 90 },
            { type: 'materials', name: 'Wire and materials', quantity: 1, unit: 'lot', unitPrice: 200, isOptional: false, materialGrade: 'standard' },
            { type: 'permits', name: 'Electrical permit', quantity: 1, unit: 'each', unitPrice: 100, isOptional: false },
        ],
        'default': [
            { type: 'labor', name: 'Labor', quantity: 4, unit: 'hours', unitPrice: 75, isOptional: false, laborHours: 4, laborRate: 75 },
            { type: 'materials', name: 'Materials', quantity: 1, unit: 'lot', unitPrice: 200, isOptional: false },
            { type: 'overhead', name: 'Overhead', quantity: 1, unit: 'each', unitPrice: 100, isOptional: false },
        ],
    };

    const key = `${category}-${subcategory}` || category;
    return templates[key] || templates['default'];
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
