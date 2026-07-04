import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { entitlementOverlapScorer } from "../entitlement-overlap.js";

function grant(identityId: string, entitlementId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identityId,
    identityType: "HumanIdentity",
    lastActivity: null,
    entitlementId,
    entitlementName: entitlementId,
    isPrivileged: true,
    riskWeight: 1.0,
    ...over,
  };
}

describe("entitlementOverlapScorer", () => {
  it("does not flag a privileged entitlement held by only one identity", async () => {
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [grant("u1", "admin")] },
    ]);
    const findings = await entitlementOverlapScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("ignores shared non-privileged entitlements", async () => {
    const client = new MockGraphClient([
      {
        match: "HAS_ENTITLEMENT",
        rows: [grant("u1", "read", { isPrivileged: false }), grant("u2", "read", { isPrivileged: false })],
      },
    ]);
    const findings = await entitlementOverlapScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("flags both identities that share a privileged entitlement", async () => {
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [grant("u1", "admin"), grant("u2", "admin")] },
    ]);
    const findings = await entitlementOverlapScorer.score(client, "t1");
    expect(findings).toHaveLength(2);
    const ids = findings.map((f) => f.identityId).sort();
    expect(ids).toEqual(["u1", "u2"]);
    for (const f of findings) {
      expect(f.evidence["coHolderCount"]).toBe(1);
      expect(f.scorer).toBe("entitlement-overlap");
    }
  });

  it("does not treat a double-granted single identity as an overlap", async () => {
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [grant("u1", "admin"), grant("u1", "admin")] },
    ]);
    const findings = await entitlementOverlapScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });
});
