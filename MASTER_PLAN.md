# GetFreeQuote — MASTER PLAN & ROADMAP

> **How to use this document:** This is the authoritative, durable roadmap for GetFreeQuote.
> Execute **phase-by-phase, in order**. Mark a checkbox `[x]` **only after** that phase's
> Success Criteria objectively pass. Make atomic commits. Never commit secrets.
> When starting a new session or agent on this project, read this document first.
>
> **IMPORTANT (2026-08-12):** A full code audit showed the platform **already implements most
> of the original roadmap** (agent negotiation configs, agent audit log, verification,
> estimating templates, multi-phase projects, community funding + ledger, GPS local job
> discovery). The checkboxes below reflect the **verified current state**. Only the sections
> marked **GAP** are genuinely missing and are the active build targets.

## Vision

GetFreeQuote grows from a quote/bid marketplace into a broad, **agent-driven work &
resources exchange**: anyone can get an estimate on anything, post a gig or a
just-in-time (JIT) need, fund a community build, and have AI agents handle quoting,
negotiation, tracking, and status updates — with a human able to step in at any
point, but **automation on by default**. It levels the field so small contractors
and businesses that do great work but can't afford marketing or endless
phone/text/email chasing can win work, and end users get fast, fair, transparent
service. The same real-time needs/opportunities data feeds a **paid agent-oracle**,
so any agent can discover and act on demand cheaply — a single source of truth for
the whole ecosystem.

## Sustainability / Cost Model

Who pays when this scales? (Must be explicit.)

- **Marketplace fees:** a small, transparent escrow/transaction fee on funded
  projects and gigs.
- **BuildUp:** platform fee on funded builds + optional community pool.
- **Agent-oracle / data feed:** third-party agents pay **microtransactions**
  (L402-style or crypto) to poll real-time needs, quotes, and price signals. This
  monetizes the AI infrastructure and subsidizes the free human-facing tier.
- **Trust tiers / BYOK** for heavy agent compute: free tier + paid tiers.
- No free lunch: agent-negotiation LLM spend is real. Model it as a per-negotiation
  cost recovered through fees and/or oracle access.

## Current State (verified 2026-08-12)

- **Stack:** Next.js 16 + Supabase (Postgres, realtime, storage). AI agents present
  (`/api/agent-process`, `/api/agent-respond`, `/api/agent-instruct`, `/api/poll-jobs`).
- **Live:** https://getfreequote.org. Traefik/Coolify on droplet `167.99.125.127`.
- **Already built (verified):** jobs/quotes/messages; `agent_configs` (budgets,
  escalation triggers, auto-approve thresholds, service area); `agent_actions` audit
  log; notifications; vendor verification + `vendor_profiles` (license/insurance,
  certifications); `estimating_templates` (line items + markup); `projects` +
  `project_phases` (milestones); community funding (`community_projects`, `donations`,
  `ledger_entries` + `process_donation`/`record_community_expense` RPCs); GPS local job
  discovery (`/local`); scope parsing; price estimation; push/SMS/email services.
- **Known constraint:** hosted Supabase has **no CLI / DB credentials available to agents**,
  so creating NEW tables requires a SQL migration applied via Supabase Dashboard.
  See the GAP sections for ready-to-apply SQL.

## Architecture Decision (Recorded)

**Decision: Integrate the Data Agent Oracle as a shared data/agent layer — NOT a
separate marketplace.**

- **GetFreeQuote** = the human-facing marketplace (web + mobile) and the primary
  producer/consumer of the oracle.
- **Oracle** = the system-of-record: a signed, versioned, queryable event log plus a
  data market for autonomous agents (paid microtransactions).
- **Benefit:** one source of truth for jobs/gigs/JIT needs/price signals; no
  duplicate "postings database"; third-party agents build on the same demand data
  GetFreeQuote uses. Escrow/funding is a separate engine module shared by both.
- **Boundary:** keep the oracle and marketplace as **separate codebases/services**
  (loose coupling, independent scaling) tied together by a **versioned data
  contract**, not as one monolith.
- **Counter-argument considered (keep fully separate):** rejected — it would
  duplicate job/need data, and GetFreeQuote's own negotiation agents need the same
  real-time data the oracle would hold.

## Phased Execution

### Phase 0 — Hardening & Foundation
- [x] Firewall/port hardening baseline; Traefik routes only public web ports.
- [x] AI **scope-parser** (`/api/scope` + `ScopeBreakdownDisplay`) — "estimates on
      anything" parsed into structured line items.
- [x] Price estimation + confidence (`/api/estimate` + `PriceEstimationWidget`).
- [ ] Periodic automated backups of Supabase + droplet (manual policy to be codified).

### Phase 1 — Core Marketplace & Trust
- [x] Vendor verification (requests + admin review + verified badge).
- [x] Agentic notification layer (email/SMS/push + notification panel) — one update
      reaches many contractors.
- [x] Milestone / multi-phase project tracking (`projects`, `project_phases`).
- [x] **GAP — REVIEWS FLOW (BUILT 2026-08-12):** `vendor_reviews` was schema-only.
      Added `/api/reviews` (GET list + POST submit), `VendorReviewForm` wired into the
      public vendor profile, and atomic aggregate update of `avg_rating`/`total_reviews`
      via `submit_vendor_review` RPC (`supabase_reviews.sql`).
- [ ] Reputation weighting / recency decay (future).

### Phase 2 — Agentic Negotiation Engine
- [x] `agent_configs` negotiation settings (auto-respond, auto-quote, budgets,
      escalation triggers, auto-approve threshold, service area).
- [x] `agent_actions` audit log + `agent-process`/`agent-respond` engine.
- [x] Human-in-the-loop: `escalation_triggers` + `approval_needed` notifications.
- [ ] Hardening: configurable auto-approve-by-amount enforcement + full audit drill.

### Phase 3 — JIT Instant Market (services + item/tool sharing)
- [x] GPS local **service** discovery (`/local` + `GPSTrackingMap`, geohash radius).
- [x] JIT service requests via the `jobs` table (`is_local_request`, lat/lng, radius).
- [ ] **GAP — JIT ITEM/TOOL SHARING (rent-or-sell):** no data model exists. BLOCKED on
      a new `item_listings` table (migration ready in `supabase_jit.sql`). Apply the
      SQL in Supabase Dashboard to enable the listing/rent/sell surface.

### Phase 4 — BuildUp (community & donation-funded builds)
- [x] Community projects + transparent funding (`community_projects`, `donations`,
      `ledger_entries`, `process_donation`/`record_community_expense` RPCs).
- [x] Progress updates + image posts; cross-link jobs ↔ community projects.
- [x] Contractor selection from best quotes (phase-level quote selection exists).
- [ ] Escrow buildout — **EXCLUDED** per owner decision (2026-08-12); payments are
      buyer/seller handled off-platform for now.

### Phase 5 — Oracle Data Integration & Agent API
- [ ] **GAP — ORACLE EVENT EMITTER + AGENT API:** nothing exists. BLOCKED on a signed
      event/outbox store (migration ready in `supabase_oracle.sql`). Design: emit
      signed structured events for every job/gig/JIT/negotiation; expose an agent API
      + webhooks; microtransaction billing (L402-style). Apply SQL to enable.

## Future Roadmap (post-launch — do not execute yet)

- Insurance/liability integration for gigs.
- Cross-industry verticals: construction, trades, creative, repairs, moving, tech.
- AI-estimated fair-price bands to guide both sides (extend `priceEstimation`).
- Marketplace analytics / demand heatmaps sold via the oracle.
- Mobile PWA or native apps.
- Reputation portability / verified work history.

## Metadata

- **Date:** 2026-08-12 (updated to reflect verified current state)
- **Owner:** Jonathan (Jpalmer95)
- **Status:** Active — reviews flow shipped; JIT item-sharing + oracle blocked on
  Supabase SQL migration (SQL ready, apply via Dashboard).
- **Note:** This document is authoritative for roadmap decisions.
