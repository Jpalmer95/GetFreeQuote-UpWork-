'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './SearchAutocomplete.module.css';

interface Suggestion {
    type: string;
    value: string;
}

interface SearchAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function SearchAutocomplete({ value, onChange, placeholder }: SearchAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (value.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(value)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data);
                    setShowDropdown(data.length > 0);
                    setActiveIndex(-1);
                }
            } catch {
                setSuggestions([]);
            }
        }, 250);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (suggestion: Suggestion) => {
        onChange(suggestion.value);
        setShowDropdown(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[activeIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const typeIcons: Record<string, string> = {
        category: '📂',
        location: '📍',
        tag: '🏷️',
    };

    return (
        <div className={styles.wrapper} ref={containerRef}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
                type="text"
                className={styles.input}
                placeholder={placeholder || 'Search projects by keyword...'}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
            />
            {showDropdown && (
                <div className={styles.dropdown}>
                    {suggestions.map((s, i) => (
                        <button
                            key={`${s.type}-${s.value}`}
                            className={`${styles.suggestion} ${i === activeIndex ? styles.active : ''}`}
                            onClick={() => handleSelect(s)}
                            onMouseEnter={() => setActiveIndex(i)}
                        >
                            <span className={styles.typeIcon}>{typeIcons[s.type] || '🔍'}</span>
                            <span className={styles.suggestionText}>{s.value}</span>
                            <span className={styles.typeLabel}>{s.type}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
