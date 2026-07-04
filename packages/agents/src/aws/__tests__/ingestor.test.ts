import { describe, expect, it, vi } from "vitest";
import { AwsIamIngestor } from "../ingestor.js";
import { isPrivilegedPolicy, mapIamSnapshot, type IamSnapshot } from "../mapper.js";
import type { GraphWriter } from "../../ingest/graph-ops.js";

const NOW = "2026-07-04T00:00:00Z";

const snapshot: IamSnapshot = {
  users: [
    {
      user: { userName: "deploy-bot", userId: "AID1", arn: "arn:aws:iam::1:user/deploy-bot", createDate: "2025-01-01" },
      accessKeys: [{ accessKeyId: "AK1", status: "Active", createDate: "2025-01-01", lastUsedDate: "2026-06-01" }],
      attachedPolicies: [{ policyName: "AdministratorAccess", policyArn: "arn:aws:iam::aws:policy/AdministratorAccess" }],
    },
  ],
  roles: [
    {
      role: { roleName: "readonly", roleId: "AR1", arn: "arn:aws:iam::1:role/readonly", createDate: "2025-02-01" },
      attachedPolicies: [{ policyName: "ReadOnlyAccess", policyArn: "arn:aws:iam::aws:policy/ReadOnlyAccess" }],
    },
  ],
};

describe("mapIamSnapshot", () => {
  it("maps users and roles to NHIdentity and policies to Entitlement", () => {
    const g = mapIamSnapshot(snapshot, "t1", NOW);
    const nhi = g.vertices.filter((v) => v.type === "NHIdentity");
    const ents = g.vertices.filter((v) => v.type === "Entitlement");
    expect(nhi).toHaveLength(2);
    expect(ents).toHaveLength(2);
    expect(g.edges).toHaveLength(2);
    expect(g.edges.every((e) => e.edgeType === "HAS_ENTITLEMENT")).toBe(true);
  });

  it("flags privileged policies", () => {
    expect(isPrivilegedPolicy({ policyName: "AdministratorAccess", policyArn: "x" })).toBe(true);
    expect(isPrivilegedPolicy({ policyName: "ReadOnlyAccess", policyArn: "arn:...ReadOnlyAccess" })).toBe(false);
    const g = mapIamSnapshot(snapshot, "t1", NOW);
    const admin = g.vertices.find((v) => v.externalId.endsWith("AdministratorAccess"));
    expect(admin?.props["isPrivileged"]).toBe(true);
    expect(admin?.props["riskWeight"]).toBe(0.8);
  });

  it("de-duplicates a policy shared across principals", () => {
    const shared: IamSnapshot = {
      users: [
        { user: { userName: "a", userId: "1", arn: "arn:a", createDate: NOW }, accessKeys: [], attachedPolicies: [{ policyName: "P", policyArn: "arn:p" }] },
        { user: { userName: "b", userId: "2", arn: "arn:b", createDate: NOW }, accessKeys: [], attachedPolicies: [{ policyName: "P", policyArn: "arn:p" }] },
      ],
      roles: [],
    };
    const g = mapIamSnapshot(shared, "t1", NOW);
    expect(g.vertices.filter((v) => v.type === "Entitlement")).toHaveLength(1);
    expect(g.edges).toHaveLength(2); // both principals still linked
  });
});

function mockWriter(): GraphWriter {
  const seen = new Set<string>();
  return {
    upsertVertex: vi.fn(async (_type, _t, externalId: string) => {
      const created = !seen.has(externalId);
      seen.add(externalId);
      return { nodeId: `#12:${externalId}`, created };
    }),
    upsertEdge: vi.fn(async () => undefined),
  };
}

describe("AwsIamIngestor", () => {
  it("fetches, maps, and upserts a snapshot", async () => {
    const writer = mockWriter();
    const ingestor = new AwsIamIngestor({
      source: { fetchSnapshot: async () => snapshot },
      writer,
      tenantId: "t1",
      now: () => NOW,
    });
    const summary = await ingestor.run();
    expect(summary.created).toBe(4); // 2 NHIdentity + 2 Entitlement
    expect(summary.edgesUpserted).toBe(2);
    expect(summary.deadLettered).toBe(0);
  });
});
