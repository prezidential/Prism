import { describe, expect, it } from "vitest";
import { aggregateFindings } from "../aggregate.js";
import type { RiskFinding, RiskScorer } from "../types.js";

function scorer(id: RiskScorer["id"], weight: number): RiskScorer {
  return { id, weight, score: async () => [] };
}

function finding(over: Partial<RiskFinding>): RiskFinding {
  return {
    scorer: "blast-radius",
    identityId: "u1",
    identityType: "HumanIdentity",
    score: 0.5,
    severity: "warning",
    rationale: "",
    caepEventType: "risk-level-change",
    eventTypeUri: "uri",
    evidence: {},
    ...over,
  };
}

describe("aggregateFindings", () => {
  it("groups findings by identity and picks the highest severity", async () => {
    const scorers = [scorer("blast-radius", 1), scorer("agent-scope-deviation", 1)];
    const profiles = aggregateFindings(
      [
        finding({ scorer: "blast-radius", score: 0.3, severity: "info" }),
        finding({ scorer: "agent-scope-deviation", score: 0.9, severity: "critical" }),
      ],
      scorers,
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.findings).toHaveLength(2);
    expect(profiles[0]?.topSeverity).toBe("critical");
  });

  it("combines independent findings with noisy-OR (compounds but stays <= 1)", async () => {
    const scorers = [scorer("blast-radius", 1)];
    const single = aggregateFindings([finding({ score: 0.5 })], scorers);
    const doubled = aggregateFindings(
      [finding({ scorer: "blast-radius", score: 0.5 }), finding({ scorer: "blast-radius", score: 0.5 })],
      scorers,
    );
    // 1 - (1-0.5) = 0.5 ; 1 - (1-0.5)(1-0.5) = 0.75
    expect(single[0]?.compositeScore).toBe(0.5);
    expect(doubled[0]?.compositeScore).toBe(0.75);
    expect(doubled[0]!.compositeScore).toBeLessThanOrEqual(1);
  });

  it("applies scorer weights", async () => {
    const scorers = [scorer("blast-radius", 0.5)];
    const profiles = aggregateFindings([finding({ score: 1.0 })], scorers);
    // 1 - (1 - 0.5*1.0) = 0.5
    expect(profiles[0]?.compositeScore).toBe(0.5);
  });

  it("sorts identities by composite score descending", async () => {
    const scorers = [scorer("blast-radius", 1)];
    const profiles = aggregateFindings(
      [
        finding({ identityId: "low", score: 0.2 }),
        finding({ identityId: "high", score: 0.9 }),
      ],
      scorers,
    );
    expect(profiles.map((p) => p.identityId)).toEqual(["high", "low"]);
  });
});
