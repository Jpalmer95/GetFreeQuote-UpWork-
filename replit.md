# BidFlow

An AI-agent-native marketplace for estimates and bids across any industry — home services, commercial construction, gig work, events, trade labor, professional services, technology, and more. AI agents handle quote negotiation; humans only intervene when approval is needed. Built with Next.js and Supabase.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database/Auth**: Supabase (`@supabase/supabase-js`) — email/password + Google OAuth
- **Styling**: CSS Modules + global utility classes in `globals.css`
- **Font**: Outfit (Google Fonts, weights 300-900)
- **Storage**: Supabase Storage (3 buckets: job-attachments, vendor-assets, community-images)
- **Email**: Resend (`resend` package) — requires `RESEND_API_KEY` secret; gracefully skips if not set
- **Package Manager**: npm

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    globals.css            # Design system: CSS tokens, utilities, animations
    layout.tsx             # Root layout (font, suppressHydrationWarning on html/body)
    providers.tsx          # Client-only providers wrapper (AuthProvider)
    page.tsx               # Landing page (aurora hero, industry verticals, CTA)
    page.module.css
    login/                 # Login / Sign Up page (email/password + Google OAuth)
    auth/
      callback/            # Server route: receives Supabase auth redirects, forwards code to confirm page
      confirm/             # Client page: exchanges auth code for session (email confirm + OAuth)
    dashboard/             # Project dashboard (timeline, quotes, agent log tabs)
    marketplace/           # Public project marketplace (industry/subcategory/tag filters)
    post-job/              # Post a new project form (dynamic fields per industry)
    projects/              # Multi-phase project management
      new/                 # Step-by-step project creation wizard (details → phases → review)
      [id]/                # Project detail with Gantt timeline, phase management, budget tracking
    community/             # Community project funding with smart contract escrow
      new/                 # Create new community project form
      [id]/                # Community project detail (donate, updates, ledger, smart contract info)
    vendor/                # Vendor portal (opportunities feed, pending reviews)
      profile/             # Vendor profile editor (company info, certs, insurance, portfolio)
        [id]/              # Public-facing vendor profile view with reviews
      estimating/          # Estimating template management (hourly, per-unit, flat, tiered, formula)
      team/                # Team member management (admin, estimator, field_worker roles)
    agent-settings/        # AI Agent configuration page
    agent-hub/             # Agent Hub — live activity feed, owner instruction input, push notification setup
    admin/
      verifications/       # Admin-only verification request review panel (approve/reject with notes)
      polling/             # Admin-only poll engine dashboard (run history, stats, manual trigger)
    api/
      agent-process/       # Server-side AI agent orchestration (POST) — vendor matching with location, capacity, specialty, budget scoring
      agent-respond/       # Multi-turn conversation handler (POST) — scope updates, escalation, vendor notifications
      quote-action/        # Server-side quote accept/reject (POST)
      verification/        # Verification API (submit request, admin list, admin approve/reject)
      community/           # Community project API (donate, create-project, post-update, record-expense, post-to-marketplace) with atomic RPCs for donations & expenses
      agent-instruct/      # POST/GET owner instructions for agent (writes to agent_instructions table)
      push-subscribe/      # POST save push subscription / DELETE remove subscription (VAPID/Web Push)
      sms-preferences/     # GET/PUT user phone_number and sms_enabled fields on profiles
      api-keys/            # GET/POST/DELETE/PATCH — API key management (hashed with SHA-256, prefix shown only)
      mcp/                 # MCP server (JSON-RPC 2.0 over HTTP) — GET returns capabilities, POST handles tool calls
      poll-jobs/           # POST run poll cycle (stale job expiry + reminders + vendor rematch) | GET recent runs — auth: SUPABASE_SERVICE_ROLE_KEY as Bearer token
    settings/
      api-keys/            # API Keys management UI (create, disable, revoke, scopes, expiry)
      notifications/       # Email + SMS + Push notification preference settings
    docs/
      mcp/                 # MCP Integration Guide (Quick Start, tool reference, Claude Desktop config)
  components/
    Navbar.tsx             # Sticky glass navbar with notification bell + AI Agent link + Admin link for ADMIN role
    Navbar.module.css
    NotificationPanel.tsx  # Notification dropdown with real-time updates (Supabase subscriptions, fallback polling)
    NotificationPanel.module.css
    QuoteComparison.tsx    # Side-by-side quote comparison modal with sort and best-value scoring
    QuoteComparison.module.css
    VendorAnalytics.tsx      # Vendor performance analytics (win rate, revenue, 30-day chart)
    VendorAnalytics.module.css
    ClientAnalytics.tsx      # Client project insights (spending, savings, completion rate)
    ClientAnalytics.module.css
    PlatformStats.tsx        # Landing page aggregate platform statistics
    PlatformStats.module.css
    SearchAutocomplete.tsx   # Search input with autocomplete dropdown (categories, locations, tags)
    SearchAutocomplete.module.css
    SavedSearches.tsx        # Save/load/delete marketplace filter configurations
    SavedSearches.module.css
    RecommendedVendors.tsx   # Vendor recommendations for open jobs (scored by industry, specialty, location)
    RecommendedVendors.module.css
    VerificationSection.tsx  # Vendor verification request form and status display
    VerificationSection.module.css
  context/
    AuthContext.tsx        # Supabase auth state provider
  lib/
    supabase.ts            # Supabase client (browser/client-side)
    auth-helpers.ts        # Auth URL helpers (getBaseUrl, getAuthCallbackUrl)
    supabaseAdmin.ts       # Supabase admin client (server-side, service role)
  services/
    jobService.ts              # Business logic layer
    aiAgent.ts                 # AI agent UI helpers (status labels, scoring display)
    serverMappers.ts           # Shared typed row interfaces + mapper functions for server-side routes
    db.ts                      # Database access layer (Supabase queries, mappers)
    realtimeService.ts         # Centralized Supabase real-time subscription manager with reconnect and fallback
    notificationDispatcher.ts  # Unified outbound notification router (in-app + email + SMS + push)
    smsService.ts              # Twilio SMS service (gracefully degrades without credentials)
    pushService.ts             # Web Push / VAPID notification service
  types/
    index.ts               # TypeScript types, agent configs, notifications
public/                    # Static assets
supabase_schema.sql                  # Database schema reference
supabase_verification_requests.sql   # Migration: verification_requests table + notification type update
supabase_realtime_setup.sql          # Migration: enable real-time for notifications, quotes, messages tables
supabase_saved_searches.sql          # Migration: saved_searches table for vendor filter persistence
supabase_migrations/001_agent_hub.sql # Migration: agent_instructions table + phone_number/sms_enabled/push columns on profiles
supabase_migrations/002_mcp_api_keys.sql # Migration: api_keys table (SHA-256 hashed) for MCP authentication
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
- **Community Projects**: public funding initiatives with smart contract-backed escrow, categories (Parks & Recreation, Infrastructure, Education, Arts & Culture, Environment, Public Safety, Community Spaces, Open Source), goal/funding tracking, contract address
- **Donations**: contributions to community projects with anonymous option, transaction hash, optional message
- **Community Project Updates**: progress reports from project creators
- **Ledger Entries**: transparent transaction log (DONATION/EXPENSE) with tx hashes for full financial transparency
- **Vendor Reviews**: rating/comment structure (data model only, collection flow deferred)
- **Agent Actions**: audit log of all AI agent operations (scope_analysis, job_broadcast, vendor_match, auto_quote, clarification, escalation, etc.)
- **Notifications**: prioritized alerts (low/medium/high/urgent) with action_required flag, types: quote_ready, approval_needed, scope_change, agent_summary, job_match, negotiation_update, new_message, verification_update
- **API Keys**: SHA-256 hashed keys with `bfk_` prefix, scopes (read/write), optional expiry, last_used_at tracking. Raw key shown once at creation only.
- **Quote Comparison**: side-by-side comparison modal for 2+ quotes with sorting (price/timeline/best value), best-value scoring (price 45%, timeline 30%, rating 20%, verified 5%), accept/reject actions

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
- `SUPABASE_SERVICE_ROLE_KEY` is reused for poll-jobs auth — cron jobs should pass it as `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

## Running the App

```bash
npm run dev    # Development server on port 5000 (Replit)
npm run build  # Production build
npm run start  # Production server on port 5000 (Replit)
```

## Replit Configuration

- Workflow: `Start application` runs `npm run dev`
- `next.config.ts` sets `allowedDevOrigins` to `REPLIT_DEV_DOMAIN`
- Hydration: `suppressHydrationWarning` on `<html>` and `<body>` in layout.tsx; inline script in `<head>` intercepts `reportError`/`console.error`/window error events to filter Replit-proxy-caused hydration mismatch errors (proxy injects DOM nodes into body before React hydrates)
- Port 5000 is required for Replit's webview preview
