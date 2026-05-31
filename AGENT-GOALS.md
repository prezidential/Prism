# Idem Agent Goal Conditions

> Copy-paste these /goal conditions when kicking off each phase sprint.
> Each condition is written for Haiku to evaluate — specific, verifiable, no ambiguity.

---

## Phase 0 — Foundation

```
/goal All Phase 0 deliverables in PLAN.md are checked off: monorepo initialized with npm workspaces, all package directories exist, TypeScript strict mode configured, Docker Compose starts ArcadeDB + Kafka + PostgreSQL + Redis + Keycloak all healthy, npm run typecheck passes with zero errors, npm test passes, README.md and .env.example exist, and a PR is open from feature/phase-0-foundation to main.
```

**Usage:**
```bash
claude -p "/goal All Phase 0 deliverables in PLAN.md are checked off: monorepo initialized with npm workspaces, all package directories exist, TypeScript strict mode configured, Docker Compose starts ArcadeDB + Kafka + PostgreSQL + Redis + Keycloak all healthy, npm run typecheck passes with zero errors, npm test passes, README.md and .env.example exist, and a PR is open from feature/phase-0-foundation to main."
```

---

## Phase 1 — Identograph Core

```
/goal Phase 1 is complete: npm run db:init initializes ArcadeDB schema without errors and is idempotent, npm run db:seed populates test graph data without errors, all 6 traversal query files exist in src/graph/queries/ and return correctly typed results, npm test -- tests/graph passes with zero failures, TypeScript compiles with zero errors in strict mode, and a PR is open from feature/phase-1-identograph to main.
```

**Usage:**
```bash
claude -p "/goal Phase 1 is complete: npm run db:init initializes ArcadeDB schema without errors and is idempotent, npm run db:seed populates test graph data without errors, all 6 traversal query files exist in src/graph/queries/ and return correctly typed results, npm test -- tests/graph passes with zero failures, TypeScript compiles with zero errors in strict mode, and a PR is open from feature/phase-1-identograph to main."
```

---

## Phase 2 — Identity Ingestion

```
/goal Phase 2 is complete: npm run ingest:demo reads demo-provisioner state and populates the Identograph with all seeded AWS IAM and Okta identities using seedId fields as anchors, ingestion is idempotent (running twice produces identical graph state), npm test -- tests/ingestion passes with zero failures, TypeScript compiles with zero errors, and a PR is open from feature/phase-2-ingestion to main.
```

---

## Phase 3 — Risk Engine

```
/goal Phase 3 is complete: all 5 risk scoring algorithms are implemented and deterministic, all 7 red team scenarios in phases/phase-3-risk-engine/spec.md trigger correct RiskSignal vertices, npm run risk:evaluate scores all identities in the demo graph without errors, npm test -- tests/risk passes with zero failures, TypeScript compiles with zero errors, and a PR is open from feature/phase-3-risk-engine to main.
```

---

## Phase 4 — MCP Layer

```
/goal Phase 4 is complete: all 5 MCP tools (query_identity, traverse_access_lineage, check_agent_scope, get_risk_signals, get_blast_radius) are implemented and callable via claude --mcp-server, check_agent_scope returns in under 50ms, all tools are documented in docs/mcp-tools.md with input schema, output schema, and example, npm test -- tests/mcp passes with zero failures, TypeScript compiles with zero errors, and a PR is open from feature/phase-4-mcp-layer to main.
```

---

## Usage Tips

### Single-session autonomous run (walk away mode):
```bash
cd /path/to/idem
export IDEM_PROJECT_ROOT=$(pwd)
claude -p "[paste /goal condition above]"
```

### Named session (resumable):
```bash
claude --session-name "idem-phase-1-identograph"
# Then inside Claude Code:
# /goal [condition]
```

### Resume after interruption:
```bash
claude --resume idem-phase-1-identograph
```

### Check what's running (Agent View — requires v2.1.139+):
```bash
claude agents
```

---

## Token Budget Guidance

| Phase | Complexity | Recommended Plan | Est. Sessions |
|---|---|---|---|
| Phase 0 | Low | Pro ($20) | 1 focused session |
| Phase 1 | High | Max 5x ($100) | Agent team, 2-3 sessions |
| Phase 2 | Medium | Max 5x | 1-2 sessions |
| Phase 3 | High | Max 5x | Agent team, 2-3 sessions |
| Phase 4 | Medium | Pro or Max 5x | 1-2 sessions |
| Phase 5-7 | High | Max 5x | Multiple sessions |

**Rule of thumb:** If you're running an agent team (Phase 1 or 3), be on Max 5x.
Single-agent phases can run on Pro if sessions are scoped tightly to one module.
