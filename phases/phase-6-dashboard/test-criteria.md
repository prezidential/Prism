# Phase 6 — Acceptance Criteria

Verify with:

```bash
npm run typecheck                     # zero errors (dashboard has its own tsc)
npx vitest run packages/dashboard     # 15 logic tests pass
npm run build --workspace=packages/dashboard   # vite build succeeds
```

## Criteria

- [x] React 18 dashboard shell with sidebar nav across all views.
- [x] Interactive Identograph SVG graph: nodes by kind, size ∝ risk, click-to-select highlights neighbors and opens a detail panel.
- [x] Identity risk table with sortable columns and search / type / min-risk filters.
- [x] Agent scope view: declared scope vs. observed events, deviation gauge, out-of-scope action list.
- [x] Real-time-style alert feed: CAEP signals newest-first, severity-banded, with per-severity counts.
- [x] Demo walkthrough: guided multi-step tour that drives the active view and focused entity.
- [x] `DataSource` abstraction: bundled demo data (default) or live risk API via `?api=`.
- [x] Pure UI logic unit-tested (layout, sort/filter, alerts, demo-data integrity, API mapping).
- [x] `vite build` and dashboard `tsc --noEmit` both clean.
- [x] Playwright build-and-render smoke drives every view in Chromium with zero console errors.

## Requires a live backend (not exercised here)

- Graph and agent-scope views against dedicated live API endpoints (pending in the API layer).
