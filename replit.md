# BidFlow

An AI-agent-native marketplace for estimates and bids across any industry — home services, commercial construction, gig work, events, trade labor, professional services, technology, and more. AI agents handle quote negotiation; humans only intervene when approval is needed. Built with Next.js and Supabase.

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
    dashboard/             # Project dashboard (timeline, quotes, agent log tabs)
    marketplace/           # Public project marketplace (industry/subcategory/tag filters)
    post-job/              # Post a new project form (dynamic fields per industry)
    projects/              # Multi-phase project management
      new/                 # Step-by-step project creation wizard (details → phases → review)
      [id]/                # Project detail with Gantt timeline, phase management, budget tracking
    vendor/                # Vendor portal (opportunities feed, pending reviews)
      profile/             # Vendor profile editor (company info, certs, insurance, portfolio)
        [id]/              # Public-facing vendor profile view with reviews
      estimating/          # Estimating template management (hourly, per-unit, flat, tiered, formula)
      team/                # Team member management (admin, estimator, field_worker roles)
    agent-settings/        # AI Agent configuration page
    api/
      agent-process/       # Server-side AI agent orchestration (POST) — vendor matching with location, capacity, specialty, budget scoring
      agent-respond/       # Multi-turn conversation handler (POST) — scope updates, escalation, vendor notifications
      quote-action/        # Server-side quote accept/reject (POST)
  components/
    Navbar.tsx             # Sticky glass navbar with notification bell + AI Agent link
    Navbar.module.css
    NotificationPanel.tsx  # Notification dropdown with priority indicators
    NotificationPanel.module.css
  context/
    AuthContext.tsx        # Supabase auth state provider
  lib/
    supabase.ts            # Supabase client (browser/client-side)
    supabaseAdmin.ts       # Supabase admin client (server-side, service role)
  services/
    jobService.ts          # Business logic layer
    aiAgent.ts             # AI agent UI helpers (status labels, scoring display)
    serverMappers.ts       # Shared typed row interfaces + mapper functions for server-side routes
    db.ts                  # Database access layer (Supabase queries, mappers)
  types/
    index.ts               # TypeScript types, agent configs, notifications
public/                    # Static assets
supabase_schema.sql        # Database schema reference
```

## Data Model

The platform uses an industry-agnostic data model with AI agent infrastructure:

- **Industry Verticals**: Home Services, Commercial Construction, Gig Work, Events & Entertainment, Trade Labor, Day Labor, Professional Services, Technology, Other (+ custom)
- **Subcategories**: Each vertical has its own set (e.g., Home Services → Plumbing, Electrical, HVAC, etc.) + custom support
- **Jobs**: `industryVertical`, `subcategory`, `urgency`, `squareFootage`, `materials`, `attachments`, `timelineStart`, `timelineEnd`, tags
- **Quotes**: vendor bids with amount, estimated days, details, accept/reject workflow
- **Messages**: conversation thread per job with `senderType` (user/vendor/customer_agent/vendor_agent/system)
- **Agent Configs**: per-user AI agent settings (role, auto-respond, auto-quote, budget thresholds, industries, specialties, service area, max active jobs/capacity, escalation triggers, communication style)
- **Vendor Profiles**: company info, certifications, insurance, service areas, portfolio, team size, avg rating, verified status
- **Estimating Templates**: per-vendor service catalogs with line items supporting hourly, per-unit, flat fee, tiered, and formula pricing models
- **Team Members**: multi-user company accounts with admin, estimator, field_worker roles
- **Projects**: multi-phase project coordination with title, description, location, industry, budget, date range, status (PLANNING/ACTIVE/ON_HOLD/COMPLETED/CANCELLED)
- **Project Phases**: individual trades/sub-jobs with sort order, dependencies, dates, estimated/actual costs, status (NOT_STARTED/WAITING_QUOTES/QUOTED/IN_PROGRESS/COMPLETED/BLOCKED), accepted quote reference
- **Vendor Reviews**: rating/comment structure (data model only, collection flow deferred)
- **Agent Actions**: audit log of all AI agent operations (scope_analysis, job_broadcast, vendor_match, auto_quote, clarification, escalation, etc.)
- **Notifications**: prioritized alerts (low/medium/high/urgent) with action_required flag, types: quote_ready, approval_needed, scope_change, agent_summary, job_match, negotiation_update

## AI Agent System

The agent system operates at two levels:

1. **Customer Agents**: When a job is posted, the customer's AI agent analyzes scope, broadcasts to matching vendor agents, handles clarification dialogs, compares quotes, and escalates to the human for approvals.
2. **Vendor Agents**: Match incoming opportunities against vendor's configured criteria (industry, specialties, budget range, distance), auto-generate preliminary quotes, and send introductions.

Architecture:
- **Server-side orchestration**: Agent processing (vendor matching, auto-quoting, multi-turn conversation, cross-user notifications) runs in Next.js API routes (`/api/agent-process`, `/api/agent-respond`, `/api/quote-action`) using `supabaseAdmin` (service role key) to bypass RLS for cross-user operations.
- **Client-side helpers**: `aiAgent.ts` exports only `isAgentSender()` and `getAgentLabel()` for UI rendering.
- **RLS policies** are ownership-based: users can only read/write their own data. All cross-user operations go through server-side API routes.

Vendor Matching Criteria (scored ranking):
- **Industry match** (+30 pts, disqualify on mismatch)
- **Specialty match** (+25 pts)
- **Location/service area** (+20 pts, disqualify if vendor has service area and job location not in it)
- **Budget fit** (+15 pts, disqualify if job budget outside vendor min/max range)
- **Capacity** (+5-10 pts based on remaining capacity, disqualify if at max active jobs)
- **Working hours** (±5 pts)
- **Auto-quote/auto-respond** bonuses (+10/+5 pts)

Key features:
- Agent-to-agent communication with typed `senderType` on messages
- Auto-quoting based on vendor base rate, urgency multiplier, and estimated hours
- Budget threshold checking (auto-reject quotes above/below configured limits)
- Auto-approve quotes below configured threshold
- Multi-turn conversation via `/api/agent-respond` (scope updates, escalation, vendor notifications)
- Escalation triggers for human review (configurable per user)
- Full audit trail via `agent_actions` table
- Notification system with priority levels and action-required flags
- Accept/reject quote actions with server-side status updates and notifications

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
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only, for agent orchestration)

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
