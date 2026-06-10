import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeClient } from "../../../db/client.js";
import { queryDelegationPaths } from "../delegation-paths.js";

const CONFIG = { url: "http://localhost:2480", database: "idem", user: "root", password: "secret" };

function mockFetch(result: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ result }),
    text: async () => JSON.stringify({ result }),
  });
}

describe("queryDelegationPaths()", () => {
  let client: ArcadeClient;

  beforeEach(() => {
    client = new ArcadeClient(CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns delegation path results for a source identity", async () => {
    const delegation = {
      id: "del-1",
      fromIdentityRef: "human-1",
      fromIdentityType: "HumanIdentity",
      toIdentityRef: "agent-1",
      toIdentityType: "AgentIdentity",
      scope: ["read:HumanIdentity"],
      grantedAt: "2026-01-01T00:00:00Z",
      expiresAt: null,
      isTransitive: false,
      depth: 1,
    };
    vi.stubGlobal("fetch", mockFetch([delegation]));

    const results = await queryDelegationPaths(client, "t1", "human-1");

    expect(results).toHaveLength(1);
    expect(results[0]?.sourceId).toBe("human-1");
    expect(results[0]?.hops).toHaveLength(1);
    expect(results[0]?.hops[0]?.toId).toBe("agent-1");
    expect(results[0]?.totalDepth).toBe(1);
  });

  it("filters to specific target when toIdentityId is provided", async () => {
    const delegations = [
      {
        id: "del-1",
        fromIdentityRef: "human-1", fromIdentityType: "HumanIdentity",
        toIdentityRef: "agent-1", toIdentityType: "AgentIdentity",
        scope: ["read"], grantedAt: "2026-01-01T00:00:00Z", expiresAt: null,
        isTransitive: false, depth: 1,
      },
      {
        id: "del-2",
        fromIdentityRef: "human-1", fromIdentityType: "HumanIdentity",
        toIdentityRef: "agent-2", toIdentityType: "AgentIdentity",
        scope: ["write"], grantedAt: "2026-01-01T00:00:00Z", expiresAt: null,
        isTransitive: false, depth: 1,
      },
    ];
    vi.stubGlobal("fetch", mockFetch(delegations));

    const results = await queryDelegationPaths(client, "t1", "human-1", "agent-1");
    expect(results).toHaveLength(1);
    expect(results[0]?.targetId).toBe("agent-1");
  });

  it("returns empty array when no delegations exist", async () => {
    vi.stubGlobal("fetch", mockFetch([]));
    const results = await queryDelegationPaths(client, "t1", "human-1");
    expect(results).toHaveLength(0);
  });

  it("includes maxDepth in the query SQL", async () => {
    const mockFetchFn = mockFetch([]);
    vi.stubGlobal("fetch", mockFetchFn);

    await queryDelegationPaths(client, "t1", "h-1", undefined, 3);

    const [, init] = mockFetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { command: string };
    expect(body.command).toContain("depth <= 3");
  });
});
