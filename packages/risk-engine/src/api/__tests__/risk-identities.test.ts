import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { getRiskIdentities } from "../risk-identities.js";

describe("getRiskIdentities", () => {
  it("returns risky identities sorted by score, each with its signals", async () => {
    const client = new MockGraphClient([
      { match: "FROM HumanIdentity", rows: [{ id: "h1", nodeType: "HumanIdentity", riskScore: 0.3, status: "Active" }] },
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity", riskScore: 0.8, status: "Active" }] },
      {
        match: (sql) => sql.includes("FROM RiskSignal") && sql.includes("a1"),
        rows: [
          {
            id: "sig-1",
            caepEventType: "risk-level-change",
            score: 0.8,
            severity: "critical",
            iat: "2026-07-04T00:00:00Z",
            resolvedAt: null,
            eventPayload: { scorer: "agent-scope-deviation", rationale: "out of scope" },
          },
        ],
      },
      { match: "FROM RiskSignal", rows: [] },
    ]);

    const results = await getRiskIdentities(client, "t1", { threshold: 0.2 });

    expect(results.map((r) => r.identityId)).toEqual(["a1", "h1"]);
    const agent = results[0]!;
    expect(agent.riskScore).toBe(0.8);
    expect(agent.signalCount).toBe(1);
    expect(agent.highestSeverity).toBe("critical");
    expect(agent.signals[0]?.scorer).toBe("agent-scope-deviation");
    expect(agent.signals[0]?.rationale).toBe("out of scope");
  });

  it("parses a JSON-string eventPayload from ArcadeDB", async () => {
    const client = new MockGraphClient([
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity", riskScore: 0.9, status: "Active" }] },
      {
        match: "FROM RiskSignal",
        rows: [
          {
            id: "sig-1",
            caepEventType: "risk-level-change",
            score: 0.9,
            severity: "critical",
            iat: "2026-07-04T00:00:00Z",
            resolvedAt: null,
            eventPayload: JSON.stringify({ scorer: "blast-radius", rationale: "wide reach" }),
          },
        ],
      },
    ]);
    const results = await getRiskIdentities(client, "t1");
    expect(results[0]?.signals[0]?.scorer).toBe("blast-radius");
    expect(results[0]?.signals[0]?.rationale).toBe("wide reach");
  });

  it("honors the limit option", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM NHIdentity",
        rows: [
          { id: "n1", nodeType: "NHIdentity", riskScore: 0.9, status: "Active" },
          { id: "n2", nodeType: "NHIdentity", riskScore: 0.7, status: "Active" },
        ],
      },
      { match: "FROM RiskSignal", rows: [] },
    ]);
    const results = await getRiskIdentities(client, "t1", { limit: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.identityId).toBe("n1");
  });
});
