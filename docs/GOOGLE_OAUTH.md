# Google OAuth for GetFreeQuote (operator steps)

The app is wired. Google Cloud must issue a client ID/secret — I cannot create those
without your Google account. Email+password signup already works without this.

## 1. Google Cloud Console

1. Open https://console.cloud.google.com/apis/credentials
2. Create or pick a project (e.g. `getfreequote`).
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `GetFreeQuote`
   - User support email: yours
   - Developer contact: yours
   - Application home page: `https://getfreequote.org`
   - **Privacy policy:** `https://getfreequote.org/privacy`
   - **Terms of service:** `https://getfreequote.org/terms`
   - Scopes: `openid`, `email`, `profile` (the defaults)
   - Test users: add yourself while the app is in Testing
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `getfreequote.org`
   - Authorized JavaScript origins:
     - `https://getfreequote.org`
   - Authorized redirect URIs:
     - `https://getfreequote.org/api/auth/google/callback`
5. Copy the **Client ID** and **Client secret**.

## 2. Put them on the droplet (only GetFreeQuote env files)

SSH as root and append to **both** `/var/www/getfreequotes/.env.local` and
`/var/www/getfreequotes/.env.production`:

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://getfreequote.org/api/auth/google/callback
```

Then:

```
docker restart getfreequotes
curl -s https://getfreequote.org/api/auth/google/status
# {"configured":true}
```

Do **not** put these in Kynda Coffee env files.

## 3. Verify

1. https://getfreequote.org/login → **Continue with Google**
2. After Google consent you land on `/dashboard` with a session.
3. `/api/auth/google/status` returns `{"configured":true}`

Until those two env vars exist, the Google button still works as a click — it
redirects to `/login?error=Google login is not configured yet…` and email/password
continues to work.
