// Smoke test for the MCP SDK integration.
//
// The handler tests cover tool behavior with a mock port. This test verifies the
// remaining runtime risk that the SDK-free tests can't: that the MCP SDK actually
// accepts every tool's Zod input shape at registration time. It mirrors the exact
// registration `server.ts::buildMcpServer` performs (importing server.ts here
// would pull @prism/identograph source into this package's rootDir-constrained
// typecheck), so it exercises the same SDK surface `buildMcpServer` relies on.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../tools.js";

describe("MCP SDK integration", () => {
  it("registers every tool's Zod input shape without error", () => {
    const server = new McpServer({ name: "prism-identograph", version: "0.1.0" });
    expect(() => {
      for (const tool of TOOLS) {
        server.registerTool(
          tool.name,
          { description: tool.description, inputSchema: tool.inputSchema.shape },
          async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
        );
      }
    }).not.toThrow();
  });

  it("rejects a duplicate tool name — proving tools actually registered", () => {
    const server = new McpServer({ name: "prism-identograph", version: "0.1.0" });
    const first = TOOLS[0];
    if (!first) throw new Error("no tools");
    const register = (): void => {
      server.registerTool(
        first.name,
        { description: first.description, inputSchema: first.inputSchema.shape },
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      );
    };
    register();
    expect(register).toThrow();
  });
});
