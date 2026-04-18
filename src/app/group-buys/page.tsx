'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import MaterialGroupBuyCard from '@/components/MaterialGroupBuyCard';
import { MaterialGroupBuy } from '@/types';

const MOCK_BUYS: MaterialGroupBuy[] = [
    {
        id: 'gb1', organizerId: 'v1', materialCategory: 'Drywall', materialDescription: '1/2" Standard Drywall 4x8 sheets',
        retailPricePerUnit: 14.50, groupPricePerUnit: 10.50, minimumQuantity: 50, currentQuantity: 73,
        targetQuantity: 100, savingsPercent: 28, status: 'gathering', deadline: '2026-05-01T00:00:00Z',
        deliveryLocation: 'Portland, OR Depot', createdAt: '2026-04-10T00:00:00Z',
        participants: [
            { vendorId: 'v1', vendorName: 'BuildRight Construction', quantity: 30, totalPrice: 315, joinedAt: '2026-04-10T00:00:00Z', paid: true },
            { vendorId: 'v2', vendorName: 'Pacific Builders', quantity: 25, totalPrice: 262.50, joinedAt: '2026-04-12T00:00:00Z', paid: true },
            { vendorId: 'v3', vendorName: 'HomeReno Pro', quantity: 18, totalPrice: 189, joinedAt: '2026-04-14T00:00:00Z', paid: false },
        ],
    },
    {
        id: 'gb2', organizerId: 'v2', materialCategory: 'Lumber 2x4', materialDescription: 'Premium 2x4x8 Studs - Kiln Dried',
        retailPricePerUnit: 5.25, groupPricePerUnit: 3.90, minimumQuantity: 100, currentQuantity: 150,
        targetQuantity: 200, savingsPercent: 26, status: 'confirmed', deadline: '2026-04-25T00:00:00Z',
        deliveryLocation: 'Seattle Lumber Yard', createdAt: '2026-04-05T00:00:00Z',
        participants: [
            { vendorId: 'v4', vendorName: 'Northwest Framing', quantity: 80, totalPrice: 312, joinedAt: '2026-04-06T00:00:00Z', paid: true },
            { vendorId: 'v5', vendorName: 'Timber Works', quantity: 70, totalPrice: 273, joinedAt: '2026-04-08T00:00:00Z', paid: true },
        ],
    },
    {
        id: 'gb3', organizerId: 'v3', materialCategory: 'Roofing Shingles', materialDescription: 'GAF Timberline HD Architectural Shingles',
        retailPricePerUnit: 38.00, groupPricePerUnit: 28.50, minimumQuantity: 30, currentQuantity: 45,
        targetQuantity: 60, savingsPercent: 25, status: 'gathering', deadline: '2026-05-15T00:00:00Z',
        createdAt: '2026-04-15T00:00:00Z',
        participants: [
            { vendorId: 'v6', vendorName: 'Summit Roofing', quantity: 25, totalPrice: 712.50, joinedAt: '2026-04-16T00:00:00Z', paid: true },
            { vendorId: 'v7', vendorName: 'ProRoof LLC', quantity: 20, totalPrice: 570, joinedAt: '2026-04-17T00:00:00Z', paid: false },
        ],
    },
];

export default function GroupBuysPage() {
    const [buys, setBuys] = useState<MaterialGroupBuy[]>(MOCK_BUYS);
    const [filter, setFilter] = useState('all');

    const filtered = filter === 'all' ? buys : buys.filter(b => b.status === filter);

    return (
        <main style={{ minHeight: '100vh', background: '#0f0f1a' }}>
            <Navbar />
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                            🏗️ Material Group Buys
                        </h1>
                        <p style={{ color: '#888' }}>
                            Save 15-30% on materials by pooling orders with other contractors
                        </p>
                    </div>
                    <button style={{
                        background: '#22c55e', border: 'none', borderRadius: '8px',
                        padding: '10px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer',
                    }}>
                        + Start Group Buy
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {['all', 'gathering', 'confirmed', 'ordered'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            background: filter === f ? '#3b82f6' : '#1a1a2e',
                            border: `1px solid ${filter === f ? '#3b82f6' : '#333'}`,
                            borderRadius: '8px', padding: '6px 14px',
                            color: filter === f ? '#fff' : '#888', fontSize: '12px',
                            cursor: 'pointer', textTransform: 'capitalize',
                        }}>
                            {f === 'all' ? 'All Buys' : f}
                        </button>
                    ))}
                </div>

                {/* Group Buys Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                    {filtered.map(buy => (
                        <MaterialGroupBuyCard
                            key={buy.id}
                            groupBuy={buy}
                            onJoin={(qty) => alert(`Join with ${qty} units`)}
                            onLeave={() => alert('Leave group buy')}
                        />
                    ))}
                </div>
            </div>
        </main>
    );
}
