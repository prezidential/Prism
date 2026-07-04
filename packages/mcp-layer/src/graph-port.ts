// IdentographPort — the narrow graph surface the MCP tools depend on.
//
// Declared structurally (not imported from @prism/identograph) so the tool core
// stays decoupled from that package's build output and is trivially mockable in
// tests. The real IdentographClient satisfies this port; the concrete wiring
// lives only in `server.ts`.

// A minimal identity record. Traversal results are passed through to JSON, so
// tools only need the common envelope fields plus an open index signature.
export interface IdentityRecord {
  id: string;
  tenantId: string;
  nodeType: string;
  status: string;
  riskScore: number;
  [key: string]: unknown;
}

// Field types below are intentionally wide (unknown[] for passthrough arrays, no
// index signatures) so the richer @prism/identograph result types are structurally
// assignable to them in server.ts without casts.
export interface AgentScopeSummary {
  agentId: string;
  agentType: string;
  model: string;
  declaredScope: Record<string, unknown>;
  totalEvents: number;
  inScopeCount: number;
  outOfScopeCount: number;
  outOfScopeEvents: unknown[];
  deviationScore: number;
}

export interface BlastRadiusSummary {
  identityId: string;
  identityType: string;
  totalResourceCount: number;
  criticalResourceCount: number;
  privilegedEntitlementCount: number;
  totalIdentityCount: number;
  blastRadiusScore: number;
  reachableResources: unknown[];
  reachableIdentities: unknown[];
}

export interface RiskSignalRecord {
  id: string;
  subjectRef: string;
  subjectType: string;
  caepEventType: string;
  eventTypeUri: string;
  score: number;
  severity: string;
  iat: string;
}

// Attributes that may be used for identity attribute lookup. Restricting to an
// allowlist keeps the wiring's inline SQL safe.
export type LookupAttribute = "email" | "employeeId" | "displayName" | "name";

export interface IdentographPort {
  // Look up a single identity by its stable id (searches all vertex classes).
  getIdentityById(tenantId: string, id: string): Promise<IdentityRecord | null>;
  // Find identities whose attribute exactly matches a value.
  findIdentitiesByAttribute(
    tenantId: string,
    attribute: LookupAttribute,
    value: string,
  ): Promise<IdentityRecord[]>;
  // Access-lineage traversal — who reaches what, and through what chain.
  accessLineage(tenantId: string, identityId: string): Promise<unknown[]>;
  // Declared scope vs. observed behavior for an agent.
  agentScope(tenantId: string, agentId: string): Promise<AgentScopeSummary>;
  // Blast radius for an identity.
  blastRadius(tenantId: string, identityId: string): Promise<BlastRadiusSummary>;
  // Risk signals concerning a subject identity.
  listRiskSignals(tenantId: string, subjectRef: string): Promise<RiskSignalRecord[]>;
}
