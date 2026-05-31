// agent-scope — declared scope vs. actual observed behavior.
// Compares an AgentIdentity's scopeDefinition against its ExecutionEvent records.
// Returns a structured diff: in-scope actions, out-of-scope actions, and unexercised scope.

import type { ArcadeClient } from "../../db/client.js";
import type { AgentIdentity } from "../../schema/types.js";

export interface ScopeDeviation {
  action: string;
  targetRef: string | null;
  targetType: string | null;
  executedAt: string;
  outcome: string;
  withinDeclaredScope: boolean;
}

export interface AgentScopeResult {
  agentId: string;
  agentType: string;
  model: string;
  declaredScope: Record<string, unknown>;
  totalEvents: number;
  inScopeCount: number;
  outOfScopeCount: number;
  outOfScopeEvents: ScopeDeviation[];
  inScopeEvents: ScopeDeviation[];
  deviationScore: number; // 0.0–1.0; ratio of out-of-scope events
}

export async function queryAgentScope(
  client: ArcadeClient,
  tenantId: string,
  agentId: string,
): Promise<AgentScopeResult> {
  const esc = (v: string) => v.replace(/'/g, "\\'");

  // Fetch the agent vertex
  const agentRows = await client.query<AgentIdentity>(
    `SELECT FROM AgentIdentity WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(agentId)}'`,
  );
  const agent = agentRows[0];
  if (!agent) {
    throw new Error(`AgentIdentity not found: tenantId=${tenantId} id=${agentId}`);
  }

  // Fetch all execution events for this agent
  interface EventRow {
    action: string;
    targetRef: string | null;
    targetType: string | null;
    executedAt: string;
    outcome: string;
    withinDeclaredScope: boolean;
  }

  const eventRows = await client.query<EventRow>(
    `SELECT action, targetRef, targetType, executedAt, outcome, withinDeclaredScope
     FROM ExecutionEvent
     WHERE tenantId = '${esc(tenantId)}' AND agentRef = '${esc(agentId)}'
     ORDER BY executedAt DESC`,
  );

  const outOfScope = eventRows.filter((e) => !e.withinDeclaredScope);
  const inScope = eventRows.filter((e) => e.withinDeclaredScope);
  const total = eventRows.length;
  const deviationScore = total > 0 ? outOfScope.length / total : 0;

  const toDeviation = (e: EventRow): ScopeDeviation => ({
    action: e.action,
    targetRef: e.targetRef ?? null,
    targetType: e.targetType ?? null,
    executedAt: e.executedAt,
    outcome: e.outcome,
    withinDeclaredScope: e.withinDeclaredScope,
  });

  const scopeDefinition =
    typeof agent.scopeDefinition === "string"
      ? (JSON.parse(agent.scopeDefinition) as Record<string, unknown>)
      : (agent.scopeDefinition ?? {});

  return {
    agentId,
    agentType: agent.agentType,
    model: agent.model,
    declaredScope: scopeDefinition,
    totalEvents: total,
    inScopeCount: inScope.length,
    outOfScopeCount: outOfScope.length,
    outOfScopeEvents: outOfScope.map(toDeviation),
    inScopeEvents: inScope.map(toDeviation),
    deviationScore: Math.round(deviationScore * 100) / 100,
  };
}
