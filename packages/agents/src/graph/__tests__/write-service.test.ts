import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArcadeGraphWriteService } from "../write-service.js";

const mockConfig = {
  url: "http://localhost:2480",
  db: "prism",
  user: "root",
  pass: "secret",
};

function makeService(): ArcadeGraphWriteService {
  return new ArcadeGraphWriteService(mockConfig);
}

function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "arcadedb-session-id": "test-session-123" }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function makeCommandResponse(result: Array<Record<string, unknown>>): unknown {
  return { result };
}

describe("ArcadeGraphWriteService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("findByExternalId", () => {
    it("returns null when not found", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse(makeCommandResponse([])),
      );
      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      const result = await service.findByExternalId(
        "HumanIdentity",
        "tenant-1",
        "externalIds.okta",
        "okta-user-123",
      );

      expect(result).toBeNull();
    });

    it("returns { id } when found", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse(makeCommandResponse([{ id: "#1:0" }])),
      );
      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      const result = await service.findByExternalId(
        "HumanIdentity",
        "tenant-1",
        "externalIds.okta",
        "okta-user-123",
      );

      expect(result).toEqual({ id: "#1:0" });
    });

    it("constructs correct SQL with tenant and externalId filters", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse(makeCommandResponse([])),
      );
      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      await service.findByExternalId(
        "HumanIdentity",
        "my-tenant",
        "externalIds.okta",
        "user-abc",
      );

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1]?.body as string) as { command: string };
      expect(body.command).toContain("FROM HumanIdentity");
      expect(body.command).toContain("tenantId = 'my-tenant'");
      expect(body.command).toContain("externalIds.okta = 'user-abc'");
    });
  });

  describe("upsertVertex", () => {
    it("creates a new node when not found", async () => {
      const mockFetch = vi.fn()
        // beginTransaction
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "arcadedb-session-id": "sess-1" }),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response)
        // SELECT - not found
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([])))
        // INSERT
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([{ id: "#2:1" }])))
        // COMMIT
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response);

      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      const result = await service.upsertVertex(
        "HumanIdentity",
        "tenant-1",
        "okta-123",
        "externalIds.okta",
        { email: "test@example.com", firstName: "Test" },
      );

      expect(result.created).toBe(true);
      expect(result.nodeId).toBe("#2:1");
    });

    it("updates existing node when found", async () => {
      const mockFetch = vi.fn()
        // beginTransaction
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "arcadedb-session-id": "sess-2" }),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response)
        // SELECT - found
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([{ id: "#1:0" }])))
        // UPDATE
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([{ count: 1 }])))
        // COMMIT
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response);

      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      const result = await service.upsertVertex(
        "HumanIdentity",
        "tenant-1",
        "okta-123",
        "externalIds.okta",
        { email: "updated@example.com" },
      );

      expect(result.created).toBe(false);
      expect(result.nodeId).toBe("#1:0");

      // Verify UPDATE was called
      const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
      const updateCall = calls.find((call) => {
        const body = call[1]?.body;
        if (typeof body !== "string") return false;
        const parsed = JSON.parse(body) as { command: string };
        return parsed.command?.startsWith("UPDATE");
      });
      expect(updateCall).toBeDefined();
    });

    it("rolls back on error", async () => {
      const mockFetch = vi.fn()
        // beginTransaction
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "arcadedb-session-id": "sess-err" }),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response)
        // SELECT - throws error
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("Internal error"),
        } as unknown as Response)
        // ROLLBACK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as unknown as Response);

      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      await expect(
        service.upsertVertex("HumanIdentity", "tenant-1", "okta-err", "externalIds.okta", {}),
      ).rejects.toThrow();

      // Verify rollback was called
      const calls = mockFetch.mock.calls as Array<[string, unknown]>;
      const rollbackCall = calls.find((call) => {
        const url = call[0];
        return typeof url === "string" && url.includes("/rollback/");
      });
      expect(rollbackCall).toBeDefined();
    });
  });

  describe("upsertEdge", () => {
    it("constructs CREATE EDGE SQL when edge does not exist", async () => {
      const mockFetch = vi.fn()
        // SELECT check - not found
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([])))
        // CREATE EDGE
        .mockResolvedValueOnce(mockFetchResponse(makeCommandResponse([{ "@rid": "#3:1" }])));

      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      await service.upsertEdge(
        "HAS_ACCESS",
        "HumanIdentity",
        "#1:0",
        "Resource",
        "#2:0",
        { level: "read" },
        "tenant-1",
      );

      const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
      const createEdgeCall = calls.find((call) => {
        const body = call[1]?.body;
        if (typeof body !== "string") return false;
        const parsed = JSON.parse(body) as { command: string };
        return parsed.command?.startsWith("CREATE EDGE");
      });
      expect(createEdgeCall).toBeDefined();
      const body = JSON.parse(createEdgeCall?.[1]?.body as string) as { command: string };
      expect(body.command).toContain("HAS_ACCESS");
      expect(body.command).toContain("#1:0");
      expect(body.command).toContain("#2:0");
    });

    it("skips creation when edge already exists", async () => {
      const mockFetch = vi.fn()
        // SELECT check - found
        .mockResolvedValueOnce(
          mockFetchResponse(makeCommandResponse([{ "@rid": "#3:0" }])),
        );

      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      await service.upsertEdge(
        "HAS_ACCESS",
        "HumanIdentity",
        "#1:0",
        "Resource",
        "#2:0",
        {},
        "tenant-1",
      );

      // Only one fetch call (the check), no CREATE EDGE
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("SQL escaping", () => {
    it("escapes single quotes in string values", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse(makeCommandResponse([])),
      );
      vi.stubGlobal("fetch", mockFetch);

      const service = makeService();
      await service.findByExternalId(
        "HumanIdentity",
        "tenant's-corp",
        "externalIds.okta",
        "user-o'malley",
      );

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1]?.body as string) as { command: string };
      expect(body.command).toContain("tenant\\'s-corp");
      expect(body.command).toContain("user-o\\'malley");
    });
  });
});
