import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdentographClient } from "../client.js";

function mockFetch(result: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => JSON.stringify(result),
    json: async () => result,
  });
}

const TEST_CONFIG = {
  url: "http://localhost:2480",
  database: "idem",
  user: "root",
  password: "secret",
};

describe("IdentographClient", () => {
  let client: IdentographClient;

  beforeEach(() => {
    client = new IdentographClient(TEST_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createHumanIdentity()", () => {
    it("inserts a HumanIdentity vertex and returns it", async () => {
      const record = { id: "h-1", name: "Alice", nodeType: "HumanIdentity" };
      vi.stubGlobal("fetch", mockFetch({ result: [record] }));

      const result = await client.createHumanIdentity(record as Parameters<typeof client.createHumanIdentity>[0]);
      expect(result.id).toBe("h-1");
    });
  });

  describe("getHumanIdentity()", () => {
    it("returns the identity when found", async () => {
      const record = { id: "h-1", name: "Alice" };
      vi.stubGlobal("fetch", mockFetch({ result: [record] }));

      const result = await client.getHumanIdentity("tenant", "h-1");
      expect(result).toEqual(record);
    });

    it("returns null when not found", async () => {
      vi.stubGlobal("fetch", mockFetch({ result: [] }));
      const result = await client.getHumanIdentity("tenant", "missing");
      expect(result).toBeNull();
    });
  });

  describe("createNHIdentity()", () => {
    it("inserts a NHIdentity vertex", async () => {
      const record = { id: "nh-1", kind: "IAMUser", nodeType: "NHIdentity" };
      vi.stubGlobal("fetch", mockFetch({ result: [record] }));

      const result = await client.createNHIdentity(record as Parameters<typeof client.createNHIdentity>[0]);
      expect(result.id).toBe("nh-1");
    });
  });

  describe("createRiskSignal()", () => {
    it("inserts a RiskSignal vertex", async () => {
      const record = { id: "rs-1", jti: "jwt-id-1", score: 0.85, caepEventType: "credential-change" };
      vi.stubGlobal("fetch", mockFetch({ result: [record] }));

      const result = await client.createRiskSignal(record as Parameters<typeof client.createRiskSignal>[0]);
      expect(result.id).toBe("rs-1");
    });
  });

  describe("listActiveSessions()", () => {
    it("queries for Active sessions only", async () => {
      const mockFetchFn = mockFetch({ result: [] });
      vi.stubGlobal("fetch", mockFetchFn);

      await client.listActiveSessions("tenant-1");

      const [, init] = mockFetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { command: string };
      expect(body.command).toContain("state = 'Active'");
    });
  });

  describe("listOutOfScopeEvents()", () => {
    it("queries for withinDeclaredScope = false", async () => {
      const mockFetchFn = mockFetch({ result: [] });
      vi.stubGlobal("fetch", mockFetchFn);

      await client.listOutOfScopeEvents("tenant-1");

      const [, init] = mockFetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { command: string };
      expect(body.command).toContain("withinDeclaredScope = false");
    });
  });

  describe("upsertVertex()", () => {
    it("calls INSERT when vertex does not exist", async () => {
      const mockFetchFn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [] }), text: async () => "" })  // SELECT → not found
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [{ id: "x" }] }), text: async () => "" }); // INSERT
      vi.stubGlobal("fetch", mockFetchFn);

      const result = await client.upsertVertex<{ id: string }>("HumanIdentity", "t1", "x", { name: "X" });
      expect(result.id).toBe("x");
      expect(mockFetchFn).toHaveBeenCalledTimes(2);
    });

    it("calls UPDATE when vertex already exists", async () => {
      const existingRecord = { id: "x", name: "Old" };
      const updatedRecord = { id: "x", name: "New" };
      const mockFetchFn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [existingRecord] }), text: async () => "" }) // SELECT → found
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [updatedRecord] }), text: async () => "" }); // UPDATE
      vi.stubGlobal("fetch", mockFetchFn);

      const result = await client.upsertVertex<{ id: string; name: string }>("HumanIdentity", "t1", "x", { name: "New" });
      expect(result.name).toBe("New");
    });
  });
});
