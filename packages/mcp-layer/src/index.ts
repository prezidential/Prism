// @prism/mcp-layer — Phase 4
//
// MCP server exposing the Identograph as tools Claude agents can call.
// The tool core (schemas + handlers) is SDK-free and depends only on an
// injectable IdentographPort; `server.ts` wires it to the MCP SDK + a live
// IdentographClient.

export { TOOLS, type ToolDefinition, type ToolOutput } from "./tools.js";
export type {
  IdentographPort,
  IdentityRecord,
  AgentScopeSummary,
  BlastRadiusSummary,
  RiskSignalRecord,
  LookupAttribute,
} from "./graph-port.js";
