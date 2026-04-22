# GetFreeQuote (BidFlow)

An industry-agnostic marketplace platform connecting clients who need work done with vendors who provide quotes and services. Built as a modern fullstack web application with Next.js 16, Supabase, and real-time features.

## Overview

GetFreeQuote empowers clients to post projects, receive competitive bids from verified vendors, and manage the entire job lifecycle from quote to completion. Vendors get a professional dashboard with estimating tools, analytics, and a public profile to showcase their work.

## Key Features

### Client Experience
- **Project Posting** — Create detailed job listings with scope breakdowns, budgets, timelines, and location
- **AI Quote Builder** — Structured quote system with phase-level pricing and Gantt timeline visualization
- **Quote Comparison** — Side-by-side vendor quotes with verification badges, trust scores, and sorting
- **Saved Searches** — Save and manage preferred search filters for quick discovery
- **Real-Time Notifications** — Browser push, email, and SMS alerts for quotes, messages, and status updates
- **File Uploads** — Attach photos and documents to projects and quotes

### Vendor Experience
- **Professional Profiles** — Public vendor pages with portfolio, certifications, reviews, and analytics
- **Estimating Tools** — Built-in cost estimation widget and structured quote builder
- **Vendor Analytics** — Track profile views, quote acceptance rates, lead quality, and revenue
- **Verification System** — Tiered verification (email, phone, ID, business license, insurance)
- **Trust Score** — Reputation engine based on completion rate, reviews, response time, and verification level

### Community & Collaboration
- **Community Projects** — Public project templates and neighborhood group buys for shared services
- **Material Group Buys** — Bulk purchasing coordination for community members
- **Neighborhood Pools** — Local service aggregators for recurring work in the same area
- **Apprentice Matching** — Connect apprentices with experienced vendors for on-the-job training
- **Community Credits** — Reward system for engagement, referrals, and platform contributions

### Advanced Systems
- **AI Agent Hub** — Configurable AI agents that can autonomously match vendors, draft quotes, and respond to inquiries
- **MCP Server** — Model Context Protocol integration for external AI agent access to platform data
- **Job Polling Engine** — Automated stale listing detection, reposting, and job lifecycle management
- **Go Local** — Hyperlocal gig work module with GPS tracking and neighborhood discovery
- **Escrow Dashboard** — Milestone-based payment tracking and contract management
- **Surge Pricing** — Dynamic pricing indicators based on demand, seasonality, and vendor availability

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | CSS Modules + Global CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email, Magic Link, OAuth ready) |
| Realtime | Supabase Realtime (WebSockets) |
| Storage | Supabase Storage |
| Email | Resend |
| SMS | Twilio |
| Push | Web Push API |

## Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── context/          # AuthContext and global state
│   ├── lib/              # Supabase clients, auth helpers
│   ├── services/         # Business logic (DB, email, SMS, AI, etc.)
│   └── types/            # Shared TypeScript types
├── supabase_migrations/  # SQL schema and migration files
├── public/               # Static assets, service worker
└── scripts/              # Utility scripts
```

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project
- Resend API key (for email)
- Twilio credentials (for SMS)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Jpalmer95/GetFreeQuote-UpWork-.git
cd GetFreeQuote-UpWork-
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

4. Run the database migrations in Supabase SQL Editor (see `supabase_migrations/`).

5. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

## Database Setup

Run the migration files in order inside the Supabase SQL Editor:

1. `supabase_schema.sql` — Base schema
2. `supabase_migrations/001_agent_hub.sql` — Agent Hub tables
3. `supabase_migrations/002_mcp_api_keys.sql` — MCP API key management
4. `supabase_migrations/003_poll_engine.sql` — Job polling engine
5. `supabase_migrations/004_poll_engine_v2.sql` — Polling enhancements
6. `supabase_migrations/005_go_local.sql` — Go Local gig work module
7. `supabase_migrations/006_enhancements.sql` — Platform enhancements
8. `supabase_migrations/RUN_THIS_IN_SUPABASE.sql` — Combined migration (easy setup)

Also configure:
- `supabase_realtime_setup.sql` — Enable realtime for notifications and job updates
- `supabase_storage_setup.sql` — Create storage buckets for file uploads

## Deployment

This project is designed to run on any Node.js host. For production:

1. Set all environment variables on your hosting platform
2. Run `npm run build`
3. Start with `npm run start`

Recommended platforms: Vercel, Coolify, DigitalOcean, or any Docker-compatible host.

## Architecture Highlights

- **Server-Side Rendering** — Next.js App Router with SSR for SEO and performance
- **Real-Time Layer** — Supabase Realtime subscriptions for live notifications and job updates
- **Service Layer** — Centralized business logic in `src/services/` for DB, email, SMS, and AI
- **Type Safety** — Full TypeScript coverage with shared types across frontend and API routes
- **Auth Context** — React context wrapping Supabase auth with session persistence and route guards

## License

Private — All rights reserved.

---

Built by Jonathan Korstad (Jpalmer95)
