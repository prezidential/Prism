import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_DATA } from "../../data/demo-data.ts";
import { mapApiResponse } from "../../data/data-source.ts";
import { buildAlertFeed, countBySeverity } from "../alerts.ts";
import { relativeTime, riskBand } from "../format.ts";
import { computeLayout, neighborsOf, nodeRadius } from "../graph-layout.ts";
import { filterIdentities, sortIdentities } from "../risk-table.ts";

describe("format", () => {
  it("bands risk scores", () => {
    expect(riskBand(0.9)).toBe("critical");
    expect(riskBand(0.6)).toBe("high");
    expect(riskBand(0.4)).toBe("elevated");
    expect(riskBand(0.2)).toBe("moderate");
    expect(riskBand(0.05)).toBe("low");
  });
  it("formats relative time from an injected now", () => {
    expect(relativeTime("2026-07-04T09:00:00Z", "2026-07-04T09:03:00Z")).toBe("3m ago");
    expect(relativeTime("2026-07-03T09:00:00Z", "2026-07-04T09:00:00Z")).toBe("1d ago");
  });
});

describe("graph-layout", () => {
  it("places nodes in kind lanes within bounds", () => {
    const pos = computeLayout(DEMO_DATA.graph.nodes, { width: 800, height: 600 });
    expect(pos.size).toBe(DEMO_DATA.graph.nodes.length);
    for (const p of pos.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });
  it("is deterministic", () => {
    const a = computeLayout(DEMO_DATA.graph.nodes, { width: 800, height: 600 });
    const b = computeLayout(DEMO_DATA.graph.nodes, { width: 800, height: 600 });
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
  it("places different kinds in different lanes (x)", () => {
    const pos = computeLayout(DEMO_DATA.graph.nodes, { width: 800, height: 600 });
    const humanX = pos.get("hum-ada")?.x ?? 0;
    const resourceX = pos.get("res-payments")?.x ?? 0;
    expect(resourceX).toBeGreaterThan(humanX);
  });
  it("finds neighbors in both directions", () => {
    const n = neighborsOf(DEMO_DATA.graph.edges, "agent-deploy");
    expect(n.has("ent-admin")).toBe(true); // outgoing HAS_ENTITLEMENT
    expect(n.has("hum-marcus")).toBe(true); // incoming SPAWNED
  });
  it("scales node radius with risk", () => {
    expect(nodeRadius(1)).toBeGreaterThan(nodeRadius(0));
  });
});

describe("risk-table", () => {
  const ids = DEMO_DATA.identities;
  it("sorts by risk descending", () => {
    const sorted = sortIdentities(ids, "riskScore", "desc");
    expect(sorted[0]?.riskScore).toBeGreaterThanOrEqual(sorted[1]?.riskScore ?? 0);
  });
  it("filters by kind and min risk", () => {
    const agents = filterIdentities(ids, { kind: "agent" });
    expect(agents.every((i) => i.kind === "agent")).toBe(true);
    const risky = filterIdentities(ids, { minRisk: 0.8 });
    expect(risky.every((i) => i.riskScore >= 0.8)).toBe(true);
  });
  it("filters by free-text query", () => {
    const hits = filterIdentities(ids, { query: "deploy" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((i) => i.name.toLowerCase().includes("deploy"))).toBe(true);
  });
});

describe("alerts", () => {
  it("orders newest first", () => {
    const feed = buildAlertFeed(DEMO_DATA.signals);
    for (let i = 1; i < feed.length; i++) {
      expect(Date.parse(feed[i - 1]!.iat)).toBeGreaterThanOrEqual(Date.parse(feed[i]!.iat));
    }
  });
  it("counts by severity", () => {
    const counts = countBySeverity(DEMO_DATA.signals);
    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.critical + counts.warning + counts.info).toBe(DEMO_DATA.signals.length);
  });
});

describe("demo data integrity", () => {
  it("derives per-identity signal aggregates consistently", () => {
    const data = buildDemoData();
    for (const identity of data.identities) {
      const own = data.signals.filter((s) => s.subjectRef === identity.id);
      expect(identity.signalCount).toBe(own.length);
    }
  });
  it("every edge references a real node", () => {
    const ids = new Set(DEMO_DATA.graph.nodes.map((n) => n.id));
    for (const e of DEMO_DATA.graph.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });
});

describe("ApiDataSource mapping", () => {
  it("maps the risk API response into dashboard identities + signals", () => {
    const data = mapApiResponse({
      tenantId: "t1",
      identities: [
        {
          identityId: "a1",
          identityType: "AgentIdentity",
          riskScore: 0.9,
          status: "Active",
          signalCount: 1,
          highestSeverity: "critical",
          signals: [
            { signalId: "s1", scorer: "blast-radius", caepEventType: "risk-level-change", score: 0.9, severity: "critical", iat: "2026-07-04T00:00:00Z", rationale: "wide" },
          ],
        },
      ],
    });
    expect(data.identities[0]?.kind).toBe("agent");
    expect(data.signals[0]?.subjectRef).toBe("a1");
    expect(data.signals[0]?.severity).toBe("critical");
  });
});
