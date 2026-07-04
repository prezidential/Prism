# Phase 4 — Acceptance Criteria

Verify with:

```bash
npm run typecheck              # zero errors
npx vitest run packages/mcp-layer   # 15 tests pass
npm run mcp:serve              # server boots on stdio (needs an MCP client to drive)
```

## Criteria

- [x] Five MCP tools registered: `query_identity`, `traverse_access_lineage`,
      `check_agent_scope`, `get_risk_signals`, `get_blast_radius`.
- [x] Tool core is SDK-free and depends only on an injectable `IdentographPort`;
      handlers are unit-tested with a mock port.
- [x] Every tool validates input with a Zod schema and rejects bad input before
      graph access (missing `tenantId`, unknown attribute, missing id+attribute).
- [x] `get_risk_signals` honors the optional `minScore` filter.
- [x] SDK-integration smoke test proves all tool shapes register on an `McpServer`.
- [x] End-to-end: `bin.ts` boots, completes the MCP handshake, and `tools/list`
      returns all five tools with correct input schemas.
- [x] `npm run mcp:serve` wired at the root and in the package.
- [x] Tool schemas documented in `docs/mcp-tools.md`; new dependency recorded in
      `docs/adr/0001-mcp-sdk.md`.

## Requires a live MCP client / ArcadeDB (not in unit tests)

- Driving the tools against a running ArcadeDB seeded with Phase 1 data via
  `claude --mcp-server`.
