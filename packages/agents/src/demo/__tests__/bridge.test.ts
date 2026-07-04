import { describe, expect, it, vi } from "vitest";
import type { GraphWriter } from "../../ingest/graph-ops.js";
import { DemoBridge, mapDemoState, type DemoSeedState } from "../bridge.js";

const NOW = "2026-07-04T00:00:00Z";

const state: DemoSeedState = {
  aws: {
    iamUsers: [
      {
        seedId: "seed-nhi-1",
        userName: "ci-deployer",
        attachedPolicies: [{ policyName: "AdministratorAccess", policyArn: "arn:aws:iam::aws:policy/AdministratorAccess" }],
      },
    ],
    iamRoles: [{ seedId: "seed-role-1", roleName: "lambda-exec" }],
  },
  okta: {
    groups: [{ seedId: "seed-grp-1", name: "Engineering" }],
    users: [
      { seedId: "seed-hum-1", email: "a@corp.com", firstName: "Ada", lastName: "Lovelace", department: "Eng", groupSeedIds: ["seed-grp-1"] },
    ],
  },
};

function mockWriter(): GraphWriter & { upsertEdge: ReturnType<typeof vi.fn> } {
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

describe("mapDemoState", () => {
  it("anchors every vertex on its seedId", () => {
    const g = mapDemoState(state, "t1", NOW);
    const ids = g.vertices.map((v) => v.externalId).sort();
    expect(ids).toContain("seed-nhi-1");
    expect(ids).toContain("seed-role-1");
    expect(ids).toContain("seed-grp-1");
    expect(ids).toContain("seed-hum-1");
    // externalIdField is "id" so seedId becomes the graph id
    expect(g.vertices.every((v) => v.externalIdField === "id")).toBe(true);
  });

  it("maps Okta users to HumanIdentity with a MEMBER_OF edge to their group", () => {
    const g = mapDemoState(state, "t1", NOW);
    const human = g.vertices.find((v) => v.type === "HumanIdentity");
    expect(human?.props["email"]).toBe("a@corp.com");
    const memberEdge = g.edges.find((e) => e.edgeType === "MEMBER_OF");
    expect(memberEdge).toMatchObject({ fromExternalId: "seed-hum-1", toExternalId: "seed-grp-1" });
  });
});

describe("DemoBridge", () => {
  it("reads injected state and seeds the graph", async () => {
    const writer = mockWriter();
    const bridge = new DemoBridge({
      writer,
      tenantId: "t1",
      now: () => NOW,
      readState: async () => state,
    });
    const summary = await bridge.run();
    // 2 NHIdentity + 1 Entitlement + 1 Group + 1 HumanIdentity = 5 vertices
    expect(summary.verticesUpserted).toBe(5);
    // HAS_ENTITLEMENT (deployer->admin) + MEMBER_OF (ada->eng) = 2 edges
    expect(summary.edgesUpserted).toBe(2);
    expect(summary.deadLettered).toBe(0);
  });

  it("is idempotent on re-run", async () => {
    const writer = mockWriter();
    const bridge = new DemoBridge({ writer, tenantId: "t1", now: () => NOW, readState: async () => state });
    await bridge.run();
    const second = await bridge.run();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(5);
  });
});
