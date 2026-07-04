import { describe, expect, it } from "vitest";
import { evaluateRisk } from "../evaluate.js";
import { MockGraphClient, testDeps } from "./mock-client.js";

const NOW = "2026-07-04T00:00:00.000Z";

// A red-team graph engineered so every scorer fires:
//   - agent-1 sits at the end of a depth-4 transitive delegation chain and
//     executed a successful out-of-scope action.
//   - nhi-1 is long-dormant, holds a privileged entitlement it shares with nhi-2
//     (SoD overlap), and fans out to a delegate (blast radius).
function redTeamGraph(): MockGraphClient {
  return new MockGraphClient([
    // delegation-depth scorer
    {
      match: /SELECT toIdentityRef, toIdentityType/,
      rows: [{ toIdentityRef: "agent-1", toIdentityType: "AgentIdentity", depth: 4, isTransitive: true }],
    },
    // entitlement grants (dormant, overlap, blast all read this)
    {
      match: "HAS_ENTITLEMENT",
      rows: [
        {
          identityId: "nhi-1",
          identityType: "NHIdentity",
          lastActivity: "2025-01-01T00:00:00.000Z",
          entitlementId: "admin",
          entitlementName: "AdminAccess",
          isPrivileged: true,
          riskWeight: 1.0,
        },
        {
          identityId: "nhi-2",
          identityType: "NHIdentity",
          lastActivity: NOW,
          entitlementId: "admin",
          entitlementName: "AdminAccess",
          isPrivileged: true,
          riskWeight: 1.0,
        },
      ],
    },
    // agent-scope-deviation scorer
    { match: "FROM AgentIdentity", rows: [{ id: "agent-1", nodeType: "AgentIdentity" }] },
    {
      match: "FROM ExecutionEvent",
      rows: [
        { withinDeclaredScope: false, outcome: "success" },
        { withinDeclaredScope: true, outcome: "success" },
      ],
    },
    // blast-radius: direct access + downstream
    { match: "HAS_ACCESS", rows: [] },
    { match: /fromIdentityRef AS fromRef/, rows: [{ fromRef: "nhi-1" }] },
    { match: "SPAWNED", rows: [] },
  ]);
}

describe("evaluateRisk", () => {
  it("runs all scorers, writes signals above threshold, and persists scores", async () => {
    const client = redTeamGraph();
    const result = await evaluateRisk(client, "t1", testDeps(), { signalThreshold: 0.4 });

    // delegation(1) + dormant(1) + agent-scope(1) + overlap(2) + blast(2)
    expect(result.findingCount).toBe(7);

    // Findings >= 0.4: delegation(1.0), dormant(1.0), agent-scope(0.5), overlap x2 (0.5)
    expect(result.signalsWritten).toBe(5);

    // One score persisted per flagged identity: agent-1, nhi-1, nhi-2
    expect(result.scoresPersisted).toBe(3);

    // Every scorer contributed at least one finding
    const scorers = new Set(result.profiles.flatMap((p) => p.findings.map((f) => f.scorer)));
    expect(scorers).toEqual(
      new Set([
        "delegation-depth",
        "dormant-entitlement",
        "agent-scope-deviation",
        "entitlement-overlap",
        "blast-radius",
      ]),
    );

    // agent-1 accumulates both delegation-depth and scope-deviation findings
    const agent = result.profiles.find((p) => p.identityId === "agent-1");
    expect(agent?.findings.map((f) => f.scorer).sort()).toEqual([
      "agent-scope-deviation",
      "delegation-depth",
    ]);

    // Signal INSERTs + score UPDATEs were issued
    expect(client.commands.filter((c) => c.startsWith("INSERT INTO RiskSignal"))).toHaveLength(5);
    expect(client.commands.filter((c) => c.startsWith("UPDATE"))).toHaveLength(3);
  });

  it("respects persistScores: false and a custom threshold", async () => {
    const client = redTeamGraph();
    const result = await evaluateRisk(client, "t1", testDeps(), {
      signalThreshold: 0.99,
      persistScores: false,
    });
    // Only the two 1.0 findings (delegation, dormant) clear a 0.99 threshold
    expect(result.signalsWritten).toBe(2);
    expect(result.scoresPersisted).toBe(0);
    expect(client.commands.some((c) => c.startsWith("UPDATE"))).toBe(false);
  });

  it("returns empty results on an empty graph", async () => {
    const client = new MockGraphClient([]);
    const result = await evaluateRisk(client, "t1", testDeps());
    expect(result.findingCount).toBe(0);
    expect(result.signalsWritten).toBe(0);
    expect(result.profiles).toHaveLength(0);
  });
});
