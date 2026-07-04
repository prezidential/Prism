import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { blastRadiusScorer } from "../blast-radius.js";

function entGrant(identityId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identityId,
    identityType: "NHIdentity",
    lastActivity: null,
    entitlementId: "e",
    entitlementName: "e",
    isPrivileged: true,
    riskWeight: 0.5,
    ...over,
  };
}

describe("blastRadiusScorer", () => {
  it("returns no findings on an empty graph", async () => {
    const client = new MockGraphClient([]);
    const findings = await blastRadiusScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("scores an identity by reachable resources, privilege, and downstream fan-out", async () => {
    const client = new MockGraphClient([
      {
        match: "HAS_ENTITLEMENT",
        rows: [
          entGrant("nhi-1", { entitlementId: "e1", isPrivileged: true }),
          entGrant("nhi-1", { entitlementId: "e2", isPrivileged: true }),
        ],
      },
      { match: "HAS_ACCESS", rows: [{ identityId: "nhi-1", identityType: "NHIdentity" }] },
      { match: "FROM Delegation", rows: [{ fromRef: "nhi-1" }] },
      { match: "SPAWNED", rows: [{ fromRef: "nhi-1" }] },
    ]);
    const findings = await blastRadiusScorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.identityId).toBe("nhi-1");
    expect(f.evidence["reachableResources"]).toBe(3); // 2 entitlements + 1 direct
    expect(f.evidence["privilegedResources"]).toBe(2);
    expect(f.evidence["downstreamIdentities"]).toBe(2); // 1 delegation + 1 spawned
    expect(f.score).toBeGreaterThan(0);
  });

  it("counts downstream fan-out even without entitlements", async () => {
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [] },
      { match: "HAS_ACCESS", rows: [] },
      { match: "FROM Delegation", rows: [{ fromRef: "hub" }, { fromRef: "hub" }] },
      { match: "SPAWNED", rows: [] },
    ]);
    const findings = await blastRadiusScorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.identityId).toBe("hub");
    expect(findings[0]?.evidence["downstreamIdentities"]).toBe(2);
  });
});
