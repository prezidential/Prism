// MCP server composition root.
//
// This is the ONE file that reaches across package boundaries and touches the
// MCP SDK. It adapts the real IdentographClient to the IdentographPort, then
// registers every tool on an McpServer over stdio. Everything the tools actually
// do lives in `tools.ts` (SDK-free, mock-tested).
//
// Cross-package import is by relative source path on purpose: the monorepo runs
// on tsx/vitest and never builds package `dist/`, so a bare `@prism/identograph`
// specifier would not resolve at typecheck time (nor in CI).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// eslint-disable-next-line no-restricted-imports -- see note above
import { IdentographClient } from "../../identograph/src/index.js";
import type { IdentityRecord, IdentographPort, LookupAttribute } from "./graph-port.js";
import { TOOLS, type ToolOutput } from "./tools.js";

// Build an IdentographPort backed by a live IdentographClient.
export function makePort(client: IdentographClient): IdentographPort {
  const escape = (v: string): string => v.replace(/'/g, "\\'");

  return {
    async getIdentityById(tenantId, id) {
      const rows = await client.arcade.query<IdentityRecord>(
        `SELECT FROM V WHERE tenantId = '${escape(tenantId)}' AND id = '${escape(id)}' LIMIT 1`,
      );
      return rows[0] ?? null;
    },
    async findIdentitiesByAttribute(tenantId, attribute: LookupAttribute, value) {
      return client.arcade.query<IdentityRecord>(
        `SELECT FROM V WHERE tenantId = '${escape(tenantId)}' AND \`${attribute}\` = '${escape(value)}'`,
      );
    },
    accessLineage(tenantId, identityId) {
      return client.accessLineage(tenantId, identityId);
    },
    agentScope(tenantId, agentId) {
      return client.agentScope(tenantId, agentId);
    },
    blastRadius(tenantId, identityId) {
      return client.blastRadius(tenantId, identityId);
    },
    listRiskSignals(tenantId, subjectRef) {
      return client.listRiskSignals(tenantId, subjectRef);
    },
  };
}

// Construct an McpServer with every Identograph tool registered against a port.
export function buildMcpServer(port: IdentographPort): McpServer {
  const server = new McpServer({
    name: "prism-identograph",
    version: "0.1.0",
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        const output: ToolOutput = await tool.handler(port, args);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      },
    );
  }

  return server;
}

// Entrypoint: wire a live client to stdio. Run via `npm run mcp:serve`.
export async function main(): Promise<void> {
  const client = new IdentographClient();
  const server = buildMcpServer(makePort(client));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console -- stderr is safe on stdio transport
  console.error("prism-identograph MCP server ready on stdio");
}
