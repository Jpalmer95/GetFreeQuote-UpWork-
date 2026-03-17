# BidFlow

An AI-native marketplace for estimates and bids across any industry — home services, commercial construction, gig work, events, trade labor, professional services, technology, and more. Built with Next.js and Supabase.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database/Auth**: Supabase (`@supabase/supabase-js`)
- **Styling**: CSS Modules + global utility classes in `globals.css`
- **Font**: Outfit (Google Fonts, weights 300-900)
- **Package Manager**: npm

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    globals.css            # Design system: CSS tokens, utilities, animations
    layout.tsx             # Root layout (font, AuthProvider)
    page.tsx               # Landing page (aurora hero, industry verticals, CTA)
    page.module.css
    login/                 # Login / Sign Up page
    dashboard/             # Project dashboard (shows industry, subcategory, urgency badges)
    marketplace/           # Public project marketplace (filters by industry vertical + subcategory)
    post-job/              # Post a new project form (dynamic fields per industry)
    vendor/                # Vendor portal (industry filter, auto-quote agent)
  components/
    Navbar.tsx             # Sticky glass navbar with active route indicator
    Navbar.module.css
  context/
    AuthContext.tsx        # Supabase auth state provider
  lib/
    supabase.ts            # Supabase client
  services/
    jobService.ts          # Business logic layer
    aiAgent.ts             # AI agent service (processes new jobs)
    db.ts                  # Database access layer (Supabase queries, mappers)
  types/
    index.ts               # TypeScript types, industry verticals, subcategories
public/                    # Static assets
supabase_schema.sql        # Database schema reference
```

## Data Model

The platform uses an industry-agnostic data model:

- **Industry Verticals**: Home Services, Commercial Construction, Gig Work, Events & Entertainment, Trade Labor, Day Labor, Professional Services, Technology, Other
- **Subcategories**: Each vertical has its own set of subcategories (e.g., Home Services → Plumbing, Electrical, HVAC, etc.)
- **Jobs** include: `industryVertical`, `subcategory`, `urgency` (flexible/within_month/within_week/urgent), `squareFootage`, `materials`, `attachments`, `timelineStart`, `timelineEnd` in addition to base fields
- **Quotes**: vendor bids with amount, estimated days, details
- **Messages**: conversation thread per job with AI agent action support

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
