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

## Phase 2 — Identity Ingestion Pipeline [ ]

**Weeks:** 3–4  
**Primary Tool:** Claude Code + Cursor  
**Branch:** `feature/phase-2-ingestion`

### Deliverables
- [ ] Kafka consumer for identity events (`services/kafka/identity-consumer.ts`)
- [ ] AWS IAM ingestor — reads IAM users, roles, policies → Identograph vertices/edges
- [ ] Okta ingestor — reads users, groups, app assignments → Identograph vertices/edges
- [ ] **Demo environment bridge** — reads `tools/demo-provisioner/state.json` → seeds Identograph using `seedId` fields as anchors
- [ ] Normalization layer — maps provider-specific fields to Identograph schema
- [ ] Reconciliation logic — upsert strategy (no duplicates on re-run)
- [ ] Dead letter queue for failed events
- [ ] Integration test: provision demo environment → run ingestion → verify graph populated

### Success Criteria
```bash
npm run ingest:demo         # reads demo-provisioner state → populates Identograph
npm test -- tests/ingestion # all tests pass
# ArcadeDB has vertices for all seeded demo AWS + Okta identities
```

---

## Phase 3 — Risk Engine [ ]

**Weeks:** 5–7  
**Primary Tool:** Claude Code (Agent Team)  
**Branch:** `feature/phase-3-risk-engine`

### Deliverables
- [ ] Risk scoring algorithms (graph-traversal-based, not rule-based):
  - Excessive delegation depth score
  - Unused entitlement score (dormant access)
  - Agent scope deviation score (declared vs. actual behavior)
  - Cross-identity entitlement overlap score
  - Blast radius score
- [ ] Risk signal writer — materializes `RiskSignal` vertices into the Identograph
- [ ] Real-time risk evaluation on ingest events (Kafka consumer)
- [ ] Anomaly detection: behavioral baseline per identity, deviation alerts
- [ ] Risk API: `GET /api/v1/risk/identities` — sorted by risk score
- [ ] 7 red team scenarios that trigger correct risk signals (defined in `phases/phase-3-risk-engine/spec.md`)

### Success Criteria
```bash
npm run risk:evaluate       # scores all identities in current graph
npm test -- tests/risk      # all 7 red team scenarios produce correct signals
```

---

## Phase 4 — MCP Layer [ ]

**Weeks:** 7–8  
**Primary Tool:** Claude Code (subagents)  
**Branch:** `feature/phase-4-mcp-layer`

### Deliverables
- [ ] MCP server exposing Identograph as tools:
  - `query_identity` — look up any identity by ID or attribute
  - `traverse_access_lineage` — run access-lineage traversal
  - `check_agent_scope` — validate agent action against declared scope
  - `get_risk_signals` — retrieve risk signals for an identity
  - `get_blast_radius` — compute blast radius for a given identity
- [ ] ArcadeDB native MCP server wired up alongside custom tool layer
- [ ] MCP server tested with Claude via `claude --mcp-server` flag
- [ ] Tool response schemas documented in `docs/mcp-tools.md`

### Success Criteria
```bash
# Claude can successfully call check_agent_scope and get a typed response
npm test -- tests/mcp       # all tool schemas validate
```

---

## Phase 5 — API & Auth Layer [ ]

**Weeks:** 8–10  
**Primary Tool:** Cursor Background Agents  
**Branch:** `feature/phase-5-api-layer`

### Deliverables
- [ ] Fastify REST API with full OpenAPI spec
- [ ] GraphQL API via Mercurius
- [ ] Keycloak integration for auth
- [ ] Rate limiting, request validation (Zod schemas)
- [ ] Full API reference: `docs/api-reference.md` (auto-generated from route handlers)

---

## Phase 6 — Dashboard & UI [ ]

**Weeks:** 10–13  
**Primary Tool:** Cursor Background Agents  
**Branch:** `feature/phase-6-dashboard`

### Deliverables
- [ ] React 18 dashboard
- [ ] Identograph visualization (interactive graph)
- [ ] Identity risk table with sorting/filtering
- [ ] Agent scope view: declared intent vs. actual execution
- [ ] Real-time alert feed
- [ ] Demo-optimized 10-minute walkthrough flow

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
