# Phase 6 — Dashboard & UI Spec

`@prism/dashboard` is the React 18 governance UI for the Identograph, built with
Vite (see ADR 0002). It runs standalone on bundled demo data and can point at the
live Phase 5 risk API.

## Views (all deliverables)

| View | Component | What it shows |
|---|---|---|
| Overview | `Overview` | KPI stat cards + highest-risk identities table |
| Identograph | `IdentographGraph` | Interactive SVG graph: human → agent → machine → entitlement → resource; node size ∝ risk; click to trace access |
| Identities | `RiskTable` | Risk-ranked, sortable, filterable identity inventory |
| Agent Scope | `AgentScopePanel` | Declared scope vs. observed ExecutionEvents, deviation gauge, out-of-scope actions |
| Alerts | `AlertFeed` | CAEP risk signals, newest first, severity-banded |
| Walkthrough | `Walkthrough` | Guided demo tour that drives the active view + focused node |

A shared `DetailPanel` inspects the selected identity's signals and connections.

## Architecture

- **Pure logic modules** (`lib/`, `data/`) hold everything testable — graph
  layout, table sort/filter, alert derivation, the walkthrough script, the demo
  dataset builder, and the API-response mapper. These are unit-tested under the
  normal node vitest run.
- **Components** (`components/`) are thin views over that logic.
- **`DataSource`** seam: `DemoDataSource` (bundled fixture, default) or
  `ApiDataSource` (`?api=<url>&tenant=<id>` → `GET /api/v1/risk/identities`).
- The interactive graph is a **hand-rolled SVG** with a deterministic lane layout
  — no graph-viz dependency, and the layout is unit-testable.

## Build & config

- `moduleResolution: Bundler`, `jsx: react-jsx`, `DOM` lib → the package is
  excluded from the root tsconfig and typechecked by its own `npm run typecheck`.
- `npm run build` → `vite build`; `npm run dev` → `vite`.

## Verification

- 15 unit tests over the pure logic (layout bounds/determinism, sort/filter,
  alert ordering, demo-data integrity, API mapping).
- `tsc --noEmit` (dashboard config) and `vite build` both clean.
- Playwright build-and-render smoke drives every view in Chromium (overview
  stats, graph nodes + node-select detail, identity search filtering, agent
  out-of-scope actions, alert feed, walkthrough stepping) with zero console
  errors. Not part of CI (no browser step); run against the built `dist`.

## Deferred

- Wiring the graph/agent views to dedicated live API endpoints (the risk
  endpoint powers identities + signals today; graph/agents use demo data until
  those endpoints exist).
