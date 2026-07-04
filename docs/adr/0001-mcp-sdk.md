# ADR 0001 — Adopt the official MCP SDK for the MCP layer

- Status: Accepted
- Date: 2026-07-04
- Phase: 4 — MCP Layer

## Context

Phase 4 exposes the Identograph to Claude agents as MCP tools. MCP is already a
non-negotiable part of the stack (see `CLAUDE.md` — "Agent Protocol: MCP"). We
need a server implementation of the protocol (initialization handshake, tool
registration, `tools/list`, `tools/call`, stdio transport). Hand-rolling the
JSON-RPC framing and protocol semantics would be error-prone and would drift from
the spec as MCP evolves.

`zod` is also introduced here for tool input validation; it is already used
elsewhere in the monorepo (`@prism/agents`), so it is not a new external surface.

## Decision

Add **`@modelcontextprotocol/sdk`** (`^1.29.0`) as a dependency of
`@prism/mcp-layer`, and use its `McpServer` + `StdioServerTransport` to host the
tools. Use `zod` schemas for tool inputs, passed to `registerTool` as the
input shape.

Containment measures:
- Only `server.ts` / `bin.ts` import the SDK. The tool core (`tools.ts`,
  `graph-port.ts`) is SDK-free and depends solely on an injectable
  `IdentographPort`, keeping the tools unit-testable without the SDK or a live
  graph.
- The SDK is a runtime dependency of one package, not hoisted into shared code.

## Consequences

- We track the MCP spec via a maintained SDK rather than bespoke protocol code.
- New external dependency (`@modelcontextprotocol/sdk`) and its transitive deps
  enter `@prism/mcp-layer`. `zod` is shared with existing packages.
- The MCP layer consumes `@prism/identograph` by relative source import (the
  monorepo runs on tsx/vitest and never builds package `dist/`); the two
  boundary-crossing files are typechecked at the repo root. See
  `packages/mcp-layer/tsconfig.json`.
- End-to-end verification (server boots, handshake, `tools/list`) is exercised
  manually and by the SDK-integration smoke test; full protocol conformance is
  delegated to the SDK.
