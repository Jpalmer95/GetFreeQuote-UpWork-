'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import styles from './SavedSearches.module.css';

interface SavedSearch {
    id: string;
    name: string;
    filters: Record<string, string | boolean | undefined>;
    created_at: string;
}

interface SavedSearchesProps {
    currentFilters: Record<string, string | boolean | undefined>;
    onApply: (filters: Record<string, string | boolean | undefined>) => void;
}

export default function SavedSearches({ currentFilters, onApply }: SavedSearchesProps) {
    const { session } = useAuth();
    const [searches, setSearches] = useState<SavedSearch[]>([]);
    const [showSave, setShowSave] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchSearches = useCallback(async () => {
        if (!session?.access_token) return;
        try {
            const res = await fetch('/api/saved-searches', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                setSearches(await res.json());
            }
        } catch { /* silent */ }
    }, [session?.access_token]);

    useEffect(() => {
        fetchSearches();
    }, [fetchSearches]);

    const handleSave = async () => {
        if (!saveName.trim() || !session?.access_token) return;
        setSaving(true);
        try {
            await fetch('/api/saved-searches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ name: saveName.trim(), filters: currentFilters }),
            });
            setSaveName('');
            setShowSave(false);
            fetchSearches();
        } catch { /* silent */ } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!session?.access_token) return;
        try {
            await fetch(`/api/saved-searches?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            setSearches(prev => prev.filter(s => s.id !== id));
        } catch { /* silent */ }
    };

    if (!session) return null;

    const hasFilters = Object.values(currentFilters).some(v => v !== '' && v !== undefined);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.label}>Saved Searches</span>
                {hasFilters && (
                    <button
                        className={styles.saveBtn}
                        onClick={() => setShowSave(!showSave)}
                    >
                        {showSave ? 'Cancel' : '+ Save Current'}
                    </button>
                )}
            </div>

            {showSave && (
                <div className={styles.saveForm}>
                    <input
                        type="text"
                        placeholder="Search name..."
                        className={styles.saveInput}
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    />
                    <button
                        className={styles.confirmBtn}
                        onClick={handleSave}
                        disabled={saving || !saveName.trim()}
                    >
                        {saving ? '...' : 'Save'}
                    </button>
                </div>
            )}

            {searches.length > 0 && (
                <div className={styles.list}>
                    {searches.map(s => (
                        <div key={s.id} className={styles.item}>
                            <button
                                className={styles.applyBtn}
                                onClick={() => onApply(s.filters)}
                            >
                                {s.name}
                            </button>
                            <button
                                className={styles.deleteBtn}
                                onClick={() => handleDelete(s.id)}
                                title="Delete"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {searches.length === 0 && !showSave && (
                <p className={styles.empty}>No saved searches yet</p>
            )}
        </div>
    );
}
