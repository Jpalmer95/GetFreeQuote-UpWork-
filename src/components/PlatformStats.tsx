'use client';
import { useState, useEffect } from 'react';
import styles from './PlatformStats.module.css';

interface Stats {
    totalJobs: number;
    totalVendors: number;
    totalQuotes: number;
}

export default function PlatformStats() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/analytics?action=platform-stats');
                if (res.ok) {
                    setStats(await res.json());
                }
            } catch {
                /* ignore */
            }
        };
        load();
    }, []);

    if (!stats) return null;

    const items = [
        { value: stats.totalJobs, label: 'Projects Posted' },
        { value: stats.totalVendors, label: 'Active Vendors' },
        { value: stats.totalQuotes, label: 'Quotes Generated' },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {items.map((item) => (
                    <div key={item.label} className={styles.stat}>
                        <span className={styles.value}>
                            {item.value.toLocaleString()}
                        </span>
                        <span className={styles.label}>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
