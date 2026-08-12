# GetFreeQuote — MASTER PLAN & ROADMAP

> **How to use this document:** This is the authoritative, durable roadmap for GetFreeQuote.
> Execute **phase-by-phase, in order**. Mark a checkbox `[x]` **only after** that phase's
> Success Criteria objectively pass. Make atomic commits. Never commit secrets.
> When starting a new session or agent on this project, read this document first.

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
- **Trust tiers / BYOK** for heavy agent compute (see `open-source-ai-platform-
  sustainability` pattern): free tier + paid tiers.
- No free lunch: agent-negotiation LLM spend is real. Model it as a per-negotiation
  cost recovered through fees and/or oracle access.

## Current State

- **Stack:** Next.js 16 + Supabase (Postgres, realtime, storage). AI agents already
  present (`/api/agent-process`, `/api/agent-respond`, `/api/poll-jobs`).
- **Live:** https://getfreequote.org (migrated from `quotes.167.99.125.127.sslip.io`).
  Traefik/Coolify on droplet `167.99.125.127`.
- **Existing:** vendor verification requests, saved searches, email preferences,
  realtime + storage schemas, marketing assets.
- **Missing:** geo/JIT layer, escrow & funding, agentic negotiation engine, oracle
  data contract, structured scope parsing, milestone payments.

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
- **Counter-argument considered (keep them fully separate):** rejected — it would
  duplicate job/need data, and GetFreeQuote's own negotiation agents need the same
  real-time data the oracle would hold.

## Phased Execution

### Phase 0 — Hardening & Foundation
- [ ] UFW / cloud firewall; ensure no internal ports (redis, postgres) are publicly
      exposed. Verify with `telnet <ip> 6379` failing externally.
- [ ] Backups for Supabase + droplet.
- [ ] Add `scope_template` + AI **scope-parser** so "estimates on anything" is
      parsed into structured line items.
- **Success Criteria:** external port scans fail for internal services;
  `https://getfreequote.org` up with a valid cert; scope-parser turns a free-text
  sample request into structured JSON.

### Phase 1 — Core Marketplace & Trust
- [ ] Vendor verification v2 (license/insurance checks), reputation, reviews, ratings.
- [ ] Milestone-based payments skeleton.
- [ ] Agentic **notification/update layer**: consolidate status updates into one
      channel (email/sms) — "one update reaches many contractors" — cutting manual
      calls/texts/emails.
- **Success Criteria:** verified-vendor badge works end-to-end; a project emits a
  milestone update automatically; a vendor can onboard in < 5 minutes of effort.

### Phase 2 — Agentic Negotiation Engine
- [ ] Bid-intent parsing; automated quote comparison; **guarded counter-negotiation**
      with configurable thresholds (auto-accept under $X, human-approve above);
      full audit log; **human-in-the-loop pause points** at any step.
- **Success Criteria:** an agent completes a quote negotiation from an unstructured
  request → signed agreement, with a documented audit trail and an exercised
  human-approval point.

### Phase 3 — JIT Instant Market (services + item/tool sharing)
- [ ] Geo layer (geohash/proximity), real-time needs feed, availability, **rent-or-
      sell** tools/equipment/items, mobile-first + push notifications.
- **Success Criteria:** a JIT tool request from a jobsite reaches nearby availability
  and completes a rental/sale; real-time needs appear in the feed within seconds.

### Phase 4 — BuildUp (community & donation-funded builds)
- [ ] Funding tiers/pool, donor verification, contractor selection from best quotes,
      **smart-contract escrow** (stablecoin USDC preferred + optional fiat bridge
      for donors) with milestones and 2-of-3 multisig, dispute/arbitration workflow.
- **Success Criteria:** a funded project collects donations into escrow, selects a
  contractor by best quote, releases funds per milestone, and an end-user can donate
  without holding crypto (fiat bridge works).

### Phase 5 — Oracle Data Integration & Agent API
- [ ] Emit **signed structured events** to the oracle for every project/gig/JIT/
      negotiation; agent API + webhooks; microtransaction billing (L402-style);
      third-party agents can poll real-time needs.
- **Success Criteria:** an external agent pays a microtransaction and polls live JIT
  needs; the oracle is the single source of truth (the marketplace reads/writes
  through it).

## Future Roadmap (post-launch — do not execute yet)

- Insurance/liability integration for gigs.
- Cross-industry verticals: construction, trades, creative, repairs, moving, tech.
- AI-estimated fair-price bands to guide both sides.
- Marketplace analytics / demand heatmaps sold via the oracle.
- Mobile PWA or native apps.
- Reputation portability / verified work history.

## Metadata

- **Date:** 2026-08-12
- **Owner:** Jonathan (Jpalmer95)
- **Status:** Active — Phase 0 planned
- **Note:** This document is authoritative for roadmap decisions.
