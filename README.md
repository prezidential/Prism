# Prism — Agentic Identity Security Platform

Prism is an identity security platform built for the agentic AI era. Its core data structure — the **Identograph** — is a traversable graph unifying human, machine, and AI agent identities in real time.

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker + Docker Compose

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd prism
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (defaults work for local dev)

# 3. Start all infrastructure services
docker compose up -d

# 4. Verify services are healthy
curl http://localhost:2480/api/v1/ready    # ArcadeDB
curl http://localhost:8080/health/ready   # Keycloak

# 5. Run type check and tests
npm run typecheck
npm test
```

## Services

| Service | URL | Purpose |
|---|---|---|
| ArcadeDB | http://localhost:2480 | Identograph graph database + Studio UI |
| Kafka | localhost:9092 | Identity event streaming |
| Kafka UI | http://localhost:8090 | Kafka topic browser |
| PostgreSQL | localhost:5432 | Operational data + audit logs |
| Redis | localhost:6379 | Session state + hot graph cache |
| Keycloak | http://localhost:8080 | Platform authentication |

## Repository Structure

```
packages/
  identograph/   Phase 1 — Graph core (ArcadeDB schema + traversals)
  agents/        Phase 2 — Identity ingestion agents (Okta, AWS IAM)
  risk-engine/   Phase 3 — Risk scoring and anomaly detection
  mcp-layer/     Phase 4 — MCP server for Claude agent tooling
  api/           Phase 5 — REST + GraphQL API (Fastify + Mercurius)
  dashboard/     Phase 6 — React 18 governance UI

services/
  kafka/         Kafka consumer/producer wrappers
  postgres/      PostgreSQL client + migrations
  redis/         Redis client + cache helpers

tools/
  seed/          Demo graph seed data scripts
```

## Development Commands

```bash
npm run dev            # Start all Docker services
npm run typecheck      # TypeScript strict-mode check (zero errors required)
npm test               # Run full test suite

npm run dev:api        # Start API server (packages/api)
npm run dev:okta-agent # Start Okta ingest agent (packages/agents)

npm run infra:up       # Start infrastructure
npm run infra:down     # Stop infrastructure
npm run infra:reset    # Wipe volumes and restart

npm run migrate        # Run Identograph schema migrations
npm run seed           # Seed demo graph data
```

## Architecture

See `CLAUDE.md` for the full architectural specification, including the Identograph schema, tech stack decisions, and build roadmap.
