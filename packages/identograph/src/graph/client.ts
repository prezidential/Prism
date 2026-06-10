// IdentographClient — high-level typed interface over ArcadeDB.
// Wraps ArcadeClient (HTTP) and dispatches to traversal query modules.
// This is the primary interface used by all other Idem packages.

import { ArcadeClient, type ArcadeConfig, defaultConfig } from "../db/client.js";
import type {
  AgentIdentity,
  Delegation,
  Entitlement,
  ExecutionEvent,
  HumanIdentity,
  NHIdentity,
  Resource,
  RiskSignal,
  Session,
} from "../schema/types.js";
import { queryAccessLineage, type AccessLineageResult } from "./queries/access-lineage.js";
import { queryAgentScope, type AgentScopeResult } from "./queries/agent-scope.js";
import { queryBlastRadius, type BlastRadiusResult } from "./queries/blast-radius.js";
import { queryDelegationPaths, type DelegationPathResult } from "./queries/delegation-paths.js";
import { queryEntitlementOverlap, type EntitlementOverlapResult } from "./queries/entitlement-overlap.js";
import { queryRiskSurface, type RiskSurfaceResult } from "./queries/risk-surface.js";

export type { AccessLineageResult, AgentScopeResult, BlastRadiusResult, DelegationPathResult, EntitlementOverlapResult, RiskSurfaceResult };

export class IdentographClient {
  readonly arcade: ArcadeClient;

  constructor(config: ArcadeConfig = defaultConfig()) {
    this.arcade = new ArcadeClient(config);
  }

  // ---------------------------------------------------------------------------
  // HumanIdentity
  // ---------------------------------------------------------------------------

  async createHumanIdentity(props: Omit<HumanIdentity, "@rid">): Promise<HumanIdentity> {
    return this.arcade.insertVertex<HumanIdentity>("HumanIdentity", props as Record<string, unknown>);
  }

  async getHumanIdentity(tenantId: string, id: string): Promise<HumanIdentity | null> {
    const rows = await this.arcade.query<HumanIdentity>(
      `SELECT FROM HumanIdentity WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  async listHumanIdentities(tenantId: string): Promise<HumanIdentity[]> {
    return this.arcade.query<HumanIdentity>(
      `SELECT FROM HumanIdentity WHERE tenantId = '${esc(tenantId)}' ORDER BY createdAt DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // AgentIdentity
  // ---------------------------------------------------------------------------

  async createAgentIdentity(props: Omit<AgentIdentity, "@rid">): Promise<AgentIdentity> {
    return this.arcade.insertVertex<AgentIdentity>("AgentIdentity", props as Record<string, unknown>);
  }

  async getAgentIdentity(tenantId: string, id: string): Promise<AgentIdentity | null> {
    const rows = await this.arcade.query<AgentIdentity>(
      `SELECT FROM AgentIdentity WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  async listAgentIdentities(tenantId: string): Promise<AgentIdentity[]> {
    return this.arcade.query<AgentIdentity>(
      `SELECT FROM AgentIdentity WHERE tenantId = '${esc(tenantId)}' ORDER BY createdAt DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // NHIdentity
  // ---------------------------------------------------------------------------

  async createNHIdentity(props: Omit<NHIdentity, "@rid">): Promise<NHIdentity> {
    return this.arcade.insertVertex<NHIdentity>("NHIdentity", props as Record<string, unknown>);
  }

  async getNHIdentity(tenantId: string, id: string): Promise<NHIdentity | null> {
    const rows = await this.arcade.query<NHIdentity>(
      `SELECT FROM NHIdentity WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  async listNHIdentities(tenantId: string): Promise<NHIdentity[]> {
    return this.arcade.query<NHIdentity>(
      `SELECT FROM NHIdentity WHERE tenantId = '${esc(tenantId)}' ORDER BY createdAt DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // Resource
  // ---------------------------------------------------------------------------

  async createResource(props: Omit<Resource, "@rid">): Promise<Resource> {
    return this.arcade.insertVertex<Resource>("Resource", props as Record<string, unknown>);
  }

  async getResource(tenantId: string, id: string): Promise<Resource | null> {
    const rows = await this.arcade.query<Resource>(
      `SELECT FROM Resource WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Entitlement
  // ---------------------------------------------------------------------------

  async createEntitlement(props: Omit<Entitlement, "@rid">): Promise<Entitlement> {
    return this.arcade.insertVertex<Entitlement>("Entitlement", props as Record<string, unknown>);
  }

  async getEntitlement(tenantId: string, id: string): Promise<Entitlement | null> {
    const rows = await this.arcade.query<Entitlement>(
      `SELECT FROM Entitlement WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  async listEntitlements(tenantId: string): Promise<Entitlement[]> {
    return this.arcade.query<Entitlement>(
      `SELECT FROM Entitlement WHERE tenantId = '${esc(tenantId)}' ORDER BY riskWeight DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  async createSession(props: Omit<Session, "@rid">): Promise<Session> {
    return this.arcade.insertVertex<Session>("Session", props as Record<string, unknown>);
  }

  async getSession(tenantId: string, id: string): Promise<Session | null> {
    const rows = await this.arcade.query<Session>(
      `SELECT FROM Session WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  async listActiveSessions(tenantId: string): Promise<Session[]> {
    return this.arcade.query<Session>(
      `SELECT FROM Session WHERE tenantId = '${esc(tenantId)}' AND state = 'Active' ORDER BY startedAt DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // Delegation
  // ---------------------------------------------------------------------------

  async createDelegation(props: Omit<Delegation, "@rid">): Promise<Delegation> {
    return this.arcade.insertVertex<Delegation>("Delegation", props as Record<string, unknown>);
  }

  async getDelegation(tenantId: string, id: string): Promise<Delegation | null> {
    const rows = await this.arcade.query<Delegation>(
      `SELECT FROM Delegation WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // ExecutionEvent
  // ---------------------------------------------------------------------------

  async createExecutionEvent(props: Omit<ExecutionEvent, "@rid">): Promise<ExecutionEvent> {
    return this.arcade.insertVertex<ExecutionEvent>("ExecutionEvent", props as Record<string, unknown>);
  }

  async listExecutionEvents(tenantId: string, agentRef: string): Promise<ExecutionEvent[]> {
    return this.arcade.query<ExecutionEvent>(
      `SELECT FROM ExecutionEvent WHERE tenantId = '${esc(tenantId)}' AND agentRef = '${esc(agentRef)}' ORDER BY executedAt DESC`,
    );
  }

  async listOutOfScopeEvents(tenantId: string): Promise<ExecutionEvent[]> {
    return this.arcade.query<ExecutionEvent>(
      `SELECT FROM ExecutionEvent WHERE tenantId = '${esc(tenantId)}' AND withinDeclaredScope = false ORDER BY executedAt DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // RiskSignal
  // ---------------------------------------------------------------------------

  async createRiskSignal(props: Omit<RiskSignal, "@rid">): Promise<RiskSignal> {
    return this.arcade.insertVertex<RiskSignal>("RiskSignal", props as Record<string, unknown>);
  }

  async listRiskSignals(tenantId: string, subjectRef: string): Promise<RiskSignal[]> {
    return this.arcade.query<RiskSignal>(
      `SELECT FROM RiskSignal WHERE tenantId = '${esc(tenantId)}' AND subjectRef = '${esc(subjectRef)}' ORDER BY score DESC`,
    );
  }

  // ---------------------------------------------------------------------------
  // Generic upsert — insert or update by (tenantId, id)
  // ---------------------------------------------------------------------------

  async upsertVertex<T extends object>(
    vertexType: string,
    tenantId: string,
    id: string,
    props: Record<string, unknown>,
  ): Promise<T> {
    const existing = await this.arcade.query<T>(
      `SELECT FROM ${vertexType} WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}'`,
    );
    if (existing.length > 0) {
      const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== null);
      const setParts = entries.map(([k, v]) => `\`${k}\` = ${this.arcade.escape(String(v))}`).join(", ");
      const rows = await this.arcade.command<T>(
        `UPDATE ${vertexType} SET ${setParts} WHERE tenantId = '${esc(tenantId)}' AND id = '${esc(id)}' RETURN AFTER @this`,
      );
      const row = rows[0];
      if (!row) throw new Error(`Upsert UPDATE returned no record for ${vertexType} id=${id}`);
      return row;
    }
    return this.arcade.insertVertex<T>(vertexType, { ...props, tenantId, id });
  }

  // ---------------------------------------------------------------------------
  // Traversal queries
  // ---------------------------------------------------------------------------

  async accessLineage(tenantId: string, identityId: string): Promise<AccessLineageResult[]> {
    return queryAccessLineage(this.arcade, tenantId, identityId);
  }

  async agentScope(tenantId: string, agentId: string): Promise<AgentScopeResult> {
    return queryAgentScope(this.arcade, tenantId, agentId);
  }

  async delegationPaths(
    tenantId: string,
    fromIdentityId: string,
    toIdentityId?: string,
  ): Promise<DelegationPathResult[]> {
    return queryDelegationPaths(this.arcade, tenantId, fromIdentityId, toIdentityId);
  }

  async riskSurface(tenantId: string, threshold: number): Promise<RiskSurfaceResult[]> {
    return queryRiskSurface(this.arcade, tenantId, threshold);
  }

  async blastRadius(tenantId: string, identityId: string): Promise<BlastRadiusResult> {
    return queryBlastRadius(this.arcade, tenantId, identityId);
  }

  async entitlementOverlap(tenantId: string): Promise<EntitlementOverlapResult[]> {
    return queryEntitlementOverlap(this.arcade, tenantId);
  }
}

// Internal helper — escapes a string value for inline SQL (single-quote safe).
function esc(value: string): string {
  return value.replace(/'/g, "\\'");
}
