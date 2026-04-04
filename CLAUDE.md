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

See `/docs/prism_platform_spec.docx` for the complete platform architecture.

## Monorepo Structure

```
prism/
- packages/
  - identograph/    ArcadeDB schema, migrations, seed data
    - src/schema/       vertex/edge type definitions
    - src/migrations/   schema migration scripts
    - src/seed/         synthetic data generators
  - api/            Fastify + GraphQL API over the Identograph
    - src/
  - agents/         Agent runtime; ingest agent is first
    - src/
- docs/             Architecture specs and design documents
- docker-compose.yml
- package.json      npm workspaces root
- tsconfig.json     Base TypeScript config (all packages extend this)
```

All packages are scoped as `@prism/<name>` and use `"type": "module"` (ESM).

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
