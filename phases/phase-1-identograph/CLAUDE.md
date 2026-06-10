# Phase 1 — Identograph Core

> Read this before starting any work on this phase.
> This supplements the root CLAUDE.md.

## What This Phase Builds

The Identograph core: ArcadeDB schema, the `IdentographClient`, and 6 traversal queries.
This is the data layer that every other phase depends on.

## Key Files

| File | Purpose |
|------|---------|
| `packages/identograph/src/migrations/001-initial-schema.ts` | Phase 0 vertex/edge types |
| `packages/identograph/src/migrations/002-phase1-identograph.ts` | Phase 1 vertex/edge types |
| `packages/identograph/src/migrations/runner.ts` | Runs all migrations in order; creates DB if missing |
| `packages/identograph/src/graph/client.ts` | `IdentographClient` — primary interface for all packages |
| `packages/identograph/src/graph/queries/` | 6 traversal query modules |
| `packages/identograph/src/seed/phase1-demo.ts` | Demo seed: 21 vertices, 15 edges |
| `packages/identograph/src/db/client.ts` | `ArcadeClient` — thin HTTP wrapper over ArcadeDB REST API |

## Database

- Name: `idem` (configured via `ARCADEDB_DB` env var, default `idem`)
- URL: `http://localhost:2480` (configured via `ARCADEDB_URL`)
- The migration runner creates the database if it does not exist

## Running

```bash
npm run db:init     # Create database + apply all migrations
npm run db:seed     # Populate Phase 1 demo data (21 vertices, 15 edges)
npm run typecheck   # Must pass with zero errors
npm test            # Must pass (234+ tests)
```

## Constraints

- Never use `any` types. Ever.
- The `IdentographClient` is the only interface other packages should import.
- `ArcadeClient` is internal to `packages/identograph`.
- All SQL is parameterized via string escaping — no raw user input in queries.
- `RiskSignal.eventPayload` is stored as a JSON string (ArcadeDB doesn't have a native JSON column type).
