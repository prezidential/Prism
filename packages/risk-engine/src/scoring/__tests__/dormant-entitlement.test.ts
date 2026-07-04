import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { createDormantEntitlementScorer } from "../dormant-entitlement.js";

const NOW = "2026-07-04T00:00:00.000Z";

function grantRow(over: Record<string, unknown>): Record<string, unknown> {
  return {
    identityId: "nhi-1",
    identityType: "NHIdentity",
    lastActivity: NOW,
    entitlementId: "ent-1",
    entitlementName: "AdminAccess",
    isPrivileged: true,
    riskWeight: 0.8,
    ...over,
  };
}

describe("dormant-entitlement scorer", () => {
  it("does not flag recently-active identities", async () => {
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [grantRow({ lastActivity: "2026-06-20T00:00:00.000Z" })] },
    ]);
    const scorer = createDormantEntitlementScorer({ now: NOW });
    const findings = await scorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("does not flag non-privileged dormant identities", async () => {
    const client = new MockGraphClient([
      {
        match: "HAS_ENTITLEMENT",
        rows: [grantRow({ isPrivileged: false, lastActivity: "2025-01-01T00:00:00.000Z" })],
      },
    ]);
    const scorer = createDormantEntitlementScorer({ now: NOW });
    const findings = await scorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("flags a long-dormant privileged identity with high score", async () => {
    // ~365 days dormant, well past MAX_DORMANT_DAYS
    const client = new MockGraphClient([
      { match: "HAS_ENTITLEMENT", rows: [grantRow({ lastActivity: "2025-07-04T00:00:00.000Z" })] },
    ]);
    const scorer = createDormantEntitlementScorer({ now: NOW });
    const findings = await scorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.scorer).toBe("dormant-entitlement");
    expect(findings[0]?.score).toBeGreaterThanOrEqual(0.75);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.evidence["privilegedCount"]).toBe(1);
  });

  it("aggregates multiple grants per identity", async () => {
    const client = new MockGraphClient([
      {
        match: "HAS_ENTITLEMENT",
        rows: [
          grantRow({ entitlementId: "e1", lastActivity: "2025-07-04T00:00:00.000Z" }),
          grantRow({ entitlementId: "e2", isPrivileged: false, lastActivity: "2025-07-04T00:00:00.000Z" }),
        ],
      },
    ]);
    const scorer = createDormantEntitlementScorer({ now: NOW });
    const findings = await scorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence["privilegedCount"]).toBe(1);
    expect(findings[0]?.evidence["totalEntitlements"]).toBe(2);
  });
});
