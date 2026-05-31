# Phase 1 Test Criteria

## Automated (must pass before PR merges)

```bash
npm run typecheck   # zero TypeScript errors
npm test            # all tests pass
```

## Manual Smoke Tests (run after docker compose up -d)

```bash
# 1. Create idem database and apply schema
npm run db:init
# Expected: "All migrations complete" with 0 failed statements

# 2. Idempotency check — re-run must not fail
npm run db:init
# Expected: same output, no errors

# 3. Seed demo data
npm run db:seed
# Expected: "Phase 1 demo seed complete" with 21 vertices and 15 edges

# 4. Verify in ArcadeDB Studio
open http://localhost:2480
# Check: NHIdentity, Entitlement, Session, Delegation, ExecutionEvent, RiskSignal vertex types exist
# Check: HAS_ENTITLEMENT, DELEGATES_TO, EXECUTED_BY, OWNS_RESOURCE, TRUSTS, GENERATES_SIGNAL edge types exist
```

## Traversal Query Acceptance

Each traversal query must return correctly typed results (not empty, no runtime errors)
when called against the seeded demo graph:

| Query | Expected Result |
|-------|----------------|
| `accessLineage(tenantId, bob.id)` | ≥1 result (DatabaseAdmin entitlement) |
| `agentScope(tenantId, ingestAgent.id)` | `outOfScopeCount: 1`, `deviationScore: 0.5` |
| `delegationPaths(tenantId, bob.id)` | ≥1 hop to ingestAgent |
| `riskSurface(tenantId, 0.5)` | ≥2 results (apiKey at 0.85, lambdaRole at 0.6) |
| `blastRadius(tenantId, bob.id)` | ≥1 reachable resource |
| `entitlementOverlap(tenantId)` | ≥1 result (bob + carol share AnalyticsExport) |
