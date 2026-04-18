'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import NeighborhoodPoolCard from '@/components/NeighborhoodPoolCard';
import { NeighborhoodPool } from '@/types';

const MOCK_POOLS: NeighborhoodPool[] = [
    {
        id: 'pool1', title: 'Oak Street Fence Replacement', description: '8 neighbors need new privacy fences. Cedar 6ft, ~150 linear ft each. Group pricing saves everyone!',
        workType: 'Fence Installation', location: 'Oak Street, Portland OR', locationLat: 45.5152, locationLng: -122.6784,
        radiusMiles: 2, organizerId: 'u1', minParticipants: 5, maxParticipants: 12,
        currentParticipants: [
            { userId: 'u1', userName: 'Sarah M.', address: '123 Oak St', addressLat: 45.515, addressLng: -122.678, agreedAmount: 2850, paid: true, joinedAt: '2026-04-10T00:00:00Z' },
            { userId: 'u2', userName: 'Tom K.', address: '127 Oak St', addressLat: 45.5152, addressLng: -122.679, agreedAmount: 2850, paid: true, joinedAt: '2026-04-11T00:00:00Z' },
            { userId: 'u3', userName: 'Maria L.', address: '131 Oak St', addressLat: 45.5154, addressLng: -122.6795, agreedAmount: 2850, paid: false, joinedAt: '2026-04-13T00:00:00Z' },
            { userId: 'u4', userName: 'James R.', address: '135 Oak St', addressLat: 45.5156, addressLng: -122.680, agreedAmount: 2850, paid: true, joinedAt: '2026-04-14T00:00:00Z' },
            { userId: 'u5', userName: 'Chen W.', address: '139 Oak St', addressLat: 45.5158, addressLng: -122.6805, agreedAmount: 2850, paid: false, joinedAt: '2026-04-16T00:00:00Z' },
        ],
        estimatedIndividualCost: 3500, estimatedPoolCost: 2850, savingsPercent: 19,
        status: 'gathering', deadline: '2026-05-20T00:00:00Z', createdAt: '2026-04-10T00:00:00Z',
    },
    {
        id: 'pool2', title: 'Riverside Solar Panel Install', description: 'Neighborhood solar initiative. Tesla Powerwall + 20 panel systems. Federal tax credit + group discount = huge savings!',
        workType: 'Solar Installation', location: 'Riverside Drive, Austin TX', locationLat: 30.2672, locationLng: -97.7431,
        radiusMiles: 3, organizerId: 'u6', minParticipants: 6, maxParticipants: 15,
        currentParticipants: [
            { userId: 'u6', userName: 'David H.', address: '501 Riverside', addressLat: 30.267, addressLng: -97.743, agreedAmount: 16500, paid: true, joinedAt: '2026-04-05T00:00:00Z' },
            { userId: 'u7', userName: 'Lisa P.', address: '505 Riverside', addressLat: 30.2675, addressLng: -97.7435, agreedAmount: 16500, paid: true, joinedAt: '2026-04-06T00:00:00Z' },
            { userId: 'u8', userName: 'Mike S.', address: '509 Riverside', addressLat: 30.268, addressLng: -97.744, agreedAmount: 16500, paid: true, joinedAt: '2026-04-08T00:00:00Z' },
            { userId: 'u9', userName: 'Amy T.', address: '513 Riverside', addressLat: 30.2685, addressLng: -97.7445, agreedAmount: 16500, paid: false, joinedAt: '2026-04-10T00:00:00Z' },
            { userId: 'u10', userName: 'Robert J.', address: '517 Riverside', addressLat: 30.269, addressLng: -97.745, agreedAmount: 16500, paid: true, joinedAt: '2026-04-12T00:00:00Z' },
            { userId: 'u11', userName: 'Karen W.', address: '521 Riverside', addressLat: 30.2695, addressLng: -97.7455, agreedAmount: 16500, paid: false, joinedAt: '2026-04-15T00:00:00Z' },
        ],
        estimatedIndividualCost: 22000, estimatedPoolCost: 16500, savingsPercent: 25,
        status: 'funded', deadline: '2026-06-01T00:00:00Z', createdAt: '2026-04-05T00:00:00Z',
    },
];

export default function PoolsPage() {
    const [pools, setPools] = useState<NeighborhoodPool[]>(MOCK_POOLS);
    const [filter, setFilter] = useState('all');

    const filtered = filter === 'all' ? pools : pools.filter(p => p.status === filter);

    return (
        <main style={{ minHeight: '100vh', background: '#0f0f1a' }}>
            <Navbar />
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                            🏘️ Neighborhood Pools
                        </h1>
                        <p style={{ color: '#888' }}>
                            Pool with neighbors for bulk contractor pricing. Everyone saves!
                        </p>
                    </div>
                    <button style={{
                        background: '#22c55e', border: 'none', borderRadius: '8px',
                        padding: '10px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer',
                    }}>
                        + Start Pool
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {['all', 'gathering', 'funded', 'in_progress'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            background: filter === f ? '#3b82f6' : '#1a1a2e',
                            border: `1px solid ${filter === f ? '#3b82f6' : '#333'}`,
                            borderRadius: '8px', padding: '6px 14px',
                            color: filter === f ? '#fff' : '#888', fontSize: '12px',
                            cursor: 'pointer',
                        }}>
                            {f === 'all' ? 'All Pools' : f.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Pools Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '16px' }}>
                    {filtered.map(pool => (
                        <NeighborhoodPoolCard
                            key={pool.id}
                            pool={pool}
                            onJoin={() => alert('Join pool')}
                            onLeave={() => alert('Leave pool')}
                        />
                    ))}
                </div>
            </div>
        </main>
    );
}
