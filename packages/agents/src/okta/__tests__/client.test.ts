import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OktaClient } from "../client.js";
import type { OktaApiUser, OktaApiGroup } from "../client.js";

const testConfig = {
  domain: "dev-test.okta.com",
  token: "test-ssws-token",
  rateLimit: 100, // high rate limit to avoid sleeps in tests
};

function makeClient(): OktaClient {
  return new OktaClient(testConfig);
}

function makeUser(id: string): OktaApiUser {
  return {
    id,
    status: "ACTIVE",
    created: "2024-01-01T00:00:00.000Z",
    lastUpdated: "2024-01-02T00:00:00.000Z",
    profile: {
      login: `user-${id}@example.com`,
      email: `user-${id}@example.com`,
      firstName: "Test",
      lastName: "User",
    },
  };
}

function makeGroup(id: string): OktaApiGroup {
  return {
    id,
    type: "OKTA_GROUP",
    lastUpdated: "2024-01-01T00:00:00.000Z",
    lastMembershipUpdated: "2024-01-01T00:00:00.000Z",
    profile: {
      name: `Group ${id}`,
    },
  };
}

function mockOkResponse(data: unknown, linkNext?: string): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (linkNext) {
    headers.set("link", `<${linkNext}>; rel="next", <https://dev-test.okta.com/api/v1/users?limit=200>; rel="self"`);
  }
  return {
    ok: true,
    status: 200,
    headers,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

describe("OktaClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listUsers", () => {
    it("yields users from first page with no pagination", async () => {
      const users = [makeUser("1"), makeUser("2"), makeUser("3")];
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOkResponse(users)));

      const client = makeClient();
      const result: OktaApiUser[] = [];
      for await (const user of client.listUsers()) {
        result.push(user);
      }

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe("1");
      expect(result[2]?.id).toBe("3");
    });

    it("follows Link header pagination", async () => {
      const page1 = [makeUser("1"), makeUser("2")];
      const page2 = [makeUser("3"), makeUser("4")];
      const nextUrl = "https://dev-test.okta.com/api/v1/users?limit=200&after=cursor123";

      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockOkResponse(page1, nextUrl))
        .mockResolvedValueOnce(mockOkResponse(page2));

      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient();
      const result: OktaApiUser[] = [];
      for await (const user of client.listUsers()) {
        result.push(user);
      }

      expect(result).toHaveLength(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Second call should use the next URL
      const secondCallUrl = (mockFetch.mock.calls[1] as [string, unknown])[0];
      expect(secondCallUrl).toBe(nextUrl);
    });

    it("applies filter parameter to URL", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOkResponse([]));
      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient();
      for await (const _ of client.listUsers('status eq "ACTIVE"')) {
        // drain
      }

      const callUrl = (mockFetch.mock.calls[0] as [string, unknown])[0] as string;
      expect(callUrl).toContain("filter=");
      expect(callUrl).toContain("ACTIVE");
    });
  });

  describe("getUser", () => {
    it("calls correct endpoint", async () => {
      const user = makeUser("abc123");
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOkResponse(user));
      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient();
      const result = await client.getUser("abc123");

      expect(result.id).toBe("abc123");
      const callUrl = (mockFetch.mock.calls[0] as [string, unknown])[0] as string;
      expect(callUrl).toContain("/api/v1/users/abc123");
    });
  });

  describe("getUserGroups", () => {
    it("returns array of groups for a user", async () => {
      const groups = [makeGroup("g1"), makeGroup("g2")];
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOkResponse(groups));
      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient();
      const result = await client.getUserGroups("user-123");

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("g1");

      const callUrl = (mockFetch.mock.calls[0] as [string, unknown])[0] as string;
      expect(callUrl).toContain("/api/v1/users/user-123/groups");
    });
  });

  describe("listGroups", () => {
    it("yields groups from API", async () => {
      const groups = [makeGroup("g1"), makeGroup("g2"), makeGroup("g3")];
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOkResponse(groups)));

      const client = makeClient();
      const result: OktaApiGroup[] = [];
      for await (const group of client.listGroups()) {
        result.push(group);
      }

      expect(result).toHaveLength(3);
      expect(result[1]?.id).toBe("g2");
    });
  });

  describe("listGroupMembers", () => {
    it("yields members for a group", async () => {
      const users = [makeUser("u1"), makeUser("u2")];
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOkResponse(users)));

      const client = makeClient();
      const result: OktaApiUser[] = [];
      for await (const user of client.listGroupMembers("group-abc")) {
        result.push(user);
      }

      expect(result).toHaveLength(2);
      const callUrl = (
        vi.mocked(fetch).mock.calls[0] as [string, unknown]
      )[0] as string;
      expect(callUrl).toContain("/api/v1/groups/group-abc/users");
    });
  });

  describe("error handling", () => {
    it("throws on non-OK response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers(),
          text: () => Promise.resolve("Unauthorized"),
        } as unknown as Response),
      );

      const client = makeClient();
      await expect(client.getUser("user-1")).rejects.toThrow("401");
    });
  });
});
