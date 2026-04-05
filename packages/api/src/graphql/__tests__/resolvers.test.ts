import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArcadeClient } from "../../db/client.js";
import { makeResolvers } from "../resolvers/identity.js";

function makeMockDb(queryResult: unknown[] = []): ArcadeClient {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
    escape: (v: string) => `'${v}'`,
  } as unknown as ArcadeClient;
}

describe("Resolvers", () => {
  // -------------------------------------------------------------------------
  // humans
  // -------------------------------------------------------------------------

  describe("humans()", () => {
    it("returns the query result array", async () => {
      const rows = [{ id: "1", name: "Alice", nodeType: "HumanIdentity" }];
      const db = makeMockDb(rows);
      const resolvers = makeResolvers(db);
      const result = await resolvers.Query.humans(undefined, {});
      expect(result).toEqual(rows);
    });

    it("passes limit and offset to the query", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.humans(undefined, { limit: 10, offset: 20 });
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("LIMIT 10");
      expect(call).toContain("OFFSET 20");
    });

    it("filters by status when provided", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.humans(undefined, { status: "Active" });
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("status");
      expect(call).toContain("Active");
    });

    it("filters by department when provided", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.humans(undefined, { department: "Engineering" });
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("Engineering");
    });

    it("caps limit at 500", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.humans(undefined, { limit: 9999 });
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("LIMIT 500");
    });
  });

  // -------------------------------------------------------------------------
  // human (single)
  // -------------------------------------------------------------------------

  describe("human()", () => {
    it("returns the first result", async () => {
      const row = { id: "abc", name: "Bob", nodeType: "HumanIdentity" };
      const db = makeMockDb([row]);
      const resolvers = makeResolvers(db);
      const result = await resolvers.Query.human(undefined, { id: "abc" });
      expect(result).toEqual(row);
    });

    it("returns null when not found", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      const result = await resolvers.Query.human(undefined, { id: "missing" });
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // serviceAccounts
  // -------------------------------------------------------------------------

  describe("serviceAccounts()", () => {
    it("queries the ServiceAccount type", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.serviceAccounts(undefined, {});
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("ServiceAccount");
    });
  });

  // -------------------------------------------------------------------------
  // highRiskIdentities
  // -------------------------------------------------------------------------

  describe("highRiskIdentities()", () => {
    it("uses default minRiskScore of 0.7", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.highRiskIdentities(undefined, {});
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("0.7");
    });

    it("uses the provided minRiskScore", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.highRiskIdentities(undefined, { minRiskScore: 0.9 });
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("0.9");
    });

    it("filters to a single nodeType when specified", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.highRiskIdentities(undefined, { nodeType: "ServiceAccount" });
      // Should only query one type
      expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(call).toContain("ServiceAccount");
    });
  });

  // -------------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------------

  describe("stats()", () => {
    it("queries 8 node types (one count per type)", async () => {
      const db = makeMockDb([{ count: 10 }]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.stats(undefined, {});
      // One count query per node type: human, SA, agent, app, resource, role, group, orgunit
      expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(8);
    });

    it("returns correct count values", async () => {
      let callIndex = 0;
      const counts = [500, 200, 50, 12, 15, 120, 8, 10];
      const db = {
        query: vi.fn().mockImplementation(() =>
          Promise.resolve([{ count: counts[callIndex++] }]),
        ),
        escape: (v: string) => `'${v}'`,
      } as unknown as ArcadeClient;

      const resolvers = makeResolvers(db);
      const result = await resolvers.Query.stats(undefined, { tenantId: "prism-dev" });

      expect(result.humanCount).toBe(500);
      expect(result.serviceAccountCount).toBe(200);
      expect(result.agentCount).toBe(50);
      expect(result.applicationCount).toBe(12);
      expect(result.resourceCount).toBe(15);
      expect(result.roleCount).toBe(120);
      expect(result.groupCount).toBe(8);
      expect(result.orgUnitCount).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // searchIdentities
  // -------------------------------------------------------------------------

  describe("searchIdentities()", () => {
    it("performs LIKE searches across multiple types", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.searchIdentities(undefined, { query: "alice" });
      // Multiple calls - one per searchable type/field combo
      expect((db.query as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    });

    it("includes the search term in SQL", async () => {
      const db = makeMockDb([]);
      const resolvers = makeResolvers(db);
      await resolvers.Query.searchIdentities(undefined, { query: "alice" });
      const firstCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(firstCall).toContain("alice");
      expect(firstCall).toContain("LIKE");
    });
  });

  // -------------------------------------------------------------------------
  // AnyNode / IdentityNode __resolveType
  // -------------------------------------------------------------------------

  describe("AnyNode.__resolveType()", () => {
    it("returns the nodeType field value", () => {
      const resolvers = makeResolvers(makeMockDb());
      expect(resolvers.AnyNode.__resolveType({ nodeType: "HumanIdentity" })).toBe("HumanIdentity");
      expect(resolvers.AnyNode.__resolveType({ nodeType: "ServiceAccount" })).toBe("ServiceAccount");
    });

    it("returns null when nodeType is absent", () => {
      const resolvers = makeResolvers(makeMockDb());
      expect(resolvers.AnyNode.__resolveType({})).toBeNull();
    });
  });
});
