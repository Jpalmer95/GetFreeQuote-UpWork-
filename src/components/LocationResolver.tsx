'use client';
import { useState, useCallback } from 'react';
import styles from './LocationResolver.module.css';

export interface ResolvedLocation {
    lat: number;
    lng: number;
    label: string;
}

interface LocationResolverProps {
    value?: ResolvedLocation | null;
    onChange: (loc: ResolvedLocation | null) => void;
    compact?: boolean;
}

type Mode = 'browser' | 'zip' | 'city';

async function geocodeQuery(q: string): Promise<ResolvedLocation | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            label: data[0].display_name?.split(',').slice(0, 3).join(', ') || q,
        };
    } catch {
        return null;
    }
}

async function cityAutocomplete(q: string): Promise<Array<{ label: string; lat: number; lng: number }>> {
    if (q.length < 2) return [];
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}&featuretype=city`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data || []).map((d: { display_name: string; lat: string; lon: string }) => ({
            label: d.display_name?.split(',').slice(0, 3).join(', ') || d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
        }));
    } catch {
        return [];
    }
}

export default function LocationResolver({ value, onChange, compact = false }: LocationResolverProps) {
    const [mode, setMode] = useState<Mode>('browser');
    const [geoState, setGeoState] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');
    const [zipInput, setZipInput] = useState('');
    const [zipState, setZipState] = useState<'idle' | 'loading' | 'error'>('idle');
    const [cityInput, setCityInput] = useState('');
    const [citySuggestions, setCitySuggestions] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
    const [cityLoading, setCityLoading] = useState(false);

    const useBrowserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setGeoState('error');
            return;
        }
        setGeoState('loading');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                try {
                    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
                    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
                    const data = await res.json();
                    const city = data?.address?.city || data?.address?.town || data?.address?.village || 'Your Location';
                    const state = data?.address?.state || '';
                    const label = state ? `${city}, ${state}` : city;
                    onChange({ lat, lng, label });
                    setGeoState('idle');
                } catch {
                    onChange({ lat, lng, label: 'Your Location' });
                    setGeoState('idle');
                }
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) setGeoState('denied');
                else setGeoState('error');
            },
            { timeout: 10000 }
        );
    }, [onChange]);

    const lookupZip = useCallback(async () => {
        const zip = zipInput.trim();
        if (!zip) return;
        setZipState('loading');
        const result = await geocodeQuery(zip + ' USA');
        if (result) {
            result.label = zip;
            onChange(result);
            setZipState('idle');
        } else {
            setZipState('error');
        }
    }, [zipInput, onChange]);

    const handleCityInput = useCallback(async (q: string) => {
        setCityInput(q);
        if (q.length < 2) { setCitySuggestions([]); return; }
        setCityLoading(true);
        const results = await cityAutocomplete(q);
        setCitySuggestions(results);
        setCityLoading(false);
    }, []);

    const selectCity = useCallback((item: { label: string; lat: number; lng: number }) => {
        onChange({ lat: item.lat, lng: item.lng, label: item.label });
        setCityInput(item.label);
        setCitySuggestions([]);
    }, [onChange]);

    const clear = useCallback(() => {
        onChange(null);
        setGeoState('idle');
        setZipInput('');
        setZipState('idle');
        setCityInput('');
        setCitySuggestions([]);
    }, [onChange]);

    return (
        <div className={`${styles.resolver} ${compact ? styles.compact : ''}`}>
            {value ? (
                <div className={styles.resolved}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{value.label}</span>
                    <button onClick={clear} className={styles.clearBtn} aria-label="Clear location">×</button>
                </div>
            ) : (
                <>
                    <div className={styles.tabs}>
                        {(['browser', 'zip', 'city'] as Mode[]).map(m => (
                            <button
                                key={m}
                                type="button"
                                className={`${styles.tab} ${mode === m ? styles.tabActive : ''}`}
                                onClick={() => setMode(m)}
                            >
                                {m === 'browser' ? 'Use My Location' : m === 'zip' ? 'Zip Code' : 'City / Town'}
                            </button>
                        ))}
                    </div>

                    {mode === 'browser' && (
                        <div className={styles.pane}>
                            {geoState === 'denied' && (
                                <p className={styles.hint}>Location access was denied. Use Zip Code or City / Town instead.</p>
                            )}
                            {geoState === 'error' && (
                                <p className={styles.hint}>Could not get your location. Try Zip Code or City / Town.</p>
                            )}
                            <button
                                type="button"
                                className={styles.geoBtn}
                                onClick={useBrowserLocation}
                                disabled={geoState === 'loading'}
                            >
                                {geoState === 'loading' ? (
                                    <><span className={styles.spinner} /> Detecting location...</>
                                ) : (
                                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Detect My Location</>
                                )}
                            </button>
                        </div>
                    )}

                    {mode === 'zip' && (
                        <div className={styles.pane}>
                            <div className={styles.inputRow}>
                                <input
                                    type="text"
                                    className="field-input"
                                    placeholder="e.g. 90210"
                                    value={zipInput}
                                    onChange={e => setZipInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupZip())}
                                    maxLength={10}
                                />
                                <button type="button" className={styles.lookupBtn} onClick={lookupZip} disabled={zipState === 'loading'}>
                                    {zipState === 'loading' ? <span className={styles.spinner} /> : 'Look Up'}
                                </button>
                            </div>
                            {zipState === 'error' && <p className={styles.hint}>Zip code not found. Try a different code.</p>}
                        </div>
                    )}

                    {mode === 'city' && (
                        <div className={styles.pane}>
                            <div className={styles.autocompleteWrap}>
                                <input
                                    type="text"
                                    className="field-input"
                                    placeholder="e.g. Austin, TX"
                                    value={cityInput}
                                    onChange={e => handleCityInput(e.target.value)}
                                />
                                {cityLoading && <span className={styles.inlineSpinner}><span className={styles.spinner} /></span>}
                                {citySuggestions.length > 0 && (
                                    <ul className={styles.suggestions}>
                                        {citySuggestions.map((s, i) => (
                                            <li key={i}>
                                                <button type="button" onClick={() => selectCity(s)}>{s.label}</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
