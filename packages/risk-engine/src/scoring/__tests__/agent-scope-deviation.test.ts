import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { agentScopeDeviationScorer } from "../agent-scope-deviation.js";

describe("agentScopeDeviationScorer", () => {
  it("does not flag an agent operating fully in scope", async () => {
    const client = new MockGraphClient([
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity" }] },
      {
        match: "FROM ExecutionEvent",
        rows: [
          { withinDeclaredScope: true, outcome: "success" },
          { withinDeclaredScope: true, outcome: "success" },
        ],
      },
    ]);
    const findings = await agentScopeDeviationScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("weights successful out-of-scope actions more heavily than denied ones", async () => {
    const successClient = new MockGraphClient([
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity" }] },
      {
        match: "FROM ExecutionEvent",
        rows: [
          { withinDeclaredScope: true, outcome: "success" },
          { withinDeclaredScope: false, outcome: "success" },
        ],
      },
    ]);
    const deniedClient = new MockGraphClient([
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity" }] },
      {
        match: "FROM ExecutionEvent",
        rows: [
          { withinDeclaredScope: true, outcome: "success" },
          { withinDeclaredScope: false, outcome: "denied" },
        ],
      },
    ]);
    const s = await agentScopeDeviationScorer.score(successClient, "t1");
    const d = await agentScopeDeviationScorer.score(deniedClient, "t1");
    expect(s[0]!.score).toBeGreaterThan(d[0]!.score);
    // 1 successful out-of-scope of 2 events → 0.5
    expect(s[0]!.score).toBe(0.5);
    expect(s[0]!.evidence["successfulOutOfScope"]).toBe(1);
  });

  it("ignores agents with no execution events", async () => {
    const client = new MockGraphClient([
      { match: "FROM AgentIdentity", rows: [{ id: "a1", nodeType: "AgentIdentity" }] },
      { match: "FROM ExecutionEvent", rows: [] },
    ]);
    const findings = await agentScopeDeviationScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });
});
