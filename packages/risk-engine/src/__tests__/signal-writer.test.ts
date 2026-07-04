import { describe, expect, it } from "vitest";
import { MockGraphClient, testDeps } from "./mock-client.js";
import { writeSignal, writeSignals } from "../signal-writer.js";
import type { RiskFinding } from "../types.js";

const FINDING: RiskFinding = {
  scorer: "agent-scope-deviation",
  identityId: "agent-1",
  identityType: "AgentIdentity",
  score: 0.82,
  severity: "critical",
  rationale: "3/4 actions out of scope",
  caepEventType: "risk-level-change",
  eventTypeUri: "https://schemas.openid.net/secevent/caep/event-type/risk-level-change",
  evidence: { totalEvents: 4, outOfScopeEvents: 3 },
};

describe("writeSignal", () => {
  it("materializes a RiskSignal vertex as an SSF/CAEP SET", async () => {
    const client = new MockGraphClient();
    const id = await writeSignal(client, "t1", FINDING, testDeps());

    expect(id).toBe("id-1");
    expect(client.commands).toHaveLength(1);
    const sql = client.commands[0]!;
    expect(sql).toContain("INSERT INTO RiskSignal");
    expect(sql).toContain("agent-1"); // subjectRef
    expect(sql).toContain("prism-risk-engine"); // iss
    expect(sql).toContain("risk-level-change"); // caepEventType
    expect(sql).toContain("0.82"); // score
    expect(sql).toContain("critical"); // severity
  });

  it("escapes single quotes in embedded payload text", async () => {
    const client = new MockGraphClient();
    await writeSignal(
      client,
      "t1",
      { ...FINDING, rationale: "agent's action" },
      testDeps(),
    );
    // The apostrophe must be backslash-escaped, not left raw to break the SQL.
    expect(client.commands[0]).toContain("agent\\'s action");
  });
});

describe("writeSignals", () => {
  it("writes one vertex per finding and returns the count", async () => {
    const client = new MockGraphClient();
    const n = await writeSignals(client, "t1", [FINDING, FINDING, FINDING], testDeps());
    expect(n).toBe(3);
    expect(client.commands).toHaveLength(3);
  });
});
