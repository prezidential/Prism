# Idem — Claude Code Master Context

> Read this file at the start of every session. Do not skip sections.
> This is the authoritative source of truth for all architectural decisions.

---

## What Idem Is

Idem is an **agentic-native identity security platform** built from first principles.
It is not a retrofit of an existing IGA, PAM, or ISPM product. It assumes agents are
first-class identity principals alongside humans and machines.

The platform's central data structure is the **Identograph** — a living, traversable
graph of identity relationships built on ArcadeDB. Every feature in Idem is a function
of the Identograph.

**The core hypothesis:** Third-generation agentic AI will make current identity platforms
obsolete because they were designed for human-initiated, batch-processed access patterns.
Idem is designed for continuous, ambient, real-time identity governance where AI agents
are both consumers and enforcers of access policy.

---

## The Identograph

The Identograph captures:

| Entity Type | Vertex Class | Purpose |
|---|---|---|
| Human identities | `HumanIdentity` | Users, employees, contractors |
| AI agent identities | `AgentIdentity` | LLM agents, automation bots, AI workers |
| Non-human identities | `NHIdentity` | IAM users, service accounts, API keys |
| Resources | `Resource` | AWS services, applications, data stores |
| Entitlements | `Entitlement` | Permissions, roles, policies |
| Sessions | `Session` | Active access periods |
| Delegations | `Delegation` | Trust grants between identities |
| Execution events | `ExecutionEvent` | Observed actions by agents |
| Risk signals | `RiskSignal` | Derived risk scores from graph traversal |

Every feature — risk scoring, anomaly detection, compliance reporting, agent governance —
is a function of traversing and reasoning over the Identograph. **There are no rule engines.
There are no batch jobs. There is only the graph.**

---

## Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|---|---|---|
| Graph Database | **ArcadeDB** | Apache 2.0, built-in MCP server, native vector search |
| Application Runtime | **TypeScript / Node.js** | Strict mode. No `any` types. ESM imports. |
| Event Streaming | **Apache Kafka** | Identity event bus |
| Relational Store | **PostgreSQL** | Operational data, audit logs |
| Caching | **Redis** | Session state, hot graph paths |
| AI / Reasoning | **Claude (Anthropic API)** | `claude-sonnet-4-20250514` default; Haiku for high-volume |
| Agent Protocol | **MCP (Model Context Protocol)** | ArcadeDB exposes native MCP server |
| API | **REST + GraphQL** | Fastify for REST; GraphQL via Mercurius |
| Frontend | **React 18** | Dashboard and governance UI |
| Auth | **Keycloak** | Platform-level auth |
| Observability | **OpenTelemetry** | All agents emit traces |
| Package Manager | **npm workspaces** | Monorepo |

**Do not introduce new dependencies without creating a `docs/adr/` (Architecture Decision Record).**
**Do not use `any` in TypeScript. Ever.**

---

## Repository Structure

```
/
├── CLAUDE.md                    ← You are here
├── PLAN.md                      ← Phase-by-phase build roadmap (read before each sprint)
├── architecture/
│   ├── identograph-schema.md    ← ArcadeDB vertex/edge schema (authoritative)
│   ├── interface-contracts.md   ← TypeScript interfaces all phases must implement
│   └── adr/                     ← Architecture Decision Records
├── packages/
│   ├── identograph/             ← Phase 1: Graph core (ArcadeDB client + traversals)
│   ├── ingestion/               ← Phase 2: Identity ingest pipeline
│   ├── risk-engine/             ← Phase 3: Risk scoring and anomaly detection
│   ├── mcp-layer/               ← Phase 4: MCP server exposing Identograph tools
│   ├── api/                     ← Phase 5: REST + GraphQL API
│   └── dashboard/               ← Phase 6: React governance UI
├── services/
│   ├── kafka/                   ← Kafka consumer/producer wrappers
│   ├── postgres/                ← PostgreSQL client and migrations
│   └── redis/                   ← Redis client and cache helpers
├── tools/
│   ├── demo-provisioner/        ← AWS NHI + Okta demo environment agent (EXISTS — DO NOT MODIFY)
│   └── seed/                    ← Graph seed data scripts
├── tests/
│   ├── unit/                    ← Jest unit tests (mock all external systems)
│   └── integration/             ← Integration tests (require running services)
├── phases/
│   └── phase-N-name/
│       ├── CLAUDE.md            ← Phase-specific instructions (read before phase work)
│       ├── spec.md              ← Detailed feature spec for this phase
│       └── test-criteria.md     ← Acceptance criteria Claude Code must verify
└── docs/
    ├── architecture.md
    ├── api-reference.md
    └── demo-setup.md
```

---

## Workflow Rules (Enforced by Hooks)

1. **Never push to `main` directly.** All work goes on feature branches: `feature/phase-N-description`.
2. **Never modify `tools/demo-provisioner/`** without explicit instruction from David. This is live demo infrastructure.
3. **Run `npm run typecheck` before every commit.** Zero TypeScript errors required.
4. **Run `npm test -- [relevant test path]` before marking any task complete.** Tests must pass.
5. **Update `PLAN.md`** when completing a phase milestone. Mark the section `[DONE]`.
6. **Write an ADR** (`docs/adr/NNNN-title.md`) for any new dependency or significant architectural decision.
7. **Context window discipline:** When exploring codebase, read targeted files. Do not recursively read entire directories unless exploring for the first time in a session.
8. **Commit frequently.** One logical change per commit. Descriptive commit messages in imperative form: `Add IdentographClient traversal methods for delegation paths`.

---

## Code Style

```typescript
// ESM imports only
import { IdentographClient } from '@idem/identograph';

// Destructure when possible
import { createServer, type FastifyInstance } from 'fastify';

// Explicit return types on all exported functions
export async function findRiskyAgents(client: IdentographClient): Promise<AgentIdentity[]> { ... }

// No any types
// No non-null assertions (!.) in production code — use proper null checks
// Prefer const over let
// Named exports over default exports (except React components)
```

---

## Competitive Context (For Reasoning, Not for Building)

Idem competes against:
- **Veza** — access graph intelligence, human-centric, no agentic identity model
- **Linx Security** — NHI focused, single-agent Autopilot, IGA evolution
- **Oasis Security** — NHI lifecycle management, compliance angle
- **Astrix Security** — third-party app integrations, API key management
- **ServiceNow AI Control Tower** — AI governance from ITSM/workflow side (acquired Veza)

**Idem's differentiation:** The Identograph unifies human, machine, and agent identity in
a single traversable graph with real-time risk scoring and native MCP tooling.
No competitor has a native agentic identity model. All are retrofitting agents onto
human-centric architectures.

---

## Demo Environment (Already Built)

The demo environment provisioner lives at `tools/demo-provisioner/`. It:
- Provisions AWS NHI layer: IAM users with access keys, IAM roles, Lambda functions (agentic workloads), Secrets Manager secrets with deliberate risk profiles
- Provisions Okta layer: Human users, groups, Bookmark Apps (AWS Console, Saviynt Portal, ServiceNow ITSM)
- Resets seed data: rotates IAM keys, restores secrets, reconciles Okta profiles
- Exposes a Claude tool-use REPL: `setup_environment`, `reset_environment`, `get_environment_status`

**SeedId fields in demo-seed.json are Identograph anchors.** When Phase 2 (Ingestion) runs,
these seedIds are the foreign keys linking the demo AWS/Okta data into the Identograph.

---

## Session Naming Convention

Name all Claude Code sessions: `idem-phase-N-[module]`
Example: `idem-phase-1-identograph-schema`

This allows `claude --resume` to find the right session later.

---

## If You Are Unsure About Architecture

1. Read `architecture/identograph-schema.md` and `architecture/interface-contracts.md`
2. Read the current phase's `phases/phase-N-name/CLAUDE.md` and `spec.md`
3. Check `docs/adr/` for relevant decisions
4. If still unclear, **stop and ask David** rather than making an assumption that requires rework
