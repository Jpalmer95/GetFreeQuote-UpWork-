# AGENTS.md — GetFreeQuote

Human-facing marketplace (web + mobile) and the primary producer/consumer of the Data Agent
Oracle. Repo `~/dev/GetFreeQuote-UpWork-` → https://getfreequote.org.

Visiting agents: start at https://getfreequote.org/llms.txt and https://getfreequote.org/.well-known/mcp.json.
Public catalog (no auth): GET https://getfreequote.org/api/discover
MCP: POST https://getfreequote.org/api/mcp  (initialize / tools/list / discover_marketplace are public; writes need Bearer bfk_...)

## Authoritative docs
`MASTER_PLAN.md` — vision, sustainability/cost model, the recorded architecture decision, phases.

## Architecture boundary (recorded — do not relitigate)
The **Oracle** is a *shared data/agent layer*, **not** part of this app:

- **GetFreeQuote** = the human-facing marketplace (web + mobile).
- **Oracle** = the system of record: a signed, versioned, queryable event log plus a data market
  for autonomous agents (paid microtransactions).
- They are **separate codebases/services** tied by a **versioned data contract** — explicitly
  *not* one monolith. Merging them was considered and rejected, because it would duplicate
  job/need data and GetFreeQuote's own negotiation agents need the same real-time data.
- Escrow/funding is a separate engine module shared by both.

If a change would blur that boundary, stop and read `MASTER_PLAN.md` first.

## Third-party gotchas
- **Thumbtack is browser-only** — there is no API. Any integration must drive a browser.

## Stack
Next.js 16 + dedicated PostgreSQL 16 (`getfreequotes` / `gfquser` on droplet `167.99.125.127`,
bridged via `src/lib/pgSupabaseEngine.ts`). Agent endpoints:
`/api/agent-process`, `/api/agent-respond`, `/api/agent-instruct`, `/api/poll-jobs`,
`/api/mcp`, `/api/discover`, `/api/oracle/feed`.
Deployed via Traefik/Coolify on droplet `167.99.125.127`.

## Cross-cutting context
`~/dev/knowledge` → `wiki/index.md`. The boundary-by-contract pattern is recorded in
`wiki/decisions/recurring-architecture-principles.md`.
