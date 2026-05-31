import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeClient } from "../../../db/client.js";
import { NodeType } from "../../../schema/enums.js";
import type { AgentIdentity } from "../../../schema/types.js";
import { queryAgentScope } from "../agent-scope.js";

function mockFetch(...responses: unknown[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => JSON.stringify(response),
    });
  });
}

const CONFIG = { url: "http://localhost:2480", database: "idem", user: "root", password: "secret" };

describe("queryAgentScope()", () => {
  let client: ArcadeClient;

  beforeEach(() => {
    client = new ArcadeClient(CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const agentRecord: AgentIdentity = {
    id: "agent-1",
    tenantId: "t1",
    nodeType: NodeType.AgentIdentity,
    agentType: "idem-ingest-agent",
    model: "claude-sonnet-4-6",
    scopeDefinition: { allowedOperations: ["read"] },
    spawnedAt: "2026-01-01T00:00:00Z",
    maxLifetimeSeconds: 86400,
    credentialType: "OIDC" as Parameters<typeof client.insertVertex>[1]["credentialType"],
    credentialRef: "vault/secret/agents/t1/ingest",
    status: "Active",
    riskScore: 0.1,
    lastActivity: "2026-05-31T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    tags: [],
    metadata: {},
    externalIds: {},
  } as AgentIdentity;

  it("returns correct scope result with in-scope and out-of-scope events", async () => {
    const inScopeEvent = {
      action: "read:HumanIdentity",
      targetRef: "h-1",
      targetType: "HumanIdentity",
      executedAt: "2026-05-30T00:00:00Z",
      outcome: "success",
      withinDeclaredScope: true,
    };
    const outOfScopeEvent = {
      action: "delete:HumanIdentity",
      targetRef: "h-2",
      targetType: "HumanIdentity",
      executedAt: "2026-05-31T00:00:00Z",
      outcome: "denied",
      withinDeclaredScope: false,
    };

    vi.stubGlobal(
      "fetch",
      mockFetch(
        { result: [agentRecord] },             // agent lookup
        { result: [inScopeEvent, outOfScopeEvent] }, // execution events
      ),
    );

    const result = await queryAgentScope(client, "t1", "agent-1");

    expect(result.agentId).toBe("agent-1");
    expect(result.agentType).toBe("idem-ingest-agent");
    expect(result.totalEvents).toBe(2);
    expect(result.inScopeCount).toBe(1);
    expect(result.outOfScopeCount).toBe(1);
    expect(result.deviationScore).toBe(0.5);
    expect(result.outOfScopeEvents).toHaveLength(1);
    expect(result.outOfScopeEvents[0]?.action).toBe("delete:HumanIdentity");
  });

  it("returns deviationScore of 0 when no events exist", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        { result: [agentRecord] },
        { result: [] },
      ),
    );

    const result = await queryAgentScope(client, "t1", "agent-1");
    expect(result.totalEvents).toBe(0);
    expect(result.deviationScore).toBe(0);
  });

  it("throws when agent not found", async () => {
    vi.stubGlobal("fetch", mockFetch({ result: [] }));

    await expect(queryAgentScope(client, "t1", "missing")).rejects.toThrow(
      "AgentIdentity not found",
    );
  });
});
