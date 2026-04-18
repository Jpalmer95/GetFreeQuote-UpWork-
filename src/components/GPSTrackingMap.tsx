'use client';
import { useState, useEffect } from 'react';
import { GPSTrackingSession } from '@/types';
import { calculateETA, formatETA, calculateRouteDistance } from '@/services/gpsTracking';

interface GPSTrackingMapProps {
    session: GPSTrackingSession;
    destLat: number;
    destLng: number;
    onArrived?: () => void;
}

export default function GPSTrackingMap({ session, destLat, destLng, onArrived }: GPSTrackingMapProps) {
    const [eta, setEta] = useState<{ milesAway: number; minutesETA: number } | null>(null);

    useEffect(() => {
        if (session.currentLat && session.currentLng) {
            const result = calculateETA(session.currentLat, session.currentLng, destLat, destLng);
            setEta({ milesAway: result.milesAway, minutesETA: result.minutesETA });

            if (result.milesAway < 0.05) {
                onArrived?.();
            }
        }

        const interval = setInterval(() => {
            if (session.currentLat && session.currentLng) {
                const result = calculateETA(session.currentLat, session.currentLng, destLat, destLng);
                setEta({ milesAway: result.milesAway, minutesETA: result.minutesETA });
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [session.currentLat, session.currentLng, destLat, destLng]);

    const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
        en_route: { icon: '🚗', color: '#3b82f6', label: 'En Route' },
        arrived: { icon: '📍', color: '#22c55e', label: 'Arrived' },
        working: { icon: '🔧', color: '#f59e0b', label: 'Working' },
        completed: { icon: '✅', color: '#22c55e', label: 'Completed' },
        cancelled: { icon: '❌', color: '#ef4444', label: 'Cancelled' },
    };
    const sc = statusConfig[session.status] ?? statusConfig.en_route;
    const routeDistance = calculateRouteDistance(session.routeHistory);

    return (
        <div style={{
            background: '#1a1a2e', borderRadius: '16px', overflow: 'hidden',
            border: '1px solid #333',
        }}>
            {/* Map Placeholder (in production, use Mapbox/Google Maps) */}
            <div style={{
                height: '250px', background: 'linear-gradient(135deg, #1a2332 0%, #0f1724 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                {/* Simulated map view */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `radial-gradient(circle at 30% 70%, #3b82f611 0%, transparent 50%),
                                      radial-gradient(circle at 70% 30%, #22c55e11 0%, transparent 50%)`,
                }} />

                {/* Contractor dot */}
                {session.currentLat && session.currentLng && (
                    <div style={{
                        position: 'absolute',
                        left: `${30 + (session.routeHistory.length % 5) * 10}%`,
                        top: `${60 - (session.routeHistory.length % 4) * 8}%`,
                        transition: 'all 2s ease',
                    }}>
                        <div style={{
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: sc.color, boxShadow: `0 0 20px ${sc.color}88`,
                            animation: 'pulse 2s infinite',
                        }} />
                        <div style={{
                            position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)',
                            background: '#1a1a2e', borderRadius: '6px', padding: '2px 8px',
                            fontSize: '10px', color: '#fff', whiteSpace: 'nowrap',
                        }}>
                            {sc.icon} Contractor
                        </div>
                    </div>
                )}

                {/* Destination pin */}
                <div style={{
                    position: 'absolute', right: '25%', top: '35%',
                }}>
                    <div style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: '#ef4444', border: '2px solid #fff',
                    }} />
                    <div style={{
                        position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)',
                        background: '#1a1a2e', borderRadius: '6px', padding: '2px 8px',
                        fontSize: '10px', color: '#fff', whiteSpace: 'nowrap',
                    }}>
                        📍 You
                    </div>
                </div>

                {/* Route line (simulated) */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <path
                        d="M 35% 65% Q 50% 40% 75% 35%"
                        fill="none"
                        stroke="#3b82f644"
                        strokeWidth="3"
                        strokeDasharray="8,4"
                    />
                </svg>

                {/* ETA Overlay */}
                {eta && session.status === 'en_route' && (
                    <div style={{
                        position: 'absolute', bottom: '16px', left: '16px',
                        background: '#1a1a2eee', borderRadius: '12px', padding: '12px 16px',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>
                            {formatETA(eta.minutesETA)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            {eta.milesAway} miles away
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{sc.icon}</span>
                        <div>
                            <div style={{ color: sc.color, fontWeight: 600, fontSize: '14px' }}>
                                {sc.label}
                            </div>
                            <div style={{ color: '#888', fontSize: '11px' }}>
                                Started {new Date(session.startedAt).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {session.status === 'en_route' && eta && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                                ETA {new Date(Date.now() + eta.minutesETA * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Route Stats */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                    marginTop: '12px',
                }}>
                    <StatCard label="Route" value={`${routeDistance} mi`} />
                    <StatCard label="Updates" value={String(session.routeHistory.length)} />
                    <StatCard label="Photos" value={String(session.completionPhotos.length)} />
                </div>

                {/* Share Link */}
                <div style={{
                    marginTop: '12px', padding: '8px 12px', background: '#ffffff06',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>🔗 Share live tracking</span>
                    <button style={{
                        background: '#3b82f622', border: '1px solid #3b82f644',
                        borderRadius: '6px', padding: '4px 10px', color: '#60a5fa',
                        fontSize: '11px', cursor: 'pointer',
                    }}>
                        Copy Link
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            background: '#ffffff06', borderRadius: '8px', padding: '8px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{value}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>{label}</div>
        </div>
    );
}
