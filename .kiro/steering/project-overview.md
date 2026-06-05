---
inclusion: auto
---

# Adverse Lead Intelligence — Project Overview

## What This Is

The complete Adverse Growth Engine: lead discovery, qualification, demo generation, outreach automation, and the Agent Console UI. Everything between "find a business" and "close the deal" lives here.

## Business Context

- **Company:** Adverse LLC (dba Adverse Solutions)
- **Owner:** Adam Abdulkadir
- **Primary revenue:** Website packages sold to SMBs
- **This system's role:** End-to-end pipeline from discovering prospects to sending personalized outreach with live demos

## How It Fits

```
adverse-leadintel (this)              adamsverse (products)
────────────────────────              ─────────────────────
Discover + Qualify + Demo             Public website
Agent Console UI                      WeBuilder renderer
Orchestrator + Pipeline               Client portal
n8n Send                              Admin panel
         ↕
    Supabase (shared)
```

adamsverse is the **product** — what clients see.
This repo is the **engine** — how we find and reach those clients.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime (pipeline) | Node.js 20 |
| Runtime (UI) | React 19 + Vite 7 |
| Scraping | Playwright |
| Orchestrator | Custom DAG pipeline engine |
| Agents | Role-based (planner, research, builder, audit, automation) |
| n8n | Workflow connector (axios) |
| Validation | ajv (JSON Schema) |
| Database | Supabase (PostgreSQL) |
| Testing | Vitest + fast-check + Testing Library |
| Routing (UI) | React Router DOM 7 |

## Key Commands

```bash
# Pipeline (server-side)
npm run discover      # Run source connectors
npm run qualify       # Score discovered opportunities
npm run demo          # Generate demos for qualified
npm run pipeline      # Full pipeline

# UI (browser-side)
npm run dev           # Vite dev server (agent console)
npm run build         # Build agent console for deployment

# Quality
npm test              # All tests
npm run lint          # ESLint
```

## Environment Variables

```
SUPABASE_URL              — Supabase project URL
SUPABASE_SERVICE_KEY      — Service role key (pipeline, bypasses RLS)
VITE_SUPABASE_URL         — Same URL (for UI client)
VITE_SUPABASE_ANON_KEY    — Anon key (for UI, uses RLS)
VITE_N8N_API_URL          — n8n instance URL
VITE_N8N_API_KEY          — n8n API key
```

## V1 Target

- Vertical: Restaurants
- Metro: Charlotte, NC
- Source: Yelp/Google Business public listings
- Full pipeline: discover → qualify → demo → outreach → send
