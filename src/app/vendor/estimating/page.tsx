'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { EstimatingTemplate, EstimatingLineItem, PricingModel, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES, KnownIndustryVertical, IndustryVertical } from '@/types';
import { vendorApi } from '@/services/vendorApi';
import { hasPermission, VendorRole, getRoleLabel } from '@/services/vendorAuth';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
    { value: 'hourly', label: 'Hourly Rate' },
    { value: 'per_unit', label: 'Per Unit' },
    { value: 'flat_fee', label: 'Flat Fee' },
    { value: 'tiered', label: 'Tiered Pricing' },
    { value: 'formula', label: 'Custom Formula' },
];

function emptyLineItem(): EstimatingLineItem {
    return { name: '', pricingModel: 'hourly', rate: 0 };
}

export default function EstimatingPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [hasVendorContext, setHasVendorContext] = useState(false);
    const [templates, setTemplates] = useState<EstimatingTemplate[]>([]);
    const [editing, setEditing] = useState<EstimatingTemplate | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userRole, setUserRole] = useState<VendorRole>('owner');
    const canCreate = hasPermission(userRole, 'estimating.create');
    const canEditTemplate = hasPermission(userRole, 'estimating.edit');
    const canDelete = hasPermission(userRole, 'estimating.delete');

    const [form, setForm] = useState({
        name: '',
        serviceCategory: '',
        industryVertical: 'Other' as string,
        laborRate: '',
        materialMarkupPercent: '',
        minimumCharge: '',
        isDefault: false,
        lineItems: [emptyLineItem()] as EstimatingLineItem[],
    });

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); return; }
        if (!user) return;
        const load = async () => {
            const ctx = await vendorApi.getContext();
            if (ctx) {
                setHasVendorContext(true);
                setUserRole(ctx.role);
                const result = await vendorApi.getTemplates();
                setTemplates(result.templates);
            }
        };
        load();
    }, [user, isLoading, router]);

    const startCreate = () => {
        setForm({
            name: '', serviceCategory: '', industryVertical: 'Other',
            laborRate: '', materialMarkupPercent: '', minimumCharge: '',
            isDefault: false, lineItems: [emptyLineItem()],
        });
        setEditing(null);
        setIsNew(true);
    };

    const startEdit = (t: EstimatingTemplate) => {
        setForm({
            name: t.name,
            serviceCategory: t.serviceCategory,
            industryVertical: t.industryVertical,
            laborRate: t.laborRate.toString(),
            materialMarkupPercent: t.materialMarkupPercent.toString(),
            minimumCharge: t.minimumCharge.toString(),
            isDefault: t.isDefault,
            lineItems: t.lineItems.length > 0 ? t.lineItems : [emptyLineItem()],
        });
        setEditing(t);
        setIsNew(true);
    };

    const cancelEdit = () => { setIsNew(false); setEditing(null); };

    const updateLineItem = (index: number, updates: Partial<EstimatingLineItem>) => {
        setForm(prev => {
            const items = [...prev.lineItems];
            items[index] = { ...items[index], ...updates };
            return { ...prev, lineItems: items };
        });
    };

    const addLineItem = () => {
        setForm(prev => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }));
    };

    const removeLineItem = (index: number) => {
        setForm(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
    };

    const addTier = (itemIndex: number) => {
        setForm(prev => {
            const items = [...prev.lineItems];
            const tiers = items[itemIndex].tiers || [];
            items[itemIndex] = { ...items[itemIndex], tiers: [...tiers, { minQty: 0, maxQty: 0, rate: 0 }] };
            return { ...prev, lineItems: items };
        });
    };

    const updateTier = (itemIndex: number, tierIndex: number, updates: Partial<{ minQty: number; maxQty: number; rate: number }>) => {
        setForm(prev => {
            const items = [...prev.lineItems];
            const tiers = [...(items[itemIndex].tiers || [])];
            tiers[tierIndex] = { ...tiers[tierIndex], ...updates };
            items[itemIndex] = { ...items[itemIndex], tiers };
            return { ...prev, lineItems: items };
        });
    };

    const removeTier = (itemIndex: number, tierIndex: number) => {
        setForm(prev => {
            const items = [...prev.lineItems];
            const tiers = (items[itemIndex].tiers || []).filter((_, i) => i !== tierIndex);
            items[itemIndex] = { ...items[itemIndex], tiers };
            return { ...prev, lineItems: items };
        });
    };

    const handleSave = async () => {
        if (!canCreate && isNew) return;
        if (!canEditTemplate && !isNew) return;
        if (!hasVendorContext || !form.name.trim()) return;
        setSaving(true);
        try {
            const cleanItems = form.lineItems
                .filter(li => li.name.trim())
                .map(li => ({
                    ...li,
                    tiers: li.pricingModel === 'tiered' ? li.tiers : undefined,
                    formula: li.pricingModel === 'formula' ? li.formula : undefined,
                }));

            const templateData = {
                name: form.name,
                serviceCategory: form.serviceCategory,
                industryVertical: form.industryVertical,
                laborRate: parseFloat(form.laborRate) || 0,
                materialMarkupPercent: parseFloat(form.materialMarkupPercent) || 0,
                minimumCharge: parseFloat(form.minimumCharge) || 0,
                isDefault: form.isDefault,
                lineItems: cleanItems,
            };

            if (editing) {
                const updated = await vendorApi.updateTemplate(editing.id, templateData);
                setTemplates(prev => prev.map(t => t.id === editing.id ? updated : t));
            } else {
                const created = await vendorApi.createTemplate(templateData);
                setTemplates(prev => [...prev, created]);
            }
            setIsNew(false);
            setEditing(null);
        } catch (error) {
            console.error('Error saving template:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await vendorApi.deleteTemplate(id);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    };

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    if (!hasVendorContext) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.noProfile}>
                        <div className={styles.noProfileTitle}>Create your vendor profile first</div>
                        <div className={styles.noProfileDesc}>You need a vendor profile before setting up estimating templates.</div>
                        <Link href="/vendor/profile" className={styles.linkBtn}>Create Profile</Link>
                    </div>
                </div>
            </div>
        );
    }

    const subcats = INDUSTRY_SUBCATEGORIES[form.industryVertical as KnownIndustryVertical] || ['Other'];

    return (
        <div className={styles.container}>
            <Navbar />
            <header className={styles.pageHeader}>
                <h2 className="gradient-text">Estimating Templates</h2>
                <Link href="/vendor" className={styles.backLink}>Back to Portal</Link>
            </header>

            <div className={styles.content}>
                {!isNew && (
                    <>
                        {canCreate && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className={styles.createBtn} onClick={startCreate}>+ New Template</button>
                            </div>
                        )}
                        {userRole !== 'owner' && (
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
                                Viewing as {getRoleLabel(userRole)}
                            </div>
                        )}

                        {templates.length === 0 ? (
                            <div className={`glass-panel ${styles.card}`}>
                                <p className={styles.emptyMsg}>No estimating templates yet. Create one to auto-generate accurate quotes.</p>
                            </div>
                        ) : (
                            <div className={styles.templateList}>
                                {templates.map(t => (
                                    <div key={t.id} className={styles.templateCard}>
                                        <div className={styles.templateHeader}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span className={styles.templateName}>{t.name}</span>
                                                    {t.isDefault && <span className={styles.defaultBadge}>Default</span>}
                                                </div>
                                                <div className={styles.templateMeta}>
                                                    {t.industryVertical} &middot; {t.serviceCategory} &middot; ${t.laborRate}/hr &middot; {t.lineItems.length} line items
                                                </div>
                                            </div>
                                            <div className={styles.templateActions}>
                                                {canEditTemplate && <button className={styles.editBtn} onClick={() => startEdit(t)}>Edit</button>}
                                                {canDelete && <button className={styles.deleteBtn} onClick={() => handleDelete(t.id)}>Delete</button>}
                                            </div>
                                        </div>
                                        <div className={styles.lineItemSummary}>
                                            {t.lineItems.slice(0, 5).map((li, i) => (
                                                <span key={i}>
                                                    {li.name}: ${li.rate}{li.pricingModel === 'hourly' ? '/hr' : li.pricingModel === 'per_unit' ? `/${li.unit || 'unit'}` : ''}
                                                </span>
                                            ))}
                                            {t.lineItems.length > 5 && <span>+{t.lineItems.length - 5} more</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {isNew && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>{editing ? 'Edit Template' : 'New Estimating Template'}</div>
                        <div className={styles.cardDesc}>Define your pricing structure for a service category</div>

                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Template Name *</label>
                                <input className={styles.input} value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Standard Plumbing Estimate" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Industry</label>
                                <select className={styles.select} value={form.industryVertical}
                                    onChange={e => setForm(p => ({ ...p, industryVertical: e.target.value, serviceCategory: '' }))}>
                                    {INDUSTRY_VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Service Category</label>
                                <select className={styles.select} value={form.serviceCategory}
                                    onChange={e => setForm(p => ({ ...p, serviceCategory: e.target.value }))}>
                                    <option value="">Select category</option>
                                    {subcats.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Base Labor Rate ($/hr)</label>
                                <input className={styles.input} type="number" value={form.laborRate}
                                    onChange={e => setForm(p => ({ ...p, laborRate: e.target.value }))}
                                    placeholder="85" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Material Markup (%)</label>
                                <input className={styles.input} type="number" value={form.materialMarkupPercent}
                                    onChange={e => setForm(p => ({ ...p, materialMarkupPercent: e.target.value }))}
                                    placeholder="15" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Minimum Charge ($)</label>
                                <input className={styles.input} type="number" value={form.minimumCharge}
                                    onChange={e => setForm(p => ({ ...p, minimumCharge: e.target.value }))}
                                    placeholder="150" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.checkboxRow}>
                                    <input type="checkbox" checked={form.isDefault}
                                        onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
                                    Default template for this industry
                                </label>
                            </div>
                        </div>

                        <div className={styles.lineItemsSection}>
                            <div className={styles.cardTitle}>Line Items</div>
                            <div className={styles.cardDesc}>Define individual pricing items for your estimate</div>

                            {form.lineItems.map((item, i) => (
                                <div key={i} className={styles.lineItemCard}>
                                    <div className={styles.lineItemHeader}>
                                        <span className={styles.lineItemTitle}>Item {i + 1}</span>
                                        {form.lineItems.length > 1 && (
                                            <button className={styles.removeItemBtn} onClick={() => removeLineItem(i)}>Remove</button>
                                        )}
                                    </div>
                                    <div className={styles.lineItemGrid}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Name</label>
                                            <input className={styles.input} value={item.name}
                                                onChange={e => updateLineItem(i, { name: e.target.value })}
                                                placeholder="Labor, Materials, etc." />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Pricing Model</label>
                                            <select className={styles.select} value={item.pricingModel}
                                                onChange={e => updateLineItem(i, { pricingModel: e.target.value as PricingModel })}>
                                                {PRICING_MODELS.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
                                            </select>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>
                                                {item.pricingModel === 'hourly' ? 'Rate ($/hr)' :
                                                 item.pricingModel === 'per_unit' ? 'Rate ($/unit)' :
                                                 item.pricingModel === 'flat_fee' ? 'Flat Fee ($)' :
                                                 item.pricingModel === 'tiered' ? 'Base Rate ($)' : 'Base Rate ($)'}
                                            </label>
                                            <input className={styles.input} type="number" value={item.rate || ''}
                                                onChange={e => updateLineItem(i, { rate: parseFloat(e.target.value) || 0 })}
                                                placeholder="0" />
                                        </div>
                                    </div>

                                    {item.pricingModel === 'per_unit' && (
                                        <div className={styles.formGrid} style={{ marginTop: '0.75rem' }}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>Unit Name</label>
                                                <input className={styles.input} value={item.unit || ''}
                                                    onChange={e => updateLineItem(i, { unit: e.target.value })}
                                                    placeholder="sq ft, linear ft, each" />
                                            </div>
                                        </div>
                                    )}

                                    {item.pricingModel === 'formula' && (
                                        <div className={styles.formGroupFull} style={{ marginTop: '0.75rem' }}>
                                            <label className={styles.label}>Formula (use variables: hours, sqft, units, rate)</label>
                                            <input className={styles.input} value={item.formula || ''}
                                                onChange={e => updateLineItem(i, { formula: e.target.value })}
                                                placeholder="(hours * rate) + (sqft * 2.5)" />
                                        </div>
                                    )}

                                    {item.pricingModel === 'tiered' && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <div className={styles.label} style={{ marginBottom: '0.5rem' }}>Tiers</div>
                                            {(item.tiers || []).map((tier, ti) => (
                                                <div key={ti} className={styles.tierRow}>
                                                    <div className={styles.formGroup}>
                                                        <label className={styles.label}>Min Qty</label>
                                                        <input className={styles.input} type="number" value={tier.minQty || ''}
                                                            onChange={e => updateTier(i, ti, { minQty: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className={styles.formGroup}>
                                                        <label className={styles.label}>Max Qty</label>
                                                        <input className={styles.input} type="number" value={tier.maxQty || ''}
                                                            onChange={e => updateTier(i, ti, { maxQty: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className={styles.formGroup}>
                                                        <label className={styles.label}>Rate ($)</label>
                                                        <input className={styles.input} type="number" value={tier.rate || ''}
                                                            onChange={e => updateTier(i, ti, { rate: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <button className={styles.removeItemBtn} onClick={() => removeTier(i, ti)}>X</button>
                                                </div>
                                            ))}
                                            <button className={styles.addBtn} onClick={() => addTier(i)}>+ Add Tier</button>
                                        </div>
                                    )}

                                    <div className={styles.formGrid} style={{ marginTop: '0.75rem' }}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Material Markup % (override)</label>
                                            <input className={styles.input} type="number"
                                                value={item.materialMarkupPercent ?? ''}
                                                onChange={e => updateLineItem(i, {
                                                    materialMarkupPercent: e.target.value ? parseFloat(e.target.value) : undefined
                                                })} placeholder="Use template default" />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Minimum Charge ($)</label>
                                            <input className={styles.input} type="number"
                                                value={item.minimumCharge ?? ''}
                                                onChange={e => updateLineItem(i, {
                                                    minimumCharge: e.target.value ? parseFloat(e.target.value) : undefined
                                                })} placeholder="No minimum" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button className={styles.addBtn} onClick={addLineItem}>+ Add Line Item</button>
                        </div>

                        <div className={styles.btnRow}>
                            <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                            <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.name.trim()}>
                                {saving ? 'Saving...' : editing ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
