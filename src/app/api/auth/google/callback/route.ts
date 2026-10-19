import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getPgPool, signJwt } from '@/lib/pgSupabaseEngine';
import { googleOAuthConfigured, googleRedirectUri, verifyOAuthState } from '@/lib/oauthState';

export const dynamic = 'force-dynamic';

interface GoogleTokenResponse {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
}

interface GoogleUserInfo {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
}

function fail(origin: string, message: string) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request: NextRequest) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    if (!googleOAuthConfigured()) {
        return fail(origin, 'Google login is not configured.');
    }

    const sp = request.nextUrl.searchParams;
    const err = sp.get('error');
    if (err) return fail(origin, sp.get('error_description') || err);

    const code = sp.get('code');
    const state = sp.get('state');
    if (!code || !state) return fail(origin, 'Missing Google authorization code.');

    const parsed = verifyOAuthState(state);
    if (!parsed) return fail(origin, 'Google login expired. Please try again.');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: googleRedirectUri(),
            grant_type: 'authorization_code',
        }),
    });
    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token) {
        return fail(origin, tokenJson.error_description || tokenJson.error || 'Google token exchange failed.');
    }

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const info = (await userRes.json()) as GoogleUserInfo;
    if (!userRes.ok || !info.email) {
        return fail(origin, 'Google did not return a verified email.');
    }
    if (info.email_verified === false || info.email_verified === 'false') {
        return fail(origin, 'Google email is not verified.');
    }

    const email = info.email.trim().toLowerCase();
    const fullName = (info.name || email.split('@')[0]).slice(0, 120);
    const picture = info.picture || null;
    const googleSub = info.sub || null;

    const pool = getPgPool();
    const existing = await pool.query(
        `SELECT * FROM auth.users WHERE lower(email) = $1 LIMIT 1`,
        [email]
    );

    let userRow: Record<string, unknown>;
    if (existing.rows.length > 0) {
        userRow = existing.rows[0];
        const meta = {
            ...((userRow.raw_user_meta_data as Record<string, unknown>) || {}),
            full_name: fullName,
            avatar_url: picture,
            provider: 'google',
            google_sub: googleSub,
        };
        const upd = await pool.query(
            `UPDATE auth.users
             SET raw_user_meta_data = $2::jsonb, email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [userRow.id, JSON.stringify(meta)]
        );
        userRow = upd.rows[0];
        await pool.query(
            `UPDATE public.profiles SET full_name = COALESCE(NULLIF($2, ''), full_name), avatar_url = COALESCE($3, avatar_url) WHERE id = $1`,
            [userRow.id, fullName, picture]
        );
    } else {
        const randomPw = randomBytes(32).toString('hex');
        const meta = { full_name: fullName, role: 'USER', provider: 'google', google_sub: googleSub, avatar_url: picture };
        const ins = await pool.query(
            `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
             VALUES ($1, crypt($2, gen_salt('bf')), $3::jsonb, now())
             RETURNING *`,
            [email, randomPw, JSON.stringify(meta)]
        );
        userRow = ins.rows[0];
        if (picture) {
            await pool.query(`UPDATE public.profiles SET avatar_url = $2 WHERE id = $1`, [userRow.id, picture]);
        }
    }

    const accessToken = signJwt({
        sub: String(userRow.id),
        email,
        role: String(((userRow.raw_user_meta_data as Record<string, unknown>) || {}).role || 'USER'),
        user_metadata: (userRow.raw_user_meta_data as Record<string, unknown>) || {},
    });

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="background:#0b1220;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<p>Signing you in…</p>
<script>
(function () {
  var token = ${JSON.stringify(accessToken)};
  var redirect = ${JSON.stringify(parsed.redirect || '/dashboard')};
  try {
    var session = {
      access_token: token,
      refresh_token: token,
      token_type: 'bearer',
      expires_in: 604800,
      expires_at: Math.floor(Date.now() / 1000) + 604800,
      user: {
        id: ${JSON.stringify(String(userRow.id))},
        email: ${JSON.stringify(email)},
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: ${JSON.stringify((userRow.raw_user_meta_data as Record<string, unknown>) || {})},
        app_metadata: { provider: 'google', providers: ['google'] }
      }
    };
    localStorage.setItem('sb-gfq-auth-token', JSON.stringify(session));
  } catch (e) {}
  window.location.replace(redirect);
})();
</script>
</body></html>`;

    const res = new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    res.cookies.set('sb-access-token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return res;
}
