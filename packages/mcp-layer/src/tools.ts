// MCP tool definitions for the Identograph.
//
// Each tool is a pure adapter: a Zod input schema plus a handler that validates
// input, calls the injected IdentographPort, and returns a summary + structured
// data. Nothing here imports the MCP SDK or @prism/identograph — that keeps the
// tool core fully unit-testable with a mock port. `server.ts` maps these into a
// running MCP server.

import { z } from "zod";
import type { IdentographPort, LookupAttribute } from "./graph-port.js";

// What every tool handler returns. `server.ts` serializes this into MCP content.
export interface ToolOutput {
  summary: string;
  data: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (port: IdentographPort, input: unknown) => Promise<ToolOutput>;
}

const tenantId = z.string().min(1).describe("Tenant the query is scoped to");

// --- query_identity ---------------------------------------------------------

const LOOKUP_ATTRIBUTES = ["email", "employeeId", "displayName", "name"] as const;

const queryIdentitySchema = z.object({
  tenantId,
  id: z.string().min(1).optional().describe("Exact identity id to look up"),
  attribute: z
    .enum(LOOKUP_ATTRIBUTES)
    .optional()
    .describe("Attribute to match when not looking up by id"),
  value: z.string().min(1).optional().describe("Value the attribute must equal"),
});

const queryIdentity: ToolDefinition = {
  name: "query_identity",
  description:
    "Look up an identity in the Identograph by its id, or find identities by a matching attribute (email, employeeId, displayName, name).",
  inputSchema: queryIdentitySchema,
  handler: async (port, input) => {
    const args = queryIdentitySchema.parse(input);
    // Cross-field rule: need either an id, or an attribute + value pair.
    if (args.id === undefined && (args.attribute === undefined || args.value === undefined)) {
      throw new Error("Provide either `id`, or both `attribute` and `value`.");
    }
    if (args.id !== undefined) {
      const identity = await port.getIdentityById(args.tenantId, args.id);
      return {
        summary: identity
          ? `Found ${identity.nodeType} ${identity.id} (risk ${identity.riskScore}).`
          : `No identity found with id ${args.id}.`,
        data: { identity },
      };
    }
    const attribute = args.attribute as LookupAttribute;
    const matches = await port.findIdentitiesByAttribute(args.tenantId, attribute, args.value ?? "");
    return {
      summary: `Found ${matches.length} identit${matches.length === 1 ? "y" : "ies"} where ${attribute} = "${args.value}".`,
      data: { identities: matches },
    };
  },
};

// --- traverse_access_lineage -----------------------------------------------

const accessLineageSchema = z.object({
  tenantId,
  identityId: z.string().min(1).describe("Identity whose access lineage to trace"),
});

const traverseAccessLineage: ToolDefinition = {
  name: "traverse_access_lineage",
  description:
    "Trace how an identity reaches the resources it can access — the full chain of entitlements, roles, and grants.",
  inputSchema: accessLineageSchema,
  handler: async (port, input) => {
    const args = accessLineageSchema.parse(input);
    const lineage = await port.accessLineage(args.tenantId, args.identityId);
    return {
      summary: `Access lineage for ${args.identityId}: ${lineage.length} path(s).`,
      data: { identityId: args.identityId, paths: lineage },
    };
  },
};

// --- check_agent_scope ------------------------------------------------------

const agentScopeSchema = z.object({
  tenantId,
  agentId: z.string().min(1).describe("Agent identity to evaluate"),
});

const checkAgentScope: ToolDefinition = {
  name: "check_agent_scope",
  description:
    "Compare an agent's declared scope against its observed ExecutionEvents. Returns the declared scope, deviation score, and any out-of-scope actions.",
  inputSchema: agentScopeSchema,
  handler: async (port, input) => {
    const args = agentScopeSchema.parse(input);
    const scope = await port.agentScope(args.tenantId, args.agentId);
    const verdict =
      scope.outOfScopeCount === 0
        ? "within declared scope"
        : `${scope.outOfScopeCount} of ${scope.totalEvents} action(s) out of scope`;
    return {
      summary: `Agent ${args.agentId}: ${verdict} (deviation ${scope.deviationScore}).`,
      data: scope,
    };
  },
};

// --- get_risk_signals -------------------------------------------------------

const riskSignalsSchema = z.object({
  tenantId,
  subjectRef: z.string().min(1).describe("Identity id the signals concern"),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Only return signals with score >= this value"),
});

const getRiskSignals: ToolDefinition = {
  name: "get_risk_signals",
  description:
    "Retrieve the CAEP risk signals generated for an identity, optionally filtered by a minimum score.",
  inputSchema: riskSignalsSchema,
  handler: async (port, input) => {
    const args = riskSignalsSchema.parse(input);
    const all = await port.listRiskSignals(args.tenantId, args.subjectRef);
    const min = args.minScore ?? 0;
    const signals = all.filter((s) => s.score >= min);
    return {
      summary: `${signals.length} risk signal(s) for ${args.subjectRef}${
        args.minScore !== undefined ? ` at score >= ${min}` : ""
      }.`,
      data: { subjectRef: args.subjectRef, signals },
    };
  },
};

// --- get_blast_radius -------------------------------------------------------

const blastRadiusSchema = z.object({
  tenantId,
  identityId: z.string().min(1).describe("Identity to compute blast radius for"),
});

const getBlastRadius: ToolDefinition = {
  name: "get_blast_radius",
  description:
    "Compute what an identity can reach if compromised — reachable resources (with criticality), privileged entitlements, and downstream identities.",
  inputSchema: blastRadiusSchema,
  handler: async (port, input) => {
    const args = blastRadiusSchema.parse(input);
    const blast = await port.blastRadius(args.tenantId, args.identityId);
    return {
      summary: `${args.identityId} reaches ${blast.totalResourceCount} resource(s) (${blast.criticalResourceCount} critical) and ${blast.totalIdentityCount} identit${
        blast.totalIdentityCount === 1 ? "y" : "ies"
      }; score ${blast.blastRadiusScore}.`,
      data: blast,
    };
  },
};

// Every tool the MCP server exposes.
export const TOOLS: ToolDefinition[] = [
  queryIdentity,
  traverseAccessLineage,
  checkAgentScope,
  getRiskSignals,
  getBlastRadius,
];
