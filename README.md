# Adverse Lead Intelligence

The complete Adverse Growth Engine: lead discovery, qualification, demo generation, outreach automation, agent orchestration, and the Agent Console UI.

Everything between **"find a business"** and **"close the deal"** lives here.

---

## What It Does

```
Discover → Qualify → Generate Demo → Generate Outreach → Approve → Send
```

1. **Discover** — Scrape public business listings
2. **Qualify** — Score: "Would they benefit AND can they afford it?"
3. **Demo** — Generate a WeBuilder Package_Config using existing templates
4. **Outreach** — Orchestrator generates personalized email/LinkedIn content
5. **Approve** — Review in Agent Console UI
6. **Send** — n8n workflow delivers the sequence

---

## Architecture

```
adverse-leadintel (this)              adamsverse (products)
────────────────────────              ─────────────────────
Lead intelligence pipeline            Public website
Agent Console UI (/agents/*)          WeBuilder renderer
Orchestrator + Agent system           Client portal
n8n outreach sending                  Admin panel
         ↕
    Supabase (shared)
```

---

## Quick Start

```bash
npm install
cp .env.example .env       # Add credentials
npm test                   # Verify
npm run dev                # Agent Console UI (localhost:5173)
```

---

## Commands

```bash
# Pipeline (server-side, Node.js)
npm run discover      # Run source connectors
npm run qualify       # Score discovered opportunities
npm run demo          # Generate demos
npm run pipeline      # Full pipeline

# UI (browser-side, React)
npm run dev           # Vite dev server (Agent Console)
npm run build         # Production build

# Quality
npm test              # All tests
npm run lint          # ESLint
```

---

## Project Structure

```
src/
├── sources/              # One file per data source connector
├── qualify/              # Qualification engine
│   ├── signals.js        # Gather website/review signals
│   └── score.js          # Scoring rules
├── demoGen/              # Demo Package_Config generation
│   └── configBuilder.js
├── outreach/             # Queue management
├── orchestrator/         # Pipeline engine, intent classification, n8n
│   ├── index.js          # Intent classification, task decomposition
│   ├── pipeline.js       # DAG execution engine
│   ├── db.js             # Supabase persistence
│   ├── n8n.js            # n8n workflow connector
│   └── alignment.js      # Alignment checks
├── agents/               # Agent role system
│   ├── registry.js       # Role types + CRUD
│   ├── contracts.js      # Schema validation
│   └── session.js        # Session execution
├── ui/                   # Agent Console (React)
│   ├── components/
│   │   ├── agents/       # ChatInterface, TaskBoard, ArtifactViewer, etc.
│   │   └── BasicAuthGate.jsx
│   └── pages/            # AgentChatPage, AgentRegistryPage, ArtifactBrowserPage
├── lib/                  # Shared utilities
│   ├── supabase.js
│   ├── packageSchema.js
│   ├── packageTemplates.js
│   └── schemas/
├── __tests__/            # Pipeline + orchestrator tests
└── run.js                # CLI entrypoint
```

---

## Environment

| Variable | Used By | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Pipeline | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Pipeline | Service role key (bypasses RLS) |
| `VITE_SUPABASE_URL` | UI | Same URL (for browser client) |
| `VITE_SUPABASE_ANON_KEY` | UI | Anon key (respects RLS) |
| `VITE_N8N_API_URL` | UI + Orchestrator | n8n instance URL |
| `VITE_N8N_API_KEY` | UI + Orchestrator | n8n API key |

---

## Related

- [Spec](./specs/lead-intelligence-system.md) — Full system specification
- [adamsverse](../adamsverse) — Public website, WeBuilder, client portal (products only)
