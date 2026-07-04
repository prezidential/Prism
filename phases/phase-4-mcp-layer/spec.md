# Phase 4 — MCP Layer Spec

`@prism/mcp-layer` exposes the Identograph to Claude agents as MCP tools over
stdio, built on the official `@modelcontextprotocol/sdk` (see ADR 0001).

## Design

```
tools.ts / graph-port.ts   ← SDK-free core: Zod schemas + handlers over an
                              injectable IdentographPort (fully mock-testable)
        ↑ inject
server.ts                  ← composition root: adapts a live IdentographClient
                              to the port, registers tools on an McpServer,
                              serves over stdio  (the ONLY SDK + cross-package file)
bin.ts                     ← executable entrypoint (`npm run mcp:serve`)
```

The core never imports the MCP SDK or `@prism/identograph`. `server.ts` reaches
`@prism/identograph` by relative source import because the monorepo runs on
tsx/vitest and never builds package `dist/`; `server.ts` and `bin.ts` are
therefore excluded from the package's `rootDir`-constrained tsconfig and
typechecked at the repo root instead.

## Tools

Five tools, each tenant-scoped, documented in `docs/mcp-tools.md`:

| Tool | Wraps |
|---|---|
| `query_identity` | identity lookup by id or attribute (`V` vertex query) |
| `traverse_access_lineage` | `IdentographClient.accessLineage` |
| `check_agent_scope` | `IdentographClient.agentScope` |
| `get_risk_signals` | `IdentographClient.listRiskSignals` (+ `minScore` filter) |
| `get_blast_radius` | `IdentographClient.blastRadius` |

Each tool validates input with a Zod schema, calls the port, and returns
`{ summary, data }` serialized as MCP text content.

## Verification

- Handler unit tests with a mock port (behavior, filtering, cross-field rules,
  schema rejection).
- SDK-integration smoke test: every tool's Zod shape registers on an `McpServer`
  without error.
- End-to-end: `bin.ts` boots, completes the MCP handshake, and returns all five
  tools from `tools/list` (run manually / via an MCP client; no live graph
  needed to list tools).

## Deferred

- ArcadeDB's native MCP server wired alongside the custom tool layer (optional;
  the custom layer is the primary surface).
- Richer `check_agent_scope` that evaluates a *proposed* action against scope
  (current tool returns the declared-vs-observed analysis).
