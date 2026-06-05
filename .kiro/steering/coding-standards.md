---
inclusion: auto
---

# Adverse Lead Intelligence — Coding Standards

## Language & Runtime

- JavaScript/JSX — JSDoc types for IDE support
- ES modules (`import`/`export`) — no CommonJS
- Node.js 20 for pipeline code
- React 19 for Agent Console UI

## File Organization

```
src/
├── sources/              # Source connectors (one file per source)
├── qualify/              # Qualification engine (signals, scoring)
├── demoGen/              # Demo Package_Config generation
├── outreach/             # Outreach queue management
├── orchestrator/         # Pipeline engine, intent classification, n8n
├── agents/               # Agent role registry, contracts, sessions
├── lib/                  # Shared utilities (supabase, normalize, store, schemas)
├── ui/                   # Agent Console UI (React)
│   ├── components/       # Reusable UI components
│   │   └── agents/       # Agent console components + CSS modules
│   └── pages/            # Route-level page components
├── __tests__/            # Pipeline + orchestrator tests
└── run.js                # CLI entrypoint
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Source connectors | camelCase | `charlotteRestaurants.js` |
| Lib/pipeline modules | camelCase | `normalize.js`, `store.js` |
| React components | PascalCase | `ChatInterface.jsx` |
| React pages | PascalCase + Page | `AgentChatPage.jsx` |
| CSS Modules | ComponentName.module.css | `TaskBoard.module.css` |
| Tests | `*.test.{js,jsx}` | `unit-orchestrator-pipeline.test.js` |
| Property tests | `property-*.test.js` | `property-leadintel-scoring.test.js` |

## Module Interface Pattern (Pipeline)

Every pipeline module returns `{ data, error }` — never throws:

```javascript
export async function doThing() {
  try {
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "ERROR_CODE" } };
  }
}
```

## Component Pattern (UI)

```jsx
import styles from "./ComponentName.module.css";

export default function ComponentName({ prop1, prop2 }) {
  return <div className={styles.wrapper}>{/* content */}</div>;
}
```

## Import Order

1. React/framework
2. Third-party packages
3. Local components (UI only)
4. Local lib/modules
5. Schemas
6. Styles

## Error Handling

- Pipeline: Return `{ data: null, error }` objects, never throw
- UI: try/catch in async handlers, display in UI
- Scraper failures: log and continue to next record

## Validation

- All inter-module data validated with ajv (JSON Schema draft 2020-12)
- `allErrors: true`
- Schemas co-located or in `src/lib/schemas/`

## Environment Variables

- Pipeline (server-side): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (no prefix)
- UI (browser): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_N8N_API_URL`, `VITE_N8N_API_KEY`

## Security

- Never expose service role key in UI code or logs
- Rate limit all scraper requests (2s min between same-domain calls)
- Respect robots.txt
- BasicAuth protects Agent Console UI
