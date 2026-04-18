'use client';
import { useState } from 'react';
import { QuoteLineItem, QuoteLineItemType, StructuredQuote, QuoteMilestone } from '@/types';
import { buildStructuredQuote, formatCurrency, generateQuoteTemplate } from '@/services/structuredQuote';
import { PaymentTerms } from '@/types';

interface StructuredQuoteBuilderProps {
    quoteId: string;
    category: string;
    subcategory: string;
    onQuoteBuilt?: (quote: StructuredQuote) => void;
}

const LINE_ITEM_TYPES: { value: QuoteLineItemType; label: string; icon: string }[] = [
    { value: 'materials', label: 'Materials', icon: '🧱' },
    { value: 'labor', label: 'Labor', icon: '👷' },
    { value: 'permits', label: 'Permits/Fees', icon: '📋' },
    { value: 'equipment', label: 'Equipment', icon: '🔧' },
    { value: 'overhead', label: 'Overhead', icon: '🏢' },
    { value: 'add_on', label: 'Optional Add-on', icon: '➕' },
    { value: 'discount', label: 'Discount', icon: '🏷️' },
];

export default function StructuredQuoteBuilder({ quoteId, category, subcategory, onQuoteBuilt }: StructuredQuoteBuilderProps) {
    const [lineItems, setLineItems] = useState<Omit<QuoteLineItem, 'id' | 'totalPrice'>[]>([]);
    const [milestones, setMilestones] = useState<Omit<QuoteMilestone, 'id'>[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>({ schedule: 'fifty_fifty' });
    const [taxRate, setTaxRate] = useState(0);
    const [warranty, setWarranty] = useState({ description: '', months: 0 });
    const [showMilestones, setShowMilestones] = useState(false);

    // Load template
    const loadTemplate = () => {
        const template = generateQuoteTemplate(category, subcategory);
        setLineItems(template);
    };

    // Add line item
    const addItem = () => {
        setLineItems([...lineItems, {
            type: 'materials', name: '', quantity: 1, unit: 'each',
            unitPrice: 0, isOptional: false,
        }]);
    };

    // Update line item
    const updateItem = (idx: number, field: string, value: any) => {
        setLineItems(items => items.map((item, i) =>
            i === idx ? { ...item, [field]: value } : item
        ));
    };

    // Remove line item
    const removeItem = (idx: number) => {
        setLineItems(items => items.filter((_, i) => i !== idx));
    };

    // Add milestone
    const addMilestone = () => {
        const totalPct = milestones.reduce((sum, m) => sum + m.percentageOfTotal, 0);
        setMilestones([...milestones, {
            name: '', description: '', percentageOfTotal: Math.max(0, 100 - totalPct),
            estimatedDays: 1, releaseOnCompletion: true,
        }]);
    };

    // Calculate preview
    const preview = lineItems.length > 0 ? buildStructuredQuote({
        quoteId, lineItems, milestones: showMilestones ? milestones : undefined,
        paymentTerms, taxRate, warrantyDescription: warranty.description || undefined,
        warrantyDurationMonths: warranty.months || undefined,
    }) : null;

    // Submit
    const handleSubmit = () => {
        if (preview) onQuoteBuilt?.(preview);
    };

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', padding: '20px',
            border: '1px solid #333',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>
                        📋 Quote Builder
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        Build a detailed, line-by-line quote
                    </div>
                </div>
                <button onClick={loadTemplate} style={{
                    background: '#3b82f622', border: '1px solid #3b82f644',
                    borderRadius: '8px', padding: '6px 12px', color: '#60a5fa',
                    fontSize: '12px', cursor: 'pointer',
                }}>
                    Load Template
                </button>
            </div>

            {/* Line Items */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#aaa', fontWeight: 600 }}>Line Items</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>{lineItems.length} items</span>
                </div>

                {/* Header Row */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px 80px 40px',
                    gap: '8px', padding: '6px 0', borderBottom: '1px solid #333',
                    fontSize: '10px', color: '#666', textTransform: 'uppercase',
                }}>
                    <span>Type</span>
                    <span>Description</span>
                    <span>Qty</span>
                    <span>Unit Price</span>
                    <span>Total</span>
                    <span></span>
                </div>

                {lineItems.map((item, idx) => (
                    <div key={idx} style={{
                        display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px 80px 40px',
                        gap: '8px', padding: '8px 0', borderBottom: '1px solid #ffffff06',
                        alignItems: 'center',
                    }}>
                        <select
                            value={item.type}
                            onChange={e => updateItem(idx, 'type', e.target.value)}
                            style={{
                                background: '#333', border: '1px solid #444', borderRadius: '6px',
                                padding: '6px', color: '#ddd', fontSize: '12px',
                            }}
                        >
                            {LINE_ITEM_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={item.name}
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                            placeholder="Item description"
                            style={{
                                background: '#333', border: '1px solid #444', borderRadius: '6px',
                                padding: '6px 10px', color: '#ddd', fontSize: '12px',
                            }}
                        />
                        <input
                            type="number"
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            style={{
                                background: '#333', border: '1px solid #444', borderRadius: '6px',
                                padding: '6px', color: '#ddd', fontSize: '12px',
                            }}
                        />
                        <input
                            type="number"
                            value={item.unitPrice}
                            onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            style={{
                                background: '#333', border: '1px solid #444', borderRadius: '6px',
                                padding: '6px', color: '#ddd', fontSize: '12px',
                            }}
                        />
                        <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                            {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                        <button onClick={() => removeItem(idx)} style={{
                            background: 'none', border: 'none', color: '#ef4444',
                            cursor: 'pointer', fontSize: '14px',
                        }}>
                            ✕
                        </button>
                    </div>
                ))}

                <button onClick={addItem} style={{
                    width: '100%', padding: '10px', background: '#ffffff06',
                    border: '1px dashed #444', borderRadius: '8px',
                    color: '#888', fontSize: '12px', cursor: 'pointer', marginTop: '8px',
                }}>
                    + Add Line Item
                </button>
            </div>

            {/* Milestones Toggle */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: 'pointer', fontSize: '13px', color: '#aaa',
                }}>
                    <input
                        type="checkbox"
                        checked={showMilestones}
                        onChange={e => setShowMilestones(e.target.checked)}
                    />
                    Add payment milestones
                </label>

                {showMilestones && (
                    <div style={{ marginTop: '8px' }}>
                        {milestones.map((m, idx) => (
                            <div key={idx} style={{
                                display: 'flex', gap: '8px', marginBottom: '6px',
                                alignItems: 'center',
                            }}>
                                <input
                                    type="text"
                                    value={m.name}
                                    onChange={e => setMilestones(ms => ms.map((mm, i) => i === idx ? { ...mm, name: e.target.value } : mm))}
                                    placeholder="Milestone name"
                                    style={{
                                        flex: 1, background: '#333', border: '1px solid #444',
                                        borderRadius: '6px', padding: '6px 10px', color: '#ddd', fontSize: '12px',
                                    }}
                                />
                                <input
                                    type="number"
                                    value={m.percentageOfTotal}
                                    onChange={e => setMilestones(ms => ms.map((mm, i) => i === idx ? { ...mm, percentageOfTotal: parseFloat(e.target.value) || 0 } : mm))}
                                    style={{
                                        width: '60px', background: '#333', border: '1px solid #444',
                                        borderRadius: '6px', padding: '6px', color: '#ddd', fontSize: '12px',
                                    }}
                                />
                                <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                            </div>
                        ))}
                        <button onClick={addMilestone} style={{
                            background: 'none', border: 'none', color: '#60a5fa',
                            fontSize: '12px', cursor: 'pointer',
                        }}>
                            + Add Milestone
                        </button>
                    </div>
                )}
            </div>

            {/* Payment Terms */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>
                    Payment Terms
                </div>
                <select
                    value={paymentTerms.schedule}
                    onChange={e => setPaymentTerms({ ...paymentTerms, schedule: e.target.value as any })}
                    style={{
                        width: '100%', background: '#333', border: '1px solid #444',
                        borderRadius: '8px', padding: '10px', color: '#ddd', fontSize: '13px',
                    }}
                >
                    <option value="upfront">100% Upfront</option>
                    <option value="fifty_fifty">50% Deposit, 50% on Completion</option>
                    <option value="milestone">Milestone-Based</option>
                    <option value="net_30">Net 30</option>
                </select>
            </div>

            {/* Tax & Warranty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                        Tax Rate (%)
                    </label>
                    <input
                        type="number"
                        value={taxRate}
                        onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                        style={{
                            width: '100%', background: '#333', border: '1px solid #444',
                            borderRadius: '6px', padding: '8px', color: '#ddd', fontSize: '13px',
                        }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                        Warranty (months)
                    </label>
                    <input
                        type="number"
                        value={warranty.months}
                        onChange={e => setWarranty({ ...warranty, months: parseInt(e.target.value) || 0 })}
                        style={{
                            width: '100%', background: '#333', border: '1px solid #444',
                            borderRadius: '6px', padding: '8px', color: '#ddd', fontSize: '13px',
                        }}
                    />
                </div>
            </div>

            {/* Quote Preview */}
            {preview && (
                <div style={{
                    background: '#22c55e11', border: '1px solid #22c55e33',
                    borderRadius: '12px', padding: '16px', marginBottom: '16px',
                }}>
                    <div style={{ fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>
                        Quote Preview
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#888' }}>Materials:</span>
                        <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.materialsSubtotal)}</span>
                        <span style={{ color: '#888' }}>Labor:</span>
                        <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.laborSubtotal)}</span>
                        <span style={{ color: '#888' }}>Permits:</span>
                        <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.permitsSubtotal)}</span>
                        <span style={{ color: '#888' }}>Equipment:</span>
                        <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.equipmentSubtotal)}</span>
                        <span style={{ color: '#888' }}>Overhead:</span>
                        <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.overheadSubtotal)}</span>
                        {preview.discounts > 0 && <>
                            <span style={{ color: '#f59e0b' }}>Discounts:</span>
                            <span style={{ color: '#f59e0b', textAlign: 'right' }}>-{formatCurrency(preview.discounts)}</span>
                        </>}
                        {preview.taxAmount > 0 && <>
                            <span style={{ color: '#888' }}>Tax ({preview.taxRate}%):</span>
                            <span style={{ color: '#ddd', textAlign: 'right' }}>{formatCurrency(preview.taxAmount)}</span>
                        </>}
                    </div>
                    <div style={{
                        borderTop: '1px solid #22c55e33', marginTop: '8px', paddingTop: '8px',
                        display: 'flex', justifyContent: 'space-between',
                    }}>
                        <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Total:</span>
                        <span style={{ fontSize: '18px', color: '#22c55e', fontWeight: 700 }}>
                            {formatCurrency(preview.totalAmount)}
                        </span>
                    </div>
                </div>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={!preview || lineItems.length === 0}
                style={{
                    width: '100%', padding: '12px',
                    background: preview ? '#22c55e' : '#333',
                    border: 'none', borderRadius: '8px',
                    color: preview ? '#fff' : '#666',
                    fontSize: '14px', fontWeight: 600,
                    cursor: preview ? 'pointer' : 'not-allowed',
                }}
            >
                Submit Structured Quote
            </button>
        </div>
    );
}
