# QuoteBot

A Next.js application using Supabase for authentication and data storage.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database/Auth**: Supabase (`@supabase/supabase-js`)
- **Styling**: CSS Modules / globals
- **Package Manager**: npm

## Project Structure

```
src/
  app/          # Next.js App Router pages (dashboard, login, marketplace, post-job, vendor)
  components/   # Shared React components
  context/      # React context providers (AuthContext)
  lib/          # Supabase client setup
  services/     # API/service layer
  types/        # TypeScript types
public/         # Static assets
supabase_schema.sql  # Database schema
```

## Environment Variables (Secrets)

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key

## Running the App

The app runs on port 5000 (required for Replit preview):

```bash
npm run dev    # Development server on port 5000
npm run build  # Production build
npm run start  # Production server on port 5000
```

## Replit Configuration

- Workflow: `Start application` runs `npm run dev`
- `next.config.ts` includes `allowedDevOrigins` set to `REPLIT_DEV_DOMAIN` to suppress cross-origin warnings in dev
