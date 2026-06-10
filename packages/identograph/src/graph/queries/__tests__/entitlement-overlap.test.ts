import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeClient } from "../../../db/client.js";
import { queryEntitlementOverlap } from "../entitlement-overlap.js";

const CONFIG = { url: "http://localhost:2480", database: "idem", user: "root", password: "secret" };

function mockFetch(result: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ result }),
    text: async () => JSON.stringify({ result }),
  });
}

describe("queryEntitlementOverlap()", () => {
  let client: ArcadeClient;

  beforeEach(() => {
    client = new ArcadeClient(CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects overlap between two identities sharing a privileged entitlement", async () => {
    const grants = [
      {
        identityId: "h-1", identityType: "HumanIdentity",
        entitlementId: "ent-admin", entitlementName: "DatabaseAdmin",
        entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.9,
      },
      {
        identityId: "h-2", identityType: "HumanIdentity",
        entitlementId: "ent-admin", entitlementName: "DatabaseAdmin",
        entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.9,
      },
    ];
    vi.stubGlobal("fetch", mockFetch(grants));

    const results = await queryEntitlementOverlap(client, "t1");

    expect(results).toHaveLength(1);
    expect(results[0]?.overlapCount).toBe(1);
    expect(results[0]?.isSoDViolation).toBe(true);
    expect(results[0]?.combinedRiskWeight).toBe(0.9);
    // Identities should be in stable sorted order
    const ids = [results[0]?.identityA.identityId, results[0]?.identityB.identityId].sort();
    expect(ids).toEqual(["h-1", "h-2"].sort());
  });

  it("does not flag overlap for non-privileged entitlements when privilegedOnly = true", async () => {
    const grants = [
      {
        identityId: "h-1", identityType: "HumanIdentity",
        entitlementId: "ent-readonly", entitlementName: "S3ReadOnly",
        entitlementType: "iam-policy", isPrivileged: false, riskWeight: 0.1,
      },
      {
        identityId: "h-2", identityType: "HumanIdentity",
        entitlementId: "ent-readonly", entitlementName: "S3ReadOnly",
        entitlementType: "iam-policy", isPrivileged: false, riskWeight: 0.1,
      },
    ];
    vi.stubGlobal("fetch", mockFetch(grants));

    const results = await queryEntitlementOverlap(client, "t1");

    expect(results).toHaveLength(1);
    expect(results[0]?.isSoDViolation).toBe(false);
  });

  it("returns empty array when no identities share entitlements", async () => {
    const grants = [
      {
        identityId: "h-1", identityType: "HumanIdentity",
        entitlementId: "ent-a", entitlementName: "EntA",
        entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.5,
      },
      {
        identityId: "h-2", identityType: "HumanIdentity",
        entitlementId: "ent-b", entitlementName: "EntB",
        entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.5,
      },
    ];
    vi.stubGlobal("fetch", mockFetch(grants));

    const results = await queryEntitlementOverlap(client, "t1");
    expect(results).toHaveLength(0);
  });

  it("sorts results by combinedRiskWeight descending", async () => {
    const grants = [
      // low-risk overlap between h-1 and h-2
      { identityId: "h-1", identityType: "HumanIdentity", entitlementId: "ent-low", entitlementName: "Low", entitlementType: "scope", isPrivileged: false, riskWeight: 0.1 },
      { identityId: "h-2", identityType: "HumanIdentity", entitlementId: "ent-low", entitlementName: "Low", entitlementType: "scope", isPrivileged: false, riskWeight: 0.1 },
      // high-risk overlap between h-3 and h-4
      { identityId: "h-3", identityType: "HumanIdentity", entitlementId: "ent-high", entitlementName: "High", entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.9 },
      { identityId: "h-4", identityType: "HumanIdentity", entitlementId: "ent-high", entitlementName: "High", entitlementType: "iam-policy", isPrivileged: true, riskWeight: 0.9 },
    ];
    vi.stubGlobal("fetch", mockFetch(grants));

    const results = await queryEntitlementOverlap(client, "t1");
    expect(results).toHaveLength(2);
    expect(results[0]?.combinedRiskWeight).toBeGreaterThan(results[1]?.combinedRiskWeight ?? 0);
  });
});
