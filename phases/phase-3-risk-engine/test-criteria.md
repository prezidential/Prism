# Phase 3 — Acceptance Criteria

Verify with:

```bash
npm run typecheck                 # zero errors
npx vitest run packages/risk-engine   # 31 tests pass
```

## Criteria

- [x] `npm run typecheck` passes with zero errors in strict mode.
- [x] All five scorers return correctly typed `RiskFinding[]` and are unit-tested
      for both flag and no-flag cases.
- [x] Aggregation combines findings with weighted noisy-OR, stays within `[0, 1]`,
      and sorts identities by composite score descending.
- [x] `writeSignal` emits a well-formed `RiskSignal` INSERT with SSF/CAEP fields
      and SQL-escapes embedded text.
- [x] `evaluateRisk` runs all scorers, writes signals only above the threshold,
      and persists composite scores back onto identity vertices.
- [x] The red-team integration test trips all five scorers from one graph and
      asserts finding/signal/persistence counts.
- [x] `getRiskIdentities` returns risky identities sorted by score with their
      contributing signals, tolerating both object and JSON-string payloads.
- [x] `npm run risk:evaluate` script is wired at the root and in the package.

## Requires live infrastructure (not covered by unit tests)

- `npm run risk:evaluate` against a running ArcadeDB seeded with Phase 1 data.
