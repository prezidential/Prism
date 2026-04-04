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
