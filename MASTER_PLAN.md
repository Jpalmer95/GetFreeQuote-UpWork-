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
- [x] **JIT ITEM/TOOL SHARING (rent-or-sell) — BUILT 2026-08-12:** `item_listings` table applied to
      Supabase (`supabase_jit.sql`), `/api/jit/items` + `/api/jit/items/[id]` API, `/jit` marketplace
      page with list-an-item form, navbar link. Live.

### Phase 4 — BuildUp (community & donation-funded builds)
- [x] Community projects + transparent funding (`community_projects`, `donations`,
      `ledger_entries`, `process_donation`/`record_community_expense` RPCs).
- [x] Progress updates + image posts; cross-link jobs ↔ community projects.
- [x] Contractor selection from best quotes (phase-level quote selection exists).
- [ ] Escrow buildout — **EXCLUDED** per owner decision (2026-08-12); payments are
      buyer/seller handled off-platform for now.

### Phase 5 — Oracle Data Integration & Agent API
- [x] **ORACLE EVENT OUTBOX — BUILT 2026-08-12:** `oracle_events` table applied
      (`supabase_oracle.sql`), `emitOracleEvent` service (HMAC-signed), wired into JIT
      create/update/delete + review creation, and `/api/oracle/poll` relay endpoint
      (guarded by `ORACLE_POLL_SECRET`).
- [x] **AGENT API FEED — BUILT 2026-08-12:** `/api/oracle/feed` returns live open jobs,
      available JIT listings, active community projects, and emitted events to any
      agent with an API key (Bearer `bfk_...`, issued via `/api/api-keys`). Usage is
      counted (`request_count`/`last_used_at`) as the foundation for microtransaction
      billing.
- [x] **`api_keys` TABLE — APPLIED 2026-08-12:** the `/api/api-keys` and `/api/mcp`
      features referenced a table that did not exist in the DB; created it
      (`supabase_api_keys.sql`) with hashing + scopes + RLS.
- [ ] Webhooks + live L402 microtransaction billing — needs the separate paid oracle
      ingest service; usage counting is ready to bill against.

## Future Roadmap (post-launch — do not execute yet)

- **HERMES AGENT BID DESK (the "agentic middleman")** — owner describes a job once;
  their Hermes Agent posts it to all channels (GetFreeQuote native, email, SMS,
  Thumbtack via browser, community boards, cheap voice line), converses with every
  contractor, collects + ranks quotes, redistributes changes, and surfaces a ranked
  CSV/report for final hire. **See `docs/plans/2026-08-13-hermes-agent-bid-desk.md`**
  for the full phase-by-phase roadmap. This is the platform's highest-value native
  use case.
- Insurance/liability integration for gigs.
- Cross-industry verticals: construction, trades, creative, repairs, moving, tech.
- AI-estimated fair-price bands to guide both sides (extend `priceEstimation`).
- Marketplace analytics / demand heatmaps sold via the oracle.
- Mobile PWA or native apps.
- Reputation portability / verified work history.

## Metadata

- **Date:** 2026-08-12 (updated: reviews, JIT item-sharing, oracle outbox + agent API feed)
- **Owner:** Jonathan (Jpalmer95)
- **Status:** Active — reviews, JIT item/tool sharing, oracle event outbox, and oracle
  agent API feed all shipped + verified. Escrow excluded per owner; live L402 billing
  awaits the separate paid oracle service.
- **Note:** This document is authoritative for roadmap decisions.
