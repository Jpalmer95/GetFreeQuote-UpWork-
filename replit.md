# QuoteBot

A Next.js application for AI-powered home services quote management using Supabase for authentication and data storage.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database/Auth**: Supabase (`@supabase/supabase-js`)
- **Styling**: CSS Modules + global utility classes in `globals.css`
- **Font**: Outfit (Google Fonts, weights 300–900)
- **Package Manager**: npm

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    globals.css            # Design system: CSS tokens, utilities, animations
    layout.tsx             # Root layout (font, AuthProvider)
    page.tsx               # Landing page (aurora hero, feature cards)
    page.module.css
    login/                 # Login / Sign Up page
    dashboard/             # Homeowner job dashboard
    marketplace/           # Public job marketplace
    post-job/              # Post a new job form
    vendor/                # Vendor portal
  components/
    Navbar.tsx             # Sticky glass navbar with active route indicator
    Navbar.module.css
  context/
    AuthContext.tsx        # Supabase auth state provider
  lib/
    supabase.ts            # Supabase client
  services/                # Data access layer (jobService, aiAgent, db)
  types/
    index.ts               # TypeScript types (Job, Quote, Message, etc.)
public/                    # Static assets
supabase_schema.sql        # Database schema reference
```

## Design System

All global CSS custom properties live in `src/app/globals.css`:

- **Colors**: `--primary` (blue), `--secondary` (purple), `--accent` (green), `--accent-amber` (amber), `--accent-red`
- **Surfaces**: `--surface-50` through `--surface-400` (alpha-based glassmorphism layers)
- **Borders**: `--border-subtle`, `--border-mid`, `--border-highlight`
- **Radii**: `--radius-xs` through `--radius-full`
- **Easing**: `--ease-out-expo`, `--ease-spring`
- **Utility classes**: `.glass-panel`, `.gradient-text`, `.btn-primary`, `.btn-secondary`, `.field-input`, `.field-select`, `.field-textarea`, `.badge` (+ variants), `.loading-screen`

## Environment Variables (Secrets)

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key

## Running the App

```bash
npm run dev    # Development server on port 5000 (Replit)
npm run build  # Production build
npm run start  # Production server on port 5000 (Replit)
```

## Replit Configuration

- Workflow: `Start application` runs `npm run dev`
- `next.config.ts` sets `allowedDevOrigins` to `REPLIT_DEV_DOMAIN`
- Port 5000 is required for Replit's webview preview
