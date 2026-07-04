import { describe, expect, it } from "vitest";
import { MockGraphClient } from "../../__tests__/mock-client.js";
import { detectAnomalies } from "../behavioral-baseline.js";

const NOW = "2026-07-04T00:00:00.000Z";

// Baseline days (well before the 7-day recent window) and recent days.
function baselineEvent(day: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agentRef: "agent-1",
    action: "read:Resource",
    targetType: "Resource",
    outcome: "success",
    executedAt: `2026-05-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    ...over,
  };
}
function recentEvent(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agentRef: "agent-1",
    action: "read:Resource",
    targetType: "Resource",
    outcome: "success",
    executedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

const sixBaseline = [1, 5, 10, 15, 20, 25].map((d) => baselineEvent(d));

describe("detectAnomalies", () => {
  it("does not flag an agent with too small a baseline", async () => {
    const client = new MockGraphClient([
      { match: "FROM ExecutionEvent", rows: [baselineEvent(1), baselineEvent(5), recentEvent({ action: "delete:Resource" })] },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(0);
  });

  it("does not flag normal continuation of established behavior", async () => {
    const client = new MockGraphClient([
      { match: "FROM ExecutionEvent", rows: [...sixBaseline, recentEvent(), recentEvent()] },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(0);
  });

  it("flags previously-unseen actions in the recent window", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM ExecutionEvent",
        rows: [...sixBaseline, recentEvent({ action: "delete:Resource" }), recentEvent({ action: "exfiltrate:Data" })],
      },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.scorer).toBe("behavioral-anomaly");
    expect(findings[0]?.identityId).toBe("agent-1");
    expect(findings[0]?.score).toBeGreaterThanOrEqual(0.45);
    expect(findings[0]?.evidence["novelActions"]).toContain("delete:Resource");
  });

  it("flags a new target type", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM ExecutionEvent",
        rows: [...sixBaseline, recentEvent({ targetType: "SecretsManager" })],
      },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence["novelTargetTypes"]).toContain("SecretsManager");
  });

  it("flags an elevated denied-action rate", async () => {
    const client = new MockGraphClient([
      {
        match: "FROM ExecutionEvent",
        rows: [...sixBaseline, recentEvent({ outcome: "denied" }), recentEvent({ outcome: "denied" })],
      },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rationale).toContain("denied");
  });

  it("ignores events with unparseable timestamps (no baseline formed)", async () => {
    const client = new MockGraphClient([
      { match: "FROM ExecutionEvent", rows: [{ agentRef: "a", action: "x", targetType: "y", outcome: "success", executedAt: null }] },
    ]);
    const findings = await detectAnomalies(client, "t1", { now: NOW });
    expect(findings).toHaveLength(0);
  });
});
