---
inclusion: auto
---

# Adverse Lead Intelligence — Architecture

## System Role

This repo is the **Adverse Growth Engine** — the complete lead intelligence and outreach automation platform. It handles everything from discovery to sending:

```
Discover → Qualify → Demo → Generate Outreach → Approve → Send
```

It also includes the **Agent Console UI** — a React-based internal tool for managing the AI agent pipeline, viewing tasks, reviewing artifacts, and approving outreach.

## Repo Boundary

```
adverse-leadintel (this repo)            adamsverse (separate repo)
──────────────────────────────           ────────────────────────────
Full outreach + lead intel system        Public website + WeBuilder + Client portal

- Source connectors (scrapers)           - Public pages (/, /about, /services, etc.)
- Qualification / scoring               - Package showcase (/packages, /packages/:slug)
- Demo config generation                 - Client portal (/dashboard/*)
- Orchestrator (pipeline engine)         - Admin panel (/admin/*)
- Agent system (registry, sessions)      - WeBuilder rendering
- n8n workflow connector                 - Stripe / Clerk auth
- Outreach content generation            - Static guides
- Agent Console UI (/agents/*)
- BasicAuth gate
```

## Shared Layer: Supabase

Both repos access the same Supabase project.

**This repo owns:**
- `opportunities` — lead discovery, qualification, demo configs
- `lead_sources` — source connector registry
- `pipeline_runs` — orchestrator pipeline state
- `tasks` — agent task execution
- `artifacts` — generated content (emails, proposals)
- `agent_roles` — agent role definitions

**adamsverse owns:**
- `profiles`, `projects`, `invoices`, `messages` — client portal data

## Two Runtimes

This repo has two execution modes:

### 1. CLI Pipeline (Node.js, server-side)
```
src/run.js → sources/ → qualify/ → demoGen/ → outreach/
```
Runs on VPS/cron. Does discovery, qualification, scoring, demo generation.
No browser. No React. Uses Playwright for scraping only.

### 2. Agent Console UI (React, browser-side)
```
src/ui/ → Vite dev server or built static files
```
Internal tool for viewing/approving outreach, managing agents, browsing artifacts.
Deployed separately (or same VPS with a static file server).

## Pipeline Architecture

```
Source Connector → Normalize → Store → Qualify → Score → DemoGen → Queue
                                                                     ↓
                                              Agent Console (approve) ↓
                                                                     ↓
                              Orchestrator → Generate Email → n8n Send
```

## Agent System

| Role Type | Purpose |
|-----------|---------|
| planner | Decomposes goals, synthesizes reports |
| research | Gathers information, validates data |
| builder | Generates content (emails, proposals, code) |
| audit | Evaluates operations, scores businesses |
| automation | Creates n8n workflow definitions |

**Pipeline execution:** DAG-based with dependency resolution, cycle detection (Kahn's algorithm), resumption from last completed task.

## Design Principles

1. **No platform abstractions.** Each source is a file. Each module is a function.
2. **Each phase ships independently.** Discovery alone produces value.
3. **Manual approval before send.** Nothing goes out without explicit approval.
4. **Qualification is the core value.** Scrapers are commodity.
5. **Two clean runtimes.** CLI pipeline (Node) and UI (React) don't mix.
