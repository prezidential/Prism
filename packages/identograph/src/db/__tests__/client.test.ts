import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeClient } from "../client.js";

const TEST_CONFIG = {
  url: "http://localhost:2480",
  database: "test-db",
  user: "root",
  password: "secret",
};

function makeMockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => JSON.stringify(response),
    json: async () => response,
  });
}

describe("ArcadeClient", () => {
  let client: ArcadeClient;

  beforeEach(() => {
    client = new ArcadeClient(TEST_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // query
  // -------------------------------------------------------------------------

  describe("query()", () => {
    it("returns the result array on success", async () => {
      const mockResult = [{ id: "1", name: "Alice" }];
      vi.stubGlobal("fetch", makeMockFetch({ result: mockResult }));

      const result = await client.query("SELECT * FROM HumanIdentity");
      expect(result).toEqual(mockResult);
    });

    it("sends correct headers and body", async () => {
      const mockFetch = makeMockFetch({ result: [] });
      vi.stubGlobal("fetch", mockFetch);

      await client.query("SELECT 1");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/v1/query/test-db");
      expect((init.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
      expect((init.headers as Record<string, string>)?.["Authorization"]).toMatch(/^Basic /);
      const body = JSON.parse(init.body as string) as { language: string; command: string };
      expect(body.language).toBe("sql");
      expect(body.command).toBe("SELECT 1");
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ error: "bad" }, false));
      await expect(client.query("SELECT * FROM Missing")).rejects.toThrow("ArcadeDB query failed");
    });

    it("returns an empty array when result is empty", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ result: [] }));
      const result = await client.query("SELECT * FROM Empty");
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // command
  // -------------------------------------------------------------------------

  describe("command()", () => {
    it("posts to the command endpoint", async () => {
      const mockFetch = makeMockFetch({ result: [] });
      vi.stubGlobal("fetch", mockFetch);

      await client.command("INSERT INTO Foo (id) VALUES ('1')");

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/v1/command/test-db");
    });

    it("throws with statement context on failure", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ error: "fail" }, false));
      await expect(client.command("BAD SQL")).rejects.toThrow("BAD SQL");
    });
  });

  // -------------------------------------------------------------------------
  // insertVertex
  // -------------------------------------------------------------------------

  describe("insertVertex()", () => {
    it("constructs an INSERT with RETURN @this", async () => {
      const mockFetch = makeMockFetch({ result: [{ id: "abc" }] });
      vi.stubGlobal("fetch", mockFetch);

      const result = await client.insertVertex("HumanIdentity", {
        id: "abc",
        tenantId: "test",
        name: "Alice",
      });

      expect(result).toEqual({ id: "abc" });
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { command: string };
      expect(body.command).toContain("INSERT INTO HumanIdentity");
      expect(body.command).toContain("RETURN @this");
    });

    it("throws if the insert returns no record", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ result: [] }));
      await expect(
        client.insertVertex("Foo", { id: "x" }),
      ).rejects.toThrow("returned no record");
    });

    it("omits undefined and null properties from INSERT", async () => {
      const mockFetch = makeMockFetch({ result: [{ id: "x" }] });
      vi.stubGlobal("fetch", mockFetch);

      await client.insertVertex("Foo", { id: "x", optional: undefined, alsoNull: null });
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { command: string };
      expect(body.command).not.toContain("optional");
      expect(body.command).not.toContain("alsoNull");
    });
  });

  // -------------------------------------------------------------------------
  // escape / sqlLiteral (via insertVertex)
  // -------------------------------------------------------------------------

  describe("escape()", () => {
    it("wraps a string in single quotes", () => {
      expect(client.escape("hello")).toBe("'hello'");
    });

    it("escapes single quotes in the string", () => {
      expect(client.escape("it's")).toBe("'it\\'s'");
    });
  });

  describe("count()", () => {
    it("returns the count from the result", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ result: [{ count: 42 }] }));
      const n = await client.count("HumanIdentity", "prism-dev");
      expect(n).toBe(42);
    });

    it("returns 0 if result is empty", async () => {
      vi.stubGlobal("fetch", makeMockFetch({ result: [] }));
      const n = await client.count("HumanIdentity", "prism-dev");
      expect(n).toBe(0);
    });
  });
});
