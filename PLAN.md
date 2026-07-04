# Idem Build Plan

> Agents: Update this file when completing phase milestones. Mark completed phases `[DONE]`.
> David: Review this file before approving each phase kickoff.

---

## Target: Identiverse Demo (v0.1)

16-week build. Every phase ends with something runnable and demonstrable.

---

## Phase 0 — Foundation & Scaffolding [DONE]

**Weeks:** 1  
**Primary Tool:** Claude Code (single session)  
**Branch:** `feature/phase-0-foundation`

### Deliverables
- [x] Monorepo initialized with npm workspaces
- [x] All package directories scaffolded (`packages/identograph`, `packages/api`, `packages/agents`, `packages/risk-engine`, `packages/mcp-layer`, `packages/dashboard`, `services/kafka`, `services/postgres`, `services/redis`, `tools/seed`)
- [x] TypeScript configured (strict mode, ESM, path aliases)
- [x] Base `tsconfig.json` + per-package configs
- [x] Docker Compose: ArcadeDB, Kafka, PostgreSQL, Redis, Keycloak
- [x] `npm run dev` starts all services
- [x] `npm run typecheck` passes (zero errors)
- [x] `npm test` passes (188 tests)
- [x] `README.md` with setup instructions
- [x] `.env.example` with all required variables documented
- [x] GitHub Actions CI: typecheck + test on every PR

### Success Criteria
```bash
docker compose up -d        # all services healthy
npm run typecheck           # zero errors
npm test                    # passes (empty suite OK)
curl localhost:2480         # ArcadeDB responds
```

**Agent Goal Condition:**
> "All Phase 0 deliverables are checked off, `npm run typecheck` passes, `npm test` passes, `docker compose up -d` starts all services healthy, and a PR is open from `feature/phase-0-foundation` to `main`."

---

## Phase 1 — Identograph Core [DONE]

**Weeks:** 2–3  
**Primary Tool:** Claude Code (Agent Team)  
**Branch:** `feature/phase-1-identograph`

### Deliverables
- [x] ArcadeDB schema initialization script (migration runner + migrations 001 + 002) — idempotent
- [x] All vertex classes: `HumanIdentity`, `AgentIdentity`, `NHIdentity`, `Resource`, `Entitlement`, `Session`, `Delegation`, `ExecutionEvent`, `RiskSignal`
- [x] All edge classes: `HAS_ENTITLEMENT`, `DELEGATES_TO`, `EXECUTED_BY`, `OWNS_RESOURCE`, `TRUSTS`, `GENERATES_SIGNAL`
- [x] Indexes on: `id`, `riskScore`, `subjectRef`, `caepEventType`, `agentRef`, `correlationId`, and more
- [x] `IdentographClient` class (`src/graph/client.ts`) — full CRUD + traversal interface
- [x] 6 traversal query files in `src/graph/queries/`:
  - `access-lineage.ts` — who has access to what, and through what chain
  - `agent-scope.ts` — what is an agent declared to do vs. what it has actually done
  - `delegation-paths.ts` — full delegation chain from source to target
  - `risk-surface.ts` — all identities above a risk threshold with their contributing signals
  - `blast-radius.ts` — if this identity is compromised, what is accessible
  - `entitlement-overlap.ts` — cross-identity entitlement overlap detection
- [x] Seed data script (`src/seed/phase1-demo.ts`) — 21 vertices, 15 edges, exercises all 6 queries
- [x] Full test suite — 234 passing tests across 24 test files
- [x] `packages/identograph/src/index.ts` barrel export

### Success Criteria
```bash
npm run db:init             # schema created with no errors
npm run db:seed             # test data populated
npm test -- tests/graph     # all tests pass
npm run typecheck           # zero errors
```

**Agent Goal Condition:**
> "Phase 1 is complete when `npm run db:init` initializes schema without errors, `npm run db:seed` populates test data without errors, all 6 traversal queries return correctly typed results, `npm test -- tests/graph` passes, and TypeScript compiles with zero errors in strict mode. A PR is open from `feature/phase-1-identograph` to `main`."

---

## Phase 2 — Identity Ingestion Pipeline [IN PROGRESS]

**Weeks:** 3–4  
**Primary Tool:** Claude Code + Cursor  
**Branch:** `feature/phase-2-ingestion` (further work delivered on `claude/resume-from-docs-pra0xz`)

### Deliverables
- [x] Kafka consumer for identity events (`packages/agents/src/kafka/consumer.ts`)
- [x] AWS IAM ingestor — IAM users/roles/policies → NHIdentity/Entitlement vertices + HAS_ENTITLEMENT edges (`src/aws/mapper.ts`, `src/aws/ingestor.ts`; source injected — live AWS SDK adapter is the only deferred piece)
- [x] Okta ingestor — reads users, groups, app assignments → Identograph (`src/okta/*`)
- [x] **Demo environment bridge** — reads `tools/demo-provisioner/state.json` → seeds Identograph using `seedId` fields as anchors (`src/demo/bridge.ts`)
- [x] Normalization layer — provider mappers produce a shared `MappedGraph` (`src/ingest/graph-ops.ts`)
- [x] Reconciliation logic — upsert strategy, idempotent on re-run (`applyMappedGraph` + `ArcadeGraphWriteService.upsertVertex/Edge`)
- [x] Dead letter queue for failed events (`src/dlq/dead-letter-queue.ts`; per-item DLQ in `applyMappedGraph`)
- [ ] Live integration test: provision demo environment → run ingestion → verify graph populated — *deferred; needs a running demo-provisioner + ArcadeDB (logic covered by unit tests with fixtures/mocks)*

### Success Criteria
```bash
npm test -- packages/agents   # ingestion mapper/ingestor/bridge + DLQ tests pass
npm run typecheck             # zero errors
# Live: npm run ingest:demo against a seeded demo-provisioner + ArcadeDB
```

---

## Phase 3 — Risk Engine [DONE]

**Weeks:** 5–7  
**Primary Tool:** Claude Code (Agent Team)  
**Branch:** `feature/phase-3-risk-engine` (delivered on `claude/resume-from-docs-pra0xz`)

### Deliverables
- [x] Risk scoring algorithms (graph-traversal-based, not rule-based) in `packages/risk-engine`:
  - [x] Excessive delegation depth score (`scoring/delegation-depth.ts`)
  - [x] Unused entitlement score / dormant access (`scoring/dormant-entitlement.ts`)
  - [x] Agent scope deviation score — declared vs. actual behavior (`scoring/agent-scope-deviation.ts`)
  - [x] Cross-identity entitlement overlap / SoD score (`scoring/entitlement-overlap.ts`)
  - [x] Blast radius score (`scoring/blast-radius.ts`)
- [x] Composite aggregation — weighted noisy-OR over per-identity findings (`aggregate.ts`)
- [x] Risk signal writer — materializes `RiskSignal` vertices as SSF/CAEP SETs (`signal-writer.ts`)
- [x] Evaluation orchestrator — `evaluateRisk()` + `npm run risk:evaluate` CLI, persists composite scores back onto identity vertices (`evaluate.ts`, `cli/evaluate.ts`)
- [x] Risk API data layer: `getRiskIdentities()` — identities sorted by risk score with contributing signals (`api/risk-identities.ts`). HTTP route `GET /api/v1/risk/identities` now delivered in the API layer (see Phase 5).
- [x] Red-team scenario coverage — 31 unit + integration tests; `__tests__/evaluate.test.ts` exercises a graph that trips all five scorers end-to-end
- [x] Real-time risk evaluation on ingest events — `RiskEvaluationConsumer` re-evaluates a tenant's risk on identity events, with per-tenant coalescing + DLQ (`packages/agents/src/risk/consumer.ts`, `npm run risk:consume`)
- [x] Anomaly detection: behavioral baseline per identity, deviation alerts — `detectAnomalies` / `behavioral-anomaly` scorer (novel actions/targets, volume spike, elevated denials); integrated into `createDefaultScorers` (`anomaly/behavioral-baseline.ts`)

### Success Criteria
```bash
npm run risk:evaluate       # scores all identities in current graph (needs live ArcadeDB)
npm test                    # risk-engine scorers + red-team scenarios pass (31 tests)
npm run typecheck           # zero errors
```

---

## Phase 4 — MCP Layer [IN PROGRESS]

**Weeks:** 7–8  
**Primary Tool:** Claude Code (subagents)  
**Branch:** `feature/phase-4-mcp-layer` (delivered on `claude/resume-from-docs-pra0xz`)

### Deliverables
- [x] MCP server (`packages/mcp-layer`, `@modelcontextprotocol/sdk`, stdio) exposing Identograph as tools:
  - [x] `query_identity` — look up any identity by id or attribute
  - [x] `traverse_access_lineage` — run access-lineage traversal
  - [x] `check_agent_scope` — declared scope vs. observed ExecutionEvents
  - [x] `get_risk_signals` — retrieve risk signals for an identity (+ `minScore` filter)
  - [x] `get_blast_radius` — compute blast radius for a given identity
- [x] SDK-free, injectable tool core (`IdentographPort`) with mock-based unit tests; live wiring quarantined to `server.ts`
- [x] `npm run mcp:serve` entrypoint; end-to-end verified (server boots, MCP handshake, `tools/list` returns all five)
- [x] Tool schemas documented in `docs/mcp-tools.md`; new dependency recorded in `docs/adr/0001-mcp-sdk.md`
- [ ] ArcadeDB native MCP server wired alongside the custom layer — *deferred; the custom tool layer is the primary surface*
- [ ] Drive tools against live ArcadeDB via `claude --mcp-server` — *manual step; needs seeded ArcadeDB*

### Success Criteria
```bash
npm run typecheck                  # zero errors
npx vitest run packages/mcp-layer  # tool + schema + SDK-integration tests pass (15)
npm run mcp:serve                  # server boots on stdio
```

---

## Phase 5 — API & Auth Layer [ ]

**Weeks:** 8–10  
**Primary Tool:** Cursor Background Agents  
**Branch:** `feature/phase-5-api-layer`

### Deliverables
- [~] Fastify REST API — `GET /api/v1/risk/identities` delivered (`packages/api/src/routes/risk.ts`, injects risk-engine `getRiskIdentities`, `app.inject`-tested); full OpenAPI spec + remaining routes pending
- [x] GraphQL API via Mercurius
- [ ] Keycloak integration for auth
- [ ] Rate limiting, request validation (Zod schemas)
- [ ] Full API reference: `docs/api-reference.md` (auto-generated from route handlers)

---

## Phase 6 — Dashboard & UI [DONE]

**Weeks:** 10–13  
**Primary Tool:** Cursor Background Agents  
**Branch:** `feature/phase-6-dashboard` (delivered on `claude/resume-from-docs-pra0xz`)

### Deliverables
- [x] React 18 dashboard (`packages/dashboard`, Vite; runs on demo data or the live risk API)
- [x] Identograph visualization — interactive hand-rolled SVG graph, node size ∝ risk, click-to-trace access (`components/IdentographGraph.tsx`)
- [x] Identity risk table with sorting + search/type/min-risk filtering (`components/RiskTable.tsx`, `lib/risk-table.ts`)
- [x] Agent scope view: declared intent vs. actual execution, deviation gauge (`components/AgentScopeView.tsx`)
- [x] Real-time alert feed — CAEP signals newest-first, severity-banded (`components/AlertFeed.tsx`, `lib/alerts.ts`)
- [x] Demo-optimized walkthrough flow — guided tour driving views + focus (`components/Walkthrough.tsx`, `lib/walkthrough.ts`)
- [x] Verified: dashboard `tsc` + `vite build` clean; 15 logic tests; Playwright build-and-render smoke drives every view in Chromium with zero console errors (ADR 0002)

### Success Criteria
```bash
npm run typecheck                              # zero errors
npx vitest run packages/dashboard              # 15 logic tests pass
npm run build --workspace=packages/dashboard   # vite build succeeds
```

---

## Phase 7 — Hardening, Tests & Demo Prep [ ]

**Weeks:** 13–16  
**Primary Tool:** Both  
**Branch:** `feature/phase-7-hardening`

### Deliverables
- [ ] All 7 red team scenarios pass end-to-end
- [ ] All performance benchmarks met (traversal queries <200ms on demo dataset)
- [ ] `npm run demo` — docker compose up + seed + open browser
- [ ] `npm run demo:reset` — wipes and re-seeds demo data
- [ ] All documentation complete and accurate
- [ ] Zero TypeScript errors across entire codebase
- [ ] `npm test` passes 100%
- [ ] 10-minute demo script executable without errors

---

## Completed Phases

*Nothing completed yet. Agents: move phase entries here when done.*
