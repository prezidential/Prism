# ADR 0002 — Dashboard build stack (Vite + React 18)

- Status: Accepted
- Date: 2026-07-04
- Phase: 6 — Dashboard & UI

## Context

Phase 6 delivers the React 18 governance UI. React 18 is already mandated by the
stack in `CLAUDE.md`; this ADR records the surrounding build/tooling choices and
one new dependency family.

## Decision

Build `@prism/dashboard` with **Vite 6 + `@vitejs/plugin-react`** as the bundler
and dev server. Vitest (already in the monorepo) is vite-native, so the test and
build toolchains share one transform pipeline. No runtime UI framework beyond
React + ReactDOM is added; the interactive Identograph graph is a hand-rolled SVG
component with a deterministic layout — avoiding a heavy graph-viz dependency and
keeping the layout unit-testable.

Structural choices that keep the dashboard from disrupting the rest of the repo:
- The package uses `moduleResolution: "Bundler"` + `jsx: "react-jsx"` and a
  `DOM` lib, which are incompatible with the repo-root NodeNext/Node config, so
  `packages/dashboard` is **excluded from the root tsconfig** and typechecked by
  its own `npm run typecheck`.
- UI logic (graph layout, table sort/filter, alert derivation, data mapping,
  the walkthrough script) lives in **pure modules** unit-tested under the normal
  node-environment vitest run. React components are thin views over that logic
  and are verified by a Playwright build-and-render smoke (not part of CI, since
  CI has no browser step).
- A `DataSource` seam lets the UI run on bundled demo data (default, for the
  standalone demo) or the live Phase 5 risk API (`?api=<url>`).

## Consequences

- New dev dependencies in `@prism/dashboard`: `vite`, `@vitejs/plugin-react`,
  `react`/`react-dom` (runtime), `@types/react`/`@types/react-dom`. Pinned to the
  React 18 line per the stack requirement.
- Component rendering is verified manually via Playwright (Chromium is
  pre-provisioned in the environment); committed tests cover the pure logic.
- Full protocol/browser conformance is out of scope for CI; the build (`vite
  build`) and typecheck run in the workspace scripts.
