'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ItemListing, ItemListingType } from '@/types';
import Navbar from '@/components/Navbar';

const CATEGORIES = ['Tool', 'Equipment', 'Vehicle', 'Material', 'Other'];
const TYPES: { value: ItemListingType; label: string }[] = [
    { value: 'RENT', label: 'For Rent' },
    { value: 'SELL', label: 'For Sale' },
    { value: 'BOTH', label: 'Rent or Sell' },
];

const card = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1.25rem',
    marginBottom: '1rem',
} as const;

export default function JitPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<ItemListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create-form state.
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        itemName: '', category: 'Tool', description: '', listingType: 'RENT' as ItemListingType,
        sellPrice: '', rentPricePerDay: '', rentPricePerWeek: '', deposit: '0',
        locationText: '', radiusMiles: '25',
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/jit/items');
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Could not load listings');
            setItems(json.data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        if (!form.itemName.trim()) { setMessage({ ok: false, text: 'Item name is required.' }); return; }
        setSubmitting(true);
        setMessage(null);
        try {
            const res = await fetch('/api/jit/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemName: form.itemName.trim(), category: form.category, description: form.description,
                    listingType: form.listingType,
                    sellPrice: form.sellPrice ? Number(form.sellPrice) : null,
                    rentPricePerDay: form.rentPricePerDay ? Number(form.rentPricePerDay) : null,
                    rentPricePerWeek: form.rentPricePerWeek ? Number(form.rentPricePerWeek) : null,
                    deposit: Number(form.deposit) || 0,
                    locationText: form.locationText, radiusMiles: Number(form.radiusMiles) || 25,
                }),
            });
            const json = await res.json();
            if (!json.success) { setMessage({ ok: false, text: json.error || 'Could not create listing.' }); }
            else {
                setMessage({ ok: true, text: 'Listing created!' });
                setShowForm(false);
                setForm({ ...form, itemName: '', description: '', sellPrice: '', rentPricePerDay: '', rentPricePerWeek: '' });
                load();
            }
        } catch (e: any) { setMessage({ ok: false, text: e.message }); }
        finally { setSubmitting(false); }
    };

    const priceLine = (i: ItemListing) => {
        const parts: string[] = [];
        if (i.listingType !== 'SELL' && i.rentPricePerDay) parts.push(`$${i.rentPricePerDay}/day`);
        if (i.listingType !== 'SELL' && i.rentPricePerWeek) parts.push(`$${i.rentPricePerWeek}/wk`);
        if (i.listingType !== 'RENT' && i.sellPrice) parts.push(`$${i.sellPrice} buy`);
        return parts.join(' · ') || 'Price on request';
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <Navbar />
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h1 style={{ margin: 0 }}>JIT Tools & Gear</h1>
                        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.6)' }}>
                            Rent or buy tools, equipment, and gear nearby — on demand.
                        </p>
                    </div>
                    {user && (
                        <button onClick={() => { setShowForm(v => !v); setMessage(null); }}
                            style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'var(--primary, #4f8cff)', color: '#fff', fontWeight: 600 }}>
                            {showForm ? 'Cancel' : '+ List an item'}
                        </button>
                    )}
                </div>

                {showForm && (
                    <div style={{ ...card, marginTop: '1.25rem', background: 'rgba(255,255,255,0.04)' }}>
                        <h3 style={{ marginTop: 0 }}>List an item</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                            <input placeholder="Item name *" value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} style={inp} />
                            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={form.listingType} onChange={e => setForm({ ...form, listingType: e.target.value as ItemListingType })} style={inp}>
                                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <input placeholder="Rent $/day" value={form.rentPricePerDay} onChange={e => setForm({ ...form, rentPricePerDay: e.target.value })} style={inp} />
                            <input placeholder="Rent $/week" value={form.rentPricePerWeek} onChange={e => setForm({ ...form, rentPricePerWeek: e.target.value })} style={inp} />
                            <input placeholder="Sell $ (if selling)" value={form.sellPrice} onChange={e => setForm({ ...form, sellPrice: e.target.value })} style={inp} />
                            <input placeholder="Deposit $" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} style={inp} />
                            <input placeholder="Location (city / jobsite)" value={form.locationText} onChange={e => setForm({ ...form, locationText: e.target.value })} style={inp} />
                            <input placeholder="Radius (miles)" value={form.radiusMiles} onChange={e => setForm({ ...form, radiusMiles: e.target.value })} style={inp} />
                        </div>
                        <textarea placeholder="Condition, availability, pickup/delivery, notes…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, width: '100%', marginTop: '0.75rem', resize: 'vertical' }} />
                        <div style={{ marginTop: '0.75rem' }}>
                            <button onClick={submit} disabled={submitting} style={{ padding: '0.6rem 1.5rem', borderRadius: '10px', border: 'none', cursor: submitting ? 'default' : 'pointer', background: 'var(--primary, #4f8cff)', color: '#fff', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>
                                {submitting ? 'Creating…' : 'Create listing'}
                            </button>
                        </div>
                        {message && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: message.ok ? '#4ade80' : '#f87171' }}>{message.text}</p>}
                    </div>
                )}

                {loading && <p style={{ marginTop: '1.5rem', color: 'rgba(255,255,255,0.6)' }}>Loading listings…</p>}
                {error && <p style={{ color: '#f87171', marginTop: '1.5rem' }}>{error}</p>}

                {!loading && !error && items.length === 0 && (
                    <p style={{ marginTop: '1.5rem', color: 'rgba(255,255,255,0.55)' }}>
                        No items listed yet{user ? ' — list your first tool!' : '.'}
                    </p>
                )}

                <div style={{ marginTop: '1.25rem' }}>
                    {items.map(i => (
                        <div key={i.id} style={card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{i.itemName}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                                        {i.category} · {i.locationText || 'Location TBD'}
                                    </div>
                                </div>
                                <span style={{ alignSelf: 'center', fontSize: '0.85rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: i.status === 'AVAILABLE' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)', color: i.status === 'AVAILABLE' ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>
                                    {i.status}
                                </span>
                            </div>
                            {i.description && <p style={{ margin: '0.6rem 0 0', fontSize: '0.92rem', color: 'rgba(255,255,255,0.75)' }}>{i.description}</p>}
                            <div style={{ marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--primary-light, #9dbdff)' }}>{priceLine(i)}</div>
                            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>Listed by {i.ownerName}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const inp = {
    width: '100%',
    padding: '0.55rem 0.7rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.04)',
    color: 'inherit',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
};
