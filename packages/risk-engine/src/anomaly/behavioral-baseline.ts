// Behavioral-baseline anomaly detection.
//
// Establishes a behavioral baseline for each agent from its historical
// ExecutionEvents, then flags recent activity that deviates from it: actions or
// target types never seen before, a spike in activity volume, or an elevated
// rate of denied actions. Like every risk-engine scorer this is a pure function
// of the graph — the "baseline" is derived from the events already in the
// Identograph, not a separate time-series store.

import type { GraphClient } from "../client.js";
import { clamp01, esc, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";

// An agent needs at least this many baseline events for a meaningful profile.
const MIN_BASELINE_EVENTS = 5;

// Below this score a "deviation" is numerical noise (e.g. a marginally higher
// event rate), not an alert-worthy anomaly.
const MIN_ANOMALY_SCORE = 0.1;

// Scoring weights (sum to 1.0).
const W_NOVEL_ACTION = 0.45;
const W_NOVEL_TARGET = 0.2;
const W_VOLUME_SPIKE = 0.2;
const W_DENIED_SPIKE = 0.15;

export interface BehavioralAnomalyOptions {
  // "Now" — the reference point for the recent window. Injected for determinism.
  now: string;
  // Events within this many days before `now` are the "recent" window that is
  // compared against the older baseline. Default 7.
  recentWindowDays?: number;
}

interface EventRow {
  agentRef: string;
  action: string | null;
  targetType: string | null;
  outcome: string | null;
  executedAt: string | null;
}

interface AgentEvents {
  baseline: EventRow[];
  recent: EventRow[];
  firstBaseline: number; // epoch ms
  lastBaseline: number;
}

function deniedRate(events: EventRow[]): number {
  if (events.length === 0) return 0;
  const denied = events.filter((e) => e.outcome === "denied").length;
  return denied / events.length;
}

function eventsPerDay(count: number, spanMs: number): number {
  const days = Math.max(spanMs / 86_400_000, 1 / 24); // floor span at 1 hour
  return count / days;
}

// Compute anomaly findings for a tenant. Exposed standalone (deviation alerts)
// and wrapped as a scorer below.
export async function detectAnomalies(
  client: GraphClient,
  tenantId: string,
  options: BehavioralAnomalyOptions,
): Promise<RiskFinding[]> {
  const nowMs = Date.parse(options.now);
  const windowMs = (options.recentWindowDays ?? 7) * 86_400_000;
  const cutoff = Number.isNaN(nowMs) ? Number.POSITIVE_INFINITY : nowMs - windowMs;

  const rows = await client.query<EventRow>(
    `SELECT agentRef, action, targetType, outcome, executedAt
     FROM ExecutionEvent
     WHERE tenantId = '${esc(tenantId)}'
     ORDER BY executedAt ASC`,
  );

  // Group by agent, splitting into baseline (older) and recent (within window).
  const byAgent = new Map<string, AgentEvents>();
  for (const row of rows) {
    if (!row.agentRef) continue;
    const ts = row.executedAt ? Date.parse(row.executedAt) : NaN;
    const agent = byAgent.get(row.agentRef) ?? {
      baseline: [],
      recent: [],
      firstBaseline: Number.POSITIVE_INFINITY,
      lastBaseline: Number.NEGATIVE_INFINITY,
    };
    if (!Number.isNaN(ts) && ts >= cutoff) {
      agent.recent.push(row);
    } else if (!Number.isNaN(ts)) {
      agent.baseline.push(row);
      agent.firstBaseline = Math.min(agent.firstBaseline, ts);
      agent.lastBaseline = Math.max(agent.lastBaseline, ts);
    }
    // Events with an unparseable timestamp are ignored (cannot be placed).
    byAgent.set(row.agentRef, agent);
  }

  const findings: RiskFinding[] = [];
  for (const [agentRef, ev] of byAgent) {
    if (ev.baseline.length < MIN_BASELINE_EVENTS || ev.recent.length === 0) continue;

    const baselineActions = new Set(ev.baseline.map((e) => e.action ?? ""));
    const baselineTargets = new Set(ev.baseline.map((e) => e.targetType ?? ""));

    const novelActions = ev.recent.filter((e) => !baselineActions.has(e.action ?? ""));
    const novelActionRatio = novelActions.length / ev.recent.length;

    const novelTargets = [
      ...new Set(
        ev.recent
          .map((e) => e.targetType ?? "")
          .filter((t) => t !== "" && !baselineTargets.has(t)),
      ),
    ];

    const baselineSpan = Math.max(ev.lastBaseline - ev.firstBaseline, 0);
    const baselineRate = eventsPerDay(ev.baseline.length, baselineSpan);
    const recentRate = eventsPerDay(ev.recent.length, windowMs);
    const volumeSpike = baselineRate > 0 ? clamp01((recentRate / baselineRate - 1) / 3) : 0;

    const deniedSpike = clamp01(deniedRate(ev.recent) - deniedRate(ev.baseline));

    const score = clamp01(
      W_NOVEL_ACTION * novelActionRatio +
        W_NOVEL_TARGET * (novelTargets.length > 0 ? 1 : 0) +
        W_VOLUME_SPIKE * volumeSpike +
        W_DENIED_SPIKE * deniedSpike,
    );
    if (score < MIN_ANOMALY_SCORE) continue;

    const reasons: string[] = [];
    if (novelActions.length > 0) {
      reasons.push(`${novelActions.length} previously-unseen action(s)`);
    }
    if (novelTargets.length > 0) reasons.push(`new target type(s): ${novelTargets.join(", ")}`);
    if (volumeSpike > 0) reasons.push(`activity volume ${recentRate.toFixed(1)}/day vs baseline ${baselineRate.toFixed(1)}/day`);
    if (deniedSpike > 0) reasons.push("elevated denied-action rate");

    findings.push({
      scorer: "behavioral-anomaly",
      identityId: agentRef,
      identityType: "AgentIdentity",
      score: round2(score),
      severity: severityForScore(score),
      rationale: `Recent behavior deviates from baseline: ${reasons.join("; ")}.`,
      caepEventType: "risk-level-change",
      eventTypeUri: `${CAEP_URI_BASE}/risk-level-change`,
      evidence: {
        baselineEvents: ev.baseline.length,
        recentEvents: ev.recent.length,
        novelActions: novelActions.map((e) => e.action).filter(Boolean),
        novelTargetTypes: novelTargets,
        baselineRatePerDay: round2(baselineRate),
        recentRatePerDay: round2(recentRate),
      },
    });
  }

  return findings;
}

// Wrap anomaly detection as a standard risk scorer so it participates in
// evaluateRisk / composite aggregation like every other signal.
export function createBehavioralAnomalyScorer(options: BehavioralAnomalyOptions): RiskScorer {
  return {
    id: "behavioral-anomaly",
    weight: 0.25,
    score: (client, tenantId) => detectAnomalies(client, tenantId, options),
  };
}
