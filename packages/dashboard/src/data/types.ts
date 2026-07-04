// View models for the dashboard. These are UI-shaped projections of the
// Identograph — deliberately independent of the backend wire types so the demo
// data source and the live API data source can both produce them.

export type Severity = "info" | "warning" | "critical";

export type NodeKind = "human" | "agent" | "nhi" | "resource" | "entitlement";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  riskScore: number; // 0..1
  subtitle?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string; // edge type, e.g. HAS_ENTITLEMENT
}

export interface IdentitySummary {
  id: string;
  name: string;
  type: string; // vertex class label, e.g. "AgentIdentity"
  kind: NodeKind;
  riskScore: number;
  status: string;
  detail?: string; // department / provider / model
  topSeverity: Severity | null;
  signalCount: number;
}

export interface RiskSignalView {
  id: string;
  subjectRef: string;
  subjectName: string;
  scorer: string | null;
  caepEventType: string;
  score: number;
  severity: Severity;
  iat: string; // ISO8601
  rationale: string | null;
}

export interface ScopeEvent {
  action: string;
  targetType: string | null;
  outcome: string;
  executedAt: string;
}

export interface AgentScopeView {
  agentId: string;
  agentName: string;
  model: string;
  declaredScope: string[];
  totalEvents: number;
  inScopeCount: number;
  outOfScopeCount: number;
  deviationScore: number; // 0..1
  outOfScopeEvents: ScopeEvent[];
}

export interface DashboardData {
  tenantId: string;
  generatedAt: string;
  identities: IdentitySummary[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  signals: RiskSignalView[];
  agents: AgentScopeView[];
}
