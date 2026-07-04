// Agent scope deviation scorer.
//
// Every AgentIdentity declares a scope of what it is allowed to do. Its
// ExecutionEvents record what it actually did. The gap between the two is the
// single most important agentic-identity risk signal: an agent acting outside
// its declared scope is either misconfigured or compromised. This scorer flags
// each agent by the fraction of its actions that fell out of scope, weighting
// out-of-scope actions that were nonetheless *successful* most heavily.

import type { GraphClient } from "../client.js";
import { clamp01, esc, round2 } from "../client.js";
import type { RiskFinding, RiskScorer } from "../types.js";
import { CAEP_URI_BASE, severityForScore } from "../types.js";

// A successful out-of-scope action is worse than a denied one — the agent
// actually did something it was not supposed to.
const SUCCESS_MULTIPLIER = 1.0;
const DENIED_MULTIPLIER = 0.5;

interface AgentRow {
  id: string;
  nodeType: string;
}

interface EventRow {
  withinDeclaredScope: boolean | null;
  outcome: string | null;
}

export const agentScopeDeviationScorer: RiskScorer = {
  id: "agent-scope-deviation",
  weight: 0.3,

  async score(client: GraphClient, tenantId: string): Promise<RiskFinding[]> {
    const t = esc(tenantId);

    const agents = await client.query<AgentRow>(
      `SELECT id, nodeType FROM AgentIdentity WHERE tenantId = '${t}'`,
    );

    const findings: RiskFinding[] = [];

    for (const agent of agents) {
      const events = await client.query<EventRow>(
        `SELECT withinDeclaredScope, outcome
         FROM ExecutionEvent
         WHERE tenantId = '${t}' AND agentRef = '${esc(agent.id)}'`,
      );

      const total = events.length;
      if (total === 0) continue;

      const outOfScope = events.filter((e) => e.withinDeclaredScope === false);
      if (outOfScope.length === 0) continue;

      // Weight out-of-scope events by outcome, then normalize by total events.
      const weighted = outOfScope.reduce((sum, e) => {
        const mult = e.outcome === "denied" ? DENIED_MULTIPLIER : SUCCESS_MULTIPLIER;
        return sum + mult;
      }, 0);
      const score = clamp01(weighted / total);
      if (score <= 0) continue;

      const successfulOutOfScope = outOfScope.filter((e) => e.outcome !== "denied").length;

      findings.push({
        scorer: "agent-scope-deviation",
        identityId: agent.id,
        identityType: agent.nodeType,
        score: round2(score),
        severity: severityForScore(score),
        rationale:
          `${outOfScope.length}/${total} observed action(s) fell outside declared scope` +
          (successfulOutOfScope > 0
            ? `; ${successfulOutOfScope} succeeded.`
            : "; all were denied."),
        caepEventType: "risk-level-change",
        eventTypeUri: `${CAEP_URI_BASE}/risk-level-change`,
        evidence: {
          totalEvents: total,
          outOfScopeEvents: outOfScope.length,
          successfulOutOfScope,
        },
      });
    }

    return findings;
  },
};
