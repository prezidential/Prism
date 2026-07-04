# Identograph MCP Tools

`@prism/mcp-layer` (Phase 4) exposes the Identograph to Claude agents as MCP
tools over stdio. Start it with:

```bash
npm run mcp:serve        # tsx packages/mcp-layer/src/bin.ts, stdio transport
```

Register it with Claude via `claude --mcp-server`, or connect any MCP client.
The server name is `prism-identograph`.

## Architecture

The tool **core** (`tools.ts`, `graph-port.ts`) is SDK-free and depends only on
an injectable `IdentographPort`, so it is fully unit-testable with a mock. The
composition root (`server.ts`) adapts a live `IdentographClient` to the port and
registers each tool on an `McpServer`. Every tool returns a `{ summary, data }`
object serialized as JSON text content.

All tools are tenant-scoped: every input requires `tenantId`.

## Tools

### `query_identity`
Look up an identity by id, or find identities by a matching attribute.

| Input | Type | Required | Notes |
|---|---|---|---|
| `tenantId` | string | yes | |
| `id` | string | one of | Exact identity id |
| `attribute` | enum | one of | `email` \| `employeeId` \| `displayName` \| `name` |
| `value` | string | with `attribute` | Value the attribute must equal |

Provide either `id`, or both `attribute` and `value`.
Returns `{ identity }` (by id) or `{ identities: [...] }` (by attribute).

### `traverse_access_lineage`
Trace how an identity reaches the resources it can access.

| Input | Type | Required |
|---|---|---|
| `tenantId` | string | yes |
| `identityId` | string | yes |

Returns `{ identityId, paths: [...] }`.

### `check_agent_scope`
Compare an agent's declared scope against its observed `ExecutionEvent`s.

| Input | Type | Required |
|---|---|---|
| `tenantId` | string | yes |
| `agentId` | string | yes |

Returns the scope analysis: `declaredScope`, `totalEvents`, `inScopeCount`,
`outOfScopeCount`, `outOfScopeEvents`, and `deviationScore`.

### `get_risk_signals`
Retrieve the CAEP risk signals generated for an identity.

| Input | Type | Required | Notes |
|---|---|---|---|
| `tenantId` | string | yes | |
| `subjectRef` | string | yes | Identity id the signals concern |
| `minScore` | number 0–1 | no | Only signals with `score >= minScore` |

Returns `{ subjectRef, signals: [...] }`.

### `get_blast_radius`
Compute what an identity can reach if compromised.

| Input | Type | Required |
|---|---|---|
| `tenantId` | string | yes |
| `identityId` | string | yes |

Returns reach counts (`totalResourceCount`, `criticalResourceCount`,
`privilegedEntitlementCount`, `totalIdentityCount`), the normalized
`blastRadiusScore`, and the reachable resources/identities.

## Result envelope

```jsonc
{
  "summary": "human-readable one-liner",
  "data":    { /* structured, tool-specific payload */ }
}
```

Invalid input is rejected by each tool's Zod schema before any graph access.
