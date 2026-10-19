import { describe, it, expect } from 'vitest';
import { signOAuthState, verifyOAuthState, newOAuthState } from './oauthState';

describe('oauthState', () => {
    it('round-trips a signed state', () => {
        const state = newOAuthState('/jobs/abc');
        const parsed = verifyOAuthState(state);
        expect(parsed).toBeTruthy();
        expect(parsed?.redirect).toBe('/jobs/abc');
        expect(parsed?.nonce).toHaveLength(32);
    });

    it('rejects tampered signatures', () => {
        const state = newOAuthState('/dashboard');
        expect(verifyOAuthState(state + 'x')).toBeNull();
        expect(verifyOAuthState('not-a-state')).toBeNull();
    });

    it('rejects expired state', () => {
        const expired = signOAuthState({ nonce: 'aa', redirect: '/dashboard', exp: 1 });
        expect(verifyOAuthState(expired)).toBeNull();
    });

    it('clamps open-redirect payloads on verify', () => {
        const evil = signOAuthState({
            nonce: 'bb',
            redirect: 'https://evil.example',
            exp: Math.floor(Date.now() / 1000) + 60,
        });
        const parsed = verifyOAuthState(evil);
        expect(parsed?.redirect).toBe('/dashboard');
    });
});
