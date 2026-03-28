'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ConfirmAuth() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) {
            router.replace('/login?error=' + encodeURIComponent('Missing authentication code'));
            return;
        }

        supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
            if (exchangeError) {
                router.replace('/login?error=' + encodeURIComponent(exchangeError.message));
            } else {
                router.replace('/dashboard');
            }
        }).catch(() => {
            setError('Something went wrong. Please try again.');
        });
    }, [searchParams, router]);

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#f87171' }}>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: 32, height: 32, margin: '0 auto 1rem',
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite'
                }} />
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Signing you in...</p>
            </div>
        </div>
    );
}

export default function ConfirmPage() {
    return (
        <Suspense>
            <ConfirmAuth />
        </Suspense>
    );
}
