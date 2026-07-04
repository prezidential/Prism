import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { delegationDepthScorer } from "../delegation-depth.js";

describe("delegationDepthScorer", () => {
  it("does not flag shallow, non-transitive delegations", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM Delegation",
        rows: [{ toIdentityRef: "u1", toIdentityType: "HumanIdentity", depth: 1, isTransitive: false }],
      },
    ]);
    const findings = await delegationDepthScorer.score(client, "t1");
    expect(findings).toHaveLength(0);
  });

  it("flags a deep delegation chain and scales with depth", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM Delegation",
        rows: [{ toIdentityRef: "u1", toIdentityType: "AgentIdentity", depth: 4, isTransitive: false }],
      },
    ]);
    const findings = await delegationDepthScorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.identityId).toBe("u1");
    // depth 4 of max 4 → depth component 1.0
    expect(findings[0]?.score).toBe(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("adds a transitive bonus", async () => {
    const nonTransitive = new MockGraphClient([
      { match: "FROM Delegation", rows: [{ toIdentityRef: "u1", toIdentityType: "AgentIdentity", depth: 2, isTransitive: false }] },
    ]);
    const transitive = new MockGraphClient([
      { match: "FROM Delegation", rows: [{ toIdentityRef: "u1", toIdentityType: "AgentIdentity", depth: 2, isTransitive: true }] },
    ]);
    const a = await delegationDepthScorer.score(nonTransitive, "t1");
    const b = await delegationDepthScorer.score(transitive, "t1");
    expect(b[0]!.score).toBeGreaterThan(a[0]!.score);
  });

  it("aggregates multiple inbound delegations to the deepest chain", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM Delegation",
        rows: [
          { toIdentityRef: "u1", toIdentityType: "AgentIdentity", depth: 2, isTransitive: false },
          { toIdentityRef: "u1", toIdentityType: "AgentIdentity", depth: 4, isTransitive: true },
        ],
      },
    ]);
    const findings = await delegationDepthScorer.score(client, "t1");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence["maxDepth"]).toBe(4);
    expect(findings[0]?.evidence["chainCount"]).toBe(2);
    expect(findings[0]?.evidence["transitive"]).toBe(true);
  });
});
