# Hermes Agent Bid Desk — "The Agentic Middleman" (GetFreeQuote.org)

> **How to use this document:** This is the authoritative, durable roadmap for the
> Hermes-Agent-native bid-desk capability on GetFreeQuote. Execute **phase-by-phase,
> in order**. Mark a checkbox `[x]` **only after** that phase's Success Criteria
> objectively pass. Make atomic commits. Never commit secrets.
> When starting a new session or agent on this project, read this document first.
> The user interacts with the system almost entirely through **their Hermes Agent**,
> not through dozens of phone/email/text threads.

---

## 1. Vision (one paragraph)

GetFreeQuote's most valuable native use case is the **agentic middleman**: a single
owner describes a job **once** (scope, trades, timeline, budget, photos/plans) to
their Hermes Agent, and the agent does all the chasing. Hermes posts the job to
every worthwhile channel (GetFreeQuote's own marketplace, email to a vetted local
list, SMS, Thumbtack via browser automation, community boards, a cheap voice line),
then **converses with every contractor on the owner's behalf** — answering questions
from the one canonical Job Brief, collecting quotes into a structured inbox, ranking
them, redistributing any scope/detail changes to all prior quote-givers automatically,
scheduling site visits, and surfacing a final ranked report + CSV. The owner only
steps in to approve a selection and hire. It levels the field for small contractors
who can't afford marketing, and removes the phone/email/text babysitting that kills
self-GC projects.

## 2. Sustainability / Cost Model (who pays when this scales?)

This is the wall most of these ideas hit, so it's addressed up front.

- **LLM negotiation spend is real.** Every contractor conversation is tokens. Budget:
  per-project negotiation cost is modeled as a per-conversation cost recovered from a
  small success/escrow fee on awarded jobs (mirror GetFreeQuote's marketplace fee).
- **BYOK for heavy agent compute:** owner brings their own Hermes Agent key / model
  for the negotiation brain (matches the existing agent-oracle + api-keys model); the
  free human tier uses a shared quota with soft caps.
- **Channels:**
  - Email (Resend) — low, per-send.
  - SMS (Twilio) — ~$0.0079/msg + inbound number (~$1/mo). Small.
  - Voice — this is the expensive one; see Phase 5 for cheap/free options. Prefer
    **transcription-only + "call me back" voicemail drop** over live voice for most
    cases to keep cost ~zero.
  - Thumbtack — no API cost (browser automation), but consumes agent time.
- **CSV/report delivery** — free (generated locally, pushed to repo or emailed).
- **Oracle microtransactions (existing)** — third-party agents pay to poll demand;
  this subsidizes the free human-facing tier.

**Rule:** every phase that adds a paid external dependency (Twilio SMS, voice, a
hosted STT/TTS) must state the per-use cost and cap before it ships.

## 3. Current State (verified from repo, 2026-08-13)

The platform already has most of the plumbing the bid desk needs. It is **not** a
greenfield build:

- **Stack:** Next.js 16 + Supabase (Postgres, realtime, storage). Deployed via
  Traefik/Coolify on droplet `167.99.125.127`, live at getfreequote.org.
- **Already built (verified in repo):**
  - `jobs` (with budget, urgency, timeline_start/end, square_footage, materials,
    attachments), `quotes` (amount, estimated_days, details, status), `messages`
    (**sender_type includes `customer_agent` / `vendor_agent` / `system`** — the
    exact hook Hermes needs to converse natively).
  - `agent_configs` (auto-respond, auto-quote, budgets, escalation_triggers,
    auto_approve_below, service_area), `agent_actions` audit log, `notifications`
    (email/SMS/push via `notificationDispatcher`, `emailService`, `smsService`).
  - `structuredQuote.ts` — line-item builder + `compareQuotes()` side-by-side
    comparison (price/quality foundation for ranking).
  - Oracle event outbox (`emitOracleEvent`, HMAC-signed) + `/api/oracle/feed` agent
    API feed + `/api/mcp` + `/api/api-keys` (Bearer `bfk_...`) + usage counting.
  - `vendor_profiles` (license/insurance), `vendor_reviews` (avg_rating/total_reviews),
    `projects` + `project_phases` (milestones), community funding + ledger, JIT
    item/tool sharing, GPS local discovery.
- **Known constraint:** hosted Supabase has **no CLI/DB credentials for agents**, so
  NEW tables require a SQL migration applied via Supabase Dashboard (see GAP below).
- **KNOWN OUTAGE (2026-08-13):** droplet `167.99.125.127` web layer is DOWN — all
  public ports refused, SSH hangs at banner exchange. Nothing here can be deployed or
  verified live until the host is restored. Repo work is unaffected.

## 4. Architecture Decision (Recorded)

**Decision: The Hermes Agent instance is the orchestrator; GetFreeQuote is the
system-of-record + human UI; a new `bid_desk` schema stores the channel/thread
mapping. Thumbtack is a best-effort browser-automation adapter, NOT a primary
channel.**

- **Canonical Job Brief** (single source of truth): one structured record holding
  scope, trades, timeline, budget bands, photos/plans, must-haves. Hermes answers
  every contractor question from this; any update to it is pushed to ALL channels +
  prior quote-givers (the "redistribute once, reach many" feature).
- **Channel adapters** map an external thread (email thread, SMS conversation,
  Thumbtack pro chat, phone call) → one `bid_thread` row → one `job`. Inbound
  messages normalize into `bid_messages`; Hermes reads/writes via existing agent
  endpoints (`/api/agent-instruct`, `/api/agent-respond`, `/api/mcp`).
- **Owned channels first (rock solid):** GetFreeQuote native inbox, email (Resend +
  shared IMAP inbox), SMS (Twilio inbound webhook). These are fully scriptable.
- **Thumbtack (best-effort, human-gated):** no public homeowner job API exists
  (pro/partner API only, legacy deprecated). Converse via browser automation
  (computer-use/browser-use) driving the pro-chat UI. Login + CAPTCHA require the
  owner; scraping is ToS-risky — keep it out of the critical path.
- **Escrow excluded** (recorded owner decision 2026-08-12): payments are handled
  off-platform between buyer/seller.
- **Counter-argument (build a full two-sided marketplace):** rejected — marketplace
  liquidity is a company, not a feature. The bid desk + local list + agent middleman
  is the useful, shippable product. (Reaffirms Kynda owner-GC analysis.)

## 5. Phased Execution

### Phase 0 — Job Brief + Data Model (foundation, no new deps)

**Objective:** one canonical record per job + a schema that maps any external channel
thread to a job, so Hermes can always answer from a single source of truth.

- [x] Create SQL migration `supabase_bid_desk.sql` (ready to paste in Supabase
      Dashboard → SQL Editor):
  - `job_briefs` (job_id FK, scope_structured jsonb, trades text[], budget_min/max,
    timeline_start/end, must_haves jsonb, plans_attachments text[], updated_at).
  - `bid_threads` (id, job_id FK, channel enum `native|email|sms|thumbtack|voice`,
    external_thread_key text UNIQUE per channel, contractor_contact jsonb, status).
  - `bid_messages` (thread_id FK, direction enum `in|out`, sender/recipient, body
    text, raw jsonb, extracted_quote jsonb nullable, created_at).
  - `ranked_quotes` (thread_id FK, quote_amount, estimated_days, exclusions,
    license/coi_verified, availability, rank, notes) + RLS mirroring existing patterns.
- [x] Add `BidDeskService` (`src/services/bidDesk.ts`) with types for JobBrief,
  BidThread, BidMessage, RankedQuote.
- [x] `/api/bid-desk/brief` GET/PUT, `/api/bid-desk/threads` GET/POST,
      `/api/bid-desk/messages` GET/POST, `/api/bid-desk/redistribute` POST
      (auth: job owner session OR Hermes agent `bfk_` API key via `bidDeskAuth`;
      writes via service-role, owner reads via RLS).
- **Success Criteria:** migration applies cleanly in Supabase Dashboard; a Hermes agent
  can create a job brief + a native bid thread and write/read a bid message via the API.

### Phase 1 — Native GetFreeQuote Channel End-to-End (mostly existing)

**Objective:** prove the loop on the platform's own inbox before touching external
channels — Hermes converses with a (simulated or real) vendor agent on the same job.

- [ ] Wire `agent-instruct` / `agent-respond` to `bid_threads` so an agent message
      lands in `bid_messages` for the owner's job.
- [ ] Hermes-side tool (`bid_desk_inbox`) that lists threads needing response for a
      job and posts a reply, pulling context from the Job Brief.
- [ ] Quote extraction: when a contractor's message contains a number/amount +
      availability, Hermes writes an `extracted_quote` + `ranked_quotes` row.
- **Success Criteria:** a test vendor agent and the owner's Hermes agent hold a full
  back-and-forth on one job; a quote is extracted and lands in the ranked table.

### Phase 2 — Email + SMS Adapters (owned channels, cheap)

**Objective:** Hermes converses over email (Resend + shared IMAP inbox) and SMS
(Twilio inbound webhook), auto-opening a `bid_thread` per new contact.

- [x] **Channel adapter layer (`src/services/channelAdapters.ts`)** — `ChannelAdapter`
      interface + `channelRegistry` for native/email/sms/thumbtack/voice. The whole
      system talks to the registry, never a specific provider, so swapping email/SMS/
      voice vendors is a single-file change (the longevity requirement).
- [x] Email adapter (Resend outbound; inbound via IMAP poller → `ingestInbound()`).
- [x] SMS adapter (Twilio outbound; inbound webhook → `ingestInbound()`).
- [x] `redistributeToOpenThreads` now actually dispatches via the channel adapters.
- [ ] IMAP poller cron (inbound email → thread) — needs a real `bids@` mailbox + creds.
- [ ] Twilio SMS inbound webhook route — needs a real Twilio number.
- **Success Criteria:** send a test email and a test SMS from a personal number;
  each opens a thread, Hermes replies, and the reply arrives back to the tester.
  Per-message cost is logged.

### Phase 3 — Redistribution ("update once, reach many")

**Objective:** any Job Brief change (new detail, photo, date move, budget change) is
propagated to every open thread + every prior quote-giver in one Hermes action.

- [x] `BidDeskService.redistribute` → for each open thread, compose a channel-appropriate
      message and send via that channel's adapter; record each send in `bid_messages`
      + `agent_actions` audit log. Live route `POST /api/bid-desk/redistribute`.
- [x] Owner command in Hermes: "update the job brief / add a photo / move the date"
      → Hermes updates `job_briefs` + triggers redistribution.
- **Success Criteria:** 3 threads on different channels all receive the same new
  detail after one owner instruction; audit log shows each send with status.

### Phase 4 — Ranking + CSV/Report

**Objective:** turn the quote inbox into an apples-to-apples comparison the owner can
act on.

- [x] `src/services/quoteRanker.ts` — weighted multi-quote ranker (price, days,
      exclusions penalty, license/COI, rating, distance) with injectable weights.
      Pure logic, unit-tested (8 passing with Vitest).
- [x] `GET /api/bid-desk/report?jobId=&format=json|csv|summary` — ranked list, CSV
      download, or top-3 summary for the owner's Hermes agent.
- [x] Vitest test runner wired (`npm test`), test files excluded from Next tsc build.
- **Success Criteria:** 4+ quotes across ≥2 channels produce a ranked list and a CSV
  with all columns populated; top-3 summary is delivered to the owner.

### Phase 5 — Voice Agent (cheap/free) + Call Summaries

**Objective:** handle, transcribe, and summarize phone calls — and converse when
worth it — without racking up live-voice costs.

- [ ] **Tier 1 (free, do first):** Twilio number that answers → plays a short
      "you're being recorded, speak your quote/details after the beep" prompt →
      voicemail-drop → Whisper (local) transcribes → Hermes parses it into a
      `bid_messages` entry + optional `extracted_quote`. Cost ≈ 0 (no live agent).
- [ ] **Tier 2 (optional, ultra-cheap live voice):** Twilio Media Streams (WebSocket)
      + local/free STT (Whisper via faster-whisper) + free TTS (piper) + cheap LLM
      (owner BYOK). Gate behind a flag; cap call length; always record + transcribe.
- [ ] Call summaries: every inbound/outbound call → `bid_thread` → transcription →
      Hermes summary → owner notification (email/Telegram) with "needs clarification"
      flag.
- **Success Criteria:** an inbound call produces a voicemail transcription in
  `bid_messages`, a summary is delivered to the owner, and any quote amount in the
  message is extracted. Per-call cost recorded and under budget.

### Phase 6 — Scheduling + Final Selection/Hire

**Objective:** from ranked report to scheduled hire.

- [ ] Availability capture: each thread's `ranked_quotes.availability` parsed to
      concrete start windows; Hermes proposes site-visit slots to top candidates.
- [ ] Owner approves a selection → Hermes generates a one-page short work order
      (scope from Job Brief + price + dates + sequence liability + pay-after-completion,
      reusing the Kynda owner-GC contract language) → sends to chosen contractor via
      their channel.
- [ ] Post-award: mark thread/job status; push confirmation to all rejected bidders
      (courtesy close-out) so they stop messaging.
- **Success Criteria:** owner picks a winner from the report; a work-order is
  delivered to that contractor; all other threads are closed with a courtesy notice.

## 6. Future Roadmap (post-launch — do not execute yet)

- Live paid-voice (fully conversational phone agent) when a cheap tier is proven.
- Multi-owner mode: any owner's Hermes can post to GetFreeQuote via the oracle +
  api-keys (the "global agent-native marketplace" vision).
- Community/JIT projects fed through the same bid-desk flow.
- A2A / MCP server so other agents (not just this Hermes) can run bid desks.
- Insurance/COI document upload + automated verification on `vendor_profiles`.

## 7. Metadata

- **Date:** 2026-08-13
- **Owner:** Jonathan (Jpalmer95)
- **Status:** Planning — Phase 0 (Job Brief + data model) is the active build target.
- **Blockers:** (1) droplet web layer is DOWN (all public ports refused, SSH hangs) —
  deployment/testing blocked until host restored; (2) Thumbtack has no public
  homeowner API — browser-automation adapter only, human-gated, non-critical path.
- **Note:** This document is authoritative for the Hermes-Agent-native bid-desk roadmap.
