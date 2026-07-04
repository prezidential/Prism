import { describe, expect, it } from "vitest";
import type {
  AgentScopeSummary,
  BlastRadiusSummary,
  IdentityRecord,
  IdentographPort,
  RiskSignalRecord,
} from "../graph-port.js";
import { TOOLS, type ToolDefinition } from "../tools.js";

function tool(name: string): ToolDefinition {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t;
}

function identity(over: Partial<IdentityRecord> = {}): IdentityRecord {
  return {
    id: "id-1",
    tenantId: "t1",
    nodeType: "HumanIdentity",
    status: "Active",
    riskScore: 0.5,
    ...over,
  };
}

// A mock port with per-method overrides; unset methods throw if called.
function mockPort(over: Partial<IdentographPort> = {}): IdentographPort {
  const notImpl = (name: string) => (): never => {
    throw new Error(`unexpected call: ${name}`);
  };
  return {
    getIdentityById: over.getIdentityById ?? (notImpl("getIdentityById") as never),
    findIdentitiesByAttribute:
      over.findIdentitiesByAttribute ?? (notImpl("findIdentitiesByAttribute") as never),
    accessLineage: over.accessLineage ?? (notImpl("accessLineage") as never),
    agentScope: over.agentScope ?? (notImpl("agentScope") as never),
    blastRadius: over.blastRadius ?? (notImpl("blastRadius") as never),
    listRiskSignals: over.listRiskSignals ?? (notImpl("listRiskSignals") as never),
  };
}

describe("tool registry", () => {
  it("exposes exactly the five Identograph tools with unique names", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      "check_agent_scope",
      "get_blast_radius",
      "get_risk_signals",
      "query_identity",
      "traverse_access_lineage",
    ]);
  });

  it("every tool has a description and a usable Zod object schema", () => {
    for (const t of TOOLS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.shape).toBeTypeOf("object");
    }
  });
});

describe("query_identity", () => {
  it("looks up by id", async () => {
    const port = mockPort({
      getIdentityById: async (t, id) => {
        expect([t, id]).toEqual(["t1", "id-1"]);
        return identity({ nodeType: "AgentIdentity", riskScore: 0.9 });
      },
    });
    const out = await tool("query_identity").handler(port, { tenantId: "t1", id: "id-1" });
    expect(out.summary).toContain("AgentIdentity");
    expect((out.data as { identity: IdentityRecord }).identity.riskScore).toBe(0.9);
  });

  it("looks up by attribute", async () => {
    const port = mockPort({
      findIdentitiesByAttribute: async (_t, attr, value) => {
        expect([attr, value]).toEqual(["email", "a@b.com"]);
        return [identity(), identity({ id: "id-2" })];
      },
    });
    const out = await tool("query_identity").handler(port, {
      tenantId: "t1",
      attribute: "email",
      value: "a@b.com",
    });
    expect(out.summary).toContain("Found 2 identities");
  });

  it("rejects when neither id nor attribute+value is given", async () => {
    await expect(tool("query_identity").handler(mockPort(), { tenantId: "t1" })).rejects.toThrow(
      /Provide either/,
    );
  });

  it("rejects an unknown attribute via schema validation", async () => {
    await expect(
      tool("query_identity").handler(mockPort(), {
        tenantId: "t1",
        attribute: "ssn",
        value: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("check_agent_scope", () => {
  const scope: AgentScopeSummary = {
    agentId: "a1",
    agentType: "ingest",
    model: "claude",
    declaredScope: { allowedOperations: ["read"] },
    totalEvents: 4,
    inScopeCount: 1,
    outOfScopeCount: 3,
    outOfScopeEvents: [],
    deviationScore: 0.75,
  };

  it("reports the deviation verdict", async () => {
    const port = mockPort({ agentScope: async () => scope });
    const out = await tool("check_agent_scope").handler(port, { tenantId: "t1", agentId: "a1" });
    expect(out.summary).toContain("3 of 4 action(s) out of scope");
    expect(out.data).toBe(scope);
  });

  it("reports in-scope agents", async () => {
    const port = mockPort({
      agentScope: async () => ({ ...scope, outOfScopeCount: 0, deviationScore: 0 }),
    });
    const out = await tool("check_agent_scope").handler(port, { tenantId: "t1", agentId: "a1" });
    expect(out.summary).toContain("within declared scope");
  });
});

describe("get_risk_signals", () => {
  const signals: RiskSignalRecord[] = [
    { id: "s1", subjectRef: "id-1", subjectType: "NHIdentity", caepEventType: "risk-level-change", eventTypeUri: "u", score: 0.9, severity: "critical", iat: "t" },
    { id: "s2", subjectRef: "id-1", subjectType: "NHIdentity", caepEventType: "risk-level-change", eventTypeUri: "u", score: 0.3, severity: "info", iat: "t" },
  ];

  it("returns all signals by default", async () => {
    const port = mockPort({ listRiskSignals: async () => signals });
    const out = await tool("get_risk_signals").handler(port, { tenantId: "t1", subjectRef: "id-1" });
    expect((out.data as { signals: RiskSignalRecord[] }).signals).toHaveLength(2);
  });

  it("filters by minScore", async () => {
    const port = mockPort({ listRiskSignals: async () => signals });
    const out = await tool("get_risk_signals").handler(port, {
      tenantId: "t1",
      subjectRef: "id-1",
      minScore: 0.5,
    });
    const returned = (out.data as { signals: RiskSignalRecord[] }).signals;
    expect(returned).toHaveLength(1);
    expect(returned[0]?.id).toBe("s1");
  });
});

describe("get_blast_radius", () => {
  it("summarizes reach", async () => {
    const blast: BlastRadiusSummary = {
      identityId: "id-1",
      identityType: "NHIdentity",
      totalResourceCount: 12,
      criticalResourceCount: 3,
      privilegedEntitlementCount: 4,
      totalIdentityCount: 2,
      blastRadiusScore: 0.66,
      reachableResources: [],
      reachableIdentities: [],
    };
    const port = mockPort({ blastRadius: async () => blast });
    const out = await tool("get_blast_radius").handler(port, { tenantId: "t1", identityId: "id-1" });
    expect(out.summary).toContain("12 resource(s) (3 critical)");
    expect(out.summary).toContain("score 0.66");
  });
});

describe("traverse_access_lineage", () => {
  it("returns the lineage paths", async () => {
    const port = mockPort({ accessLineage: async () => [{ hop: 1 }, { hop: 2 }] });
    const out = await tool("traverse_access_lineage").handler(port, {
      tenantId: "t1",
      identityId: "id-1",
    });
    expect(out.summary).toContain("2 path(s)");
  });
});

describe("input schema validation", () => {
  it("rejects a missing tenantId across tools", async () => {
    await expect(
      tool("get_blast_radius").handler(mockPort(), { identityId: "id-1" }),
    ).rejects.toThrow();
  });
});
