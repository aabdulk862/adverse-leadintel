---
inclusion: auto
---

# Adverse Lead Intelligence — Testing Strategy

## Test Runner

- **Vitest** with jsdom environment
- **fast-check** for property-based testing
- **@testing-library/react** for component tests

## Running Tests

```bash
npm test                              # All tests
npm test -- --run src/__tests__/property-*   # Property tests only
npm test -- --run src/ui/              # Component tests only
```

## Test Locations

- Pipeline/orchestrator tests: `src/__tests__/`
- Component tests: co-located in `src/ui/` (e.g., `ChatInterface.test.jsx`)

## Property-Based Tests (Lead Intelligence)

| File | Properties |
|------|-----------|
| `property-leadintel-normalize.test.js` | Idempotent, deterministic dedup key |
| `property-leadintel-scoring.test.js` | Score 0-100, disqualified never qualifies |
| `property-leadintel-demogen.test.js` | Config validates, vertical maps to slug |

## Unit Tests (Orchestrator)

| File | Coverage |
|------|----------|
| `unit-orchestrator-pipeline.test.js` | DAG execution, cycle detection, resumption |
| `unit-orchestrator-outreach-pipeline.test.js` | Outreach intent, task decomposition, schema |
| `unit-orchestrator-lifecycle.test.js` | Pipeline state transitions |
| `unit-orchestrator-n8n.test.js` | n8n workflow creation/activation |
| `unit-orchestrator-index.test.js` | Intent classification |
| `unit-orchestrator-audit-pipeline.test.js` | Audit pipeline tasks |
| `unit-orchestrator-session.test.js` | Agent session execution |
| `unit-orchestrator-alignment.test.js` | Alignment check formatting |
| `unit-orchestrator-db-artifacts.test.js` | Artifact persistence |
| `unit-contracts.test.js` | Schema validation, data transfer |
| `registry.test.js` | Agent role CRUD |

## Component Tests (Agent Console UI)

Co-located with components:
- `ChatInterface.test.jsx`
- `TaskBoard.test.jsx`
- `ArtifactViewer.test.jsx`
- `AgentCard.test.jsx`
- `AlignmentCard.test.jsx`
- `AgentChatPage.test.jsx`
- `AgentRegistryPage.test.jsx`
- `ArtifactBrowserPage.test.jsx`

## Mocking

- Mock Supabase client for all DB tests
- Mock HTTP responses for signal gathering
- Mock n8n API for workflow tests
- Never make real network calls in tests

## Before Committing

```bash
npm run lint && npm test
```
