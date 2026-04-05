# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## What This Is

Prism is an agentic-native identity security platform. Not IGA with AI bolted on.
Built from first principles around agents as the unit of governance.

## Core Architecture Decisions

- **Agents replace connectors.** No scheduled jobs. No batch ETL.
- **ArcadeDB** for the identity graph (Apache 2.0, built-in MCP server, native vector search)
- **Kafka** for all inter-agent communication (event-driven end to end)
- **MCP (Model Context Protocol)** for LLM-to-tool and LLM-to-database communication
- **TypeScript / Node.js** as primary language
- **Anthropic Claude** as the agent runtime (`claude-sonnet-4-6`)
- **Fastify** for API layer
- **React 18 + TypeScript** for UI

## The Data Model Is Called Identograph

Unified semantic graph. All identity types in one schema:
human, non-human, AI agent, service account, API token, workload identity.
ArcadeDB stores it. The MCP server on ArcadeDB lets agents query it directly.

## Current Phase

**Phase 1: Identograph Core**

1. ArcadeDB running in Docker with full Prism schema
2. All node types, edge types, property constraints defined
3. Synthetic seed data (500 human, 200 service accounts, 50 agent identities)
4. GraphQL read API over the graph

## Full Spec

See `/docs/prismspec.md` for the complete platform architecture.

## Monorepo Structure

```
prism/
- packages/
  - identograph/         ArcadeDB schema, migrations, seed data
    - src/schema/            TypeScript types + enums for all node/edge types
    - src/migrations/        ArcadeDB DDL migration scripts + runner
    - src/seed/              Synthetic data generators
    - src/db/                ArcadeDB REST client
  - api/                 Fastify + Mercurius GraphQL read API
    - src/db/                ArcadeDB REST client (read-only)
    - src/graphql/           Schema and resolvers
  - agents/              Agent runtime (Phase 2+)
- docs/                  Architecture specs (prismspec.md)
- docker-compose.yml
- package.json           npm workspaces root
- tsconfig.json          Base TypeScript config (all packages extend this)
```

All packages are scoped as `@prism/<name>` and use `"type": "module"` (ESM).

## Development Commands

```bash
# Infrastructure
npm run infra:up      # Start ArcadeDB + Kafka + Kafka UI
npm run infra:down    # Stop services (keep volumes)
npm run infra:reset   # Wipe volumes and restart fresh
npm run infra:logs    # Follow all service logs

# Identograph
npm run migrate       # Apply schema DDL to ArcadeDB (idempotent)
npm run seed          # Load synthetic data (500 humans, 200 SA, 50 agents)

# API
npm run dev:api       # Start GraphQL API dev server on port 4000
npm run build         # Compile all packages to dist/
```

## Key URLs (after infra:up)

| Service | URL | Notes |
|---|---|---|
| ArcadeDB Studio | http://localhost:2480 | creds: `root` / `prism-dev-secret` |
| Kafka UI | http://localhost:8090 | |
| GraphQL API | http://localhost:4000/graphql | after `npm run dev:api` |
| GraphiQL | http://localhost:4000/graphiql | interactive query explorer |

## Identograph Schema

12 vertex types: HumanIdentity, ServiceAccount, AgentIdentity, APIToken, WorkloadIdentity,
DeviceIdentity, Application, Resource, Role, Policy, Group, OrgUnit

10 edge types: HAS_ACCESS, ASSIGNED_ROLE, MEMBER_OF, REPORTS_TO, OWNS, SPAWNED, GOVERNS,
PEER_OF, CREATED_BY, USED_BY

All nodes carry a `tenantId` field. Seed data uses `tenantId: "prism-dev"`.

## ArcadeDB Client

Both packages use a thin fetch-based REST client (no external driver):
- `packages/identograph/src/db/client.ts` - read/write (used by migrations and seed)
- `packages/api/src/db/client.ts` - read-only (used by GraphQL resolvers)

Connection is configured via environment variables:
```
ARCADEDB_URL=http://localhost:2480  (default)
ARCADEDB_DB=prism                   (default)
ARCADEDB_USER=root                  (default)
ARCADEDB_PASS=prism-dev-secret      (default)
PRISM_TENANT_ID=prism-dev           (default)
```

## Phase 2: First Ingest Agent

### Kafka Topics

| Topic | Purpose |
|---|---|
| `identity.events.raw` | Raw events from ingest agents |
| `identity.events.processed` | Confirmed writes to Identograph |
| `audit.log` | Immutable audit trail |

### @prism/agents Package Structure

```
packages/agents/src/
  base/        IngestAgent interface
  messages/    IdentityEventEnvelope + Okta payload types
  kafka/       KafkaProducer, KafkaConsumer, topic definitions
  ssd/         Source System Definition YAML parser and loader
  correlation/ Identity correlation engine (exact match)
  graph/       GraphWriteService (transactional upserts)
  okta/        Okta REST client, ingest agent, webhook listener
```

### SSD Files

Source System Definition YAML files live in `packages/agents/ssd/`.
See `packages/agents/ssd/okta-dev.yaml` for the Okta example.

### Key Environment Variables (Phase 2)

| Variable | Default | Purpose |
|---|---|---|
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated broker list |
| `OKTA_DOMAIN` | - | Okta tenant domain |
| `OKTA_API_TOKEN` | - | Okta SSWS token |
| `OKTA_WEBHOOK_SECRET` | - | HMAC secret for webhook verification |
| `SSD_PATH` | - | Path to SSD YAML file |

## Testing

Every phase of the build must have a full automated test suite. Tests run with Vitest and live
alongside the source code in `src/**/__tests__/` directories.

```bash
npm test              # run all tests across all packages (vitest workspace)
npm run test:watch    # watch mode
```

### Test locations

| Package | Test file | What it covers |
|---|---|---|
| identograph | `src/schema/__tests__/enums.test.ts` | All enum values and counts match the spec |
| identograph | `src/migrations/__tests__/migration.test.ts` | DDL completeness, IF NOT EXISTS guards, tenantId coverage |
| identograph | `src/db/__tests__/client.test.ts` | ArcadeDB client: query, command, insertVertex, escape, error handling |
| identograph | `src/seed/__tests__/generators.test.ts` | Generator counts, field validity, referential integrity between edges and nodes |
| api | `src/graphql/__tests__/schema.test.ts` | GraphQL schema builds, all 12 node types present, all query fields present |
| api | `src/graphql/__tests__/resolvers.test.ts` | Resolver logic with mocked DB: filtering, pagination, SQL shape, type resolution |
| api | `src/__tests__/server.test.ts` | Fastify integration: health, introspection, stats, humans, agents, GraphiQL |

### Test conventions

- **Framework:** Vitest. All test files end in `.test.ts` and live under `src/**/__tests__/`.
- **Isolation:** Unit tests mock all external I/O (fetch, DB) with `vi.fn()` / `vi.stubGlobal`. No network calls in unit tests.
- **Integration tests** (server tests) use `fastify.inject()` - no real network, no real DB.
- **No `any` in tests** - type all mocks and assertions explicitly.
- **Test names** describe the contract, not the implementation: "returns null when not found", not "calls db.query once".
- **Each new Phase must add tests** before code ships. Tests are not optional.
- Test files are excluded from the TypeScript build output (not emitted to `dist/`).

### Adding tests for a new phase

1. Create `src/**/__tests__/<module>.test.ts` inside the relevant package
2. Mock external dependencies (DB, Kafka, external HTTP) - never call live services in unit/integration tests
3. Run `npm test` to verify all existing tests still pass before opening a PR

## Infrastructure

Services are defined in `docker-compose.yml`:

| Service | Port | Purpose |
|---|---|---|
| `prism-arcadedb` | 2480 (HTTP), 2424 (binary) | Identity graph database + Studio UI |
| `prism-kafka` | 9092 | Event bus for inter-agent communication |
| `prism-kafka-ui` | 8090 | Kafka UI for local visibility |

```bash
npm run infra:up      # Start all services (detached)
npm run infra:down    # Stop services (keep volumes)
npm run infra:reset   # Wipe volumes and restart
npm run infra:logs    # Follow all service logs
```

ArcadeDB Studio is available at http://localhost:2480 after startup.
Default credentials: `root` / `prism-dev-secret`

Kafka internal broker address (container-to-container): `kafka:9094`
Kafka external address (host): `localhost:9092`

## TypeScript

- Node >= 20, npm >= 10
- Target: `ES2022`, module system: `NodeNext`
- `strict: true` and `noUncheckedIndexedAccess: true` are on - no exceptions
- Each package has its own `tsconfig.json` that extends `../../tsconfig.json`
- Build output goes to `dist/` (gitignored)

## What We Do Not Do

- No scheduled jobs anywhere in the platform
- No batch aggregation
- No connector libraries
- No per-seat pricing model (this is outcome-based)

## Writing Conventions

- No em dashes in any documentation or code comments. Use regular dashes or rewrite the sentence.

## Repository

- **Main branch:** `main`
- **Remote:** `prezidential/Prism` (GitHub)

## Development Branch Convention

Feature and task branches follow the pattern:
```
<tool>/<description>-<id>
```
Example: `claude/add-claude-documentation-HYxNJ`

Always develop on the designated branch and push with:
```bash
git push -u origin <branch-name>
```

## Git Workflow

1. Create or switch to the task branch
2. Make changes with focused, descriptive commits
3. Push to the remote branch when complete
4. Open a PR only when explicitly requested

### Commit Message Style

Use concise imperative sentences:
```
Add initial project structure
Fix authentication token refresh logic
Update README with setup instructions
```

Avoid vague messages like "fix stuff" or "WIP".

## Updating This File

Keep CLAUDE.md current as the project evolves. After any significant change to tooling, structure, or conventions, update the relevant section here. This file is the primary reference for AI assistants onboarding to this codebase.
