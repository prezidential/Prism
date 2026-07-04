// Bundled demo dataset.
//
// A hand-crafted, self-consistent slice of an Identograph that exercises every
// view and tells a clear governance story: an over-privileged deploy agent
// acting outside its scope, a dormant admin IAM user, a separation-of-duties
// overlap, and a behavioral anomaly. The builder derives per-identity signal
// aggregates from the signal list so nothing drifts out of sync.

import type {
  AgentScopeView,
  DashboardData,
  GraphEdge,
  GraphNode,
  IdentitySummary,
  RiskSignalView,
  Severity,
} from "./types.ts";

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

const nodes: GraphNode[] = [
  { id: "hum-ada", label: "Ada Chen", kind: "human", riskScore: 0.12, subtitle: "CISO" },
  { id: "hum-marcus", label: "Marcus Webb", kind: "human", riskScore: 0.34, subtitle: "SRE" },
  { id: "hum-lena", label: "Lena Ortiz", kind: "human", riskScore: 0.21, subtitle: "Data Eng" },
  { id: "agent-deploy", label: "deploy-copilot", kind: "agent", riskScore: 0.88, subtitle: "claude-sonnet-4" },
  { id: "agent-triage", label: "triage-bot", kind: "agent", riskScore: 0.18, subtitle: "claude-haiku" },
  { id: "agent-analyst", label: "data-analyst-agent", kind: "agent", riskScore: 0.63, subtitle: "claude-sonnet-4" },
  { id: "nhi-ci", label: "ci-deployer", kind: "nhi", riskScore: 0.81, subtitle: "AWS IAM user" },
  { id: "nhi-lambda", label: "lambda-exec-role", kind: "nhi", riskScore: 0.44, subtitle: "AWS IAM role" },
  { id: "ent-admin", label: "AdministratorAccess", kind: "entitlement", riskScore: 0.9, subtitle: "privileged" },
  { id: "ent-s3rw", label: "S3-ReadWrite", kind: "entitlement", riskScore: 0.5, subtitle: "policy" },
  { id: "ent-rdsadmin", label: "RDS-Admin", kind: "entitlement", riskScore: 0.7, subtitle: "privileged" },
  { id: "res-payments", label: "prod-payments-db", kind: "resource", riskScore: 0.0, subtitle: "restricted" },
  { id: "res-pii", label: "customer-pii-bucket", kind: "resource", riskScore: 0.0, subtitle: "confidential" },
  { id: "res-wiki", label: "internal-wiki", kind: "resource", riskScore: 0.0, subtitle: "internal" },
];

const edges: GraphEdge[] = [
  { from: "nhi-ci", to: "ent-admin", label: "HAS_ENTITLEMENT" },
  { from: "nhi-ci", to: "ent-rdsadmin", label: "HAS_ENTITLEMENT" },
  { from: "agent-deploy", to: "ent-admin", label: "HAS_ENTITLEMENT" },
  { from: "agent-deploy", to: "ent-s3rw", label: "HAS_ENTITLEMENT" },
  { from: "agent-analyst", to: "ent-s3rw", label: "HAS_ENTITLEMENT" },
  { from: "nhi-lambda", to: "ent-s3rw", label: "HAS_ENTITLEMENT" },
  { from: "ent-admin", to: "res-payments", label: "GRANTS" },
  { from: "ent-rdsadmin", to: "res-payments", label: "GRANTS" },
  { from: "ent-s3rw", to: "res-pii", label: "GRANTS" },
  { from: "hum-marcus", to: "agent-deploy", label: "SPAWNED" },
  { from: "hum-lena", to: "agent-analyst", label: "SPAWNED" },
  { from: "hum-marcus", to: "nhi-ci", label: "OWNS" },
  { from: "agent-deploy", to: "agent-triage", label: "DELEGATES_TO" },
];

const signals: RiskSignalView[] = [
  {
    id: "sig-1",
    subjectRef: "agent-deploy",
    subjectName: "deploy-copilot",
    scorer: "agent-scope-deviation",
    caepEventType: "risk-level-change",
    score: 0.82,
    severity: "critical",
    iat: "2026-07-04T09:12:00Z",
    rationale: "3/5 observed actions fell outside declared scope; 2 succeeded.",
  },
  {
    id: "sig-2",
    subjectRef: "nhi-ci",
    subjectName: "ci-deployer",
    scorer: "dormant-entitlement",
    caepEventType: "risk-level-change",
    score: 0.86,
    severity: "critical",
    iat: "2026-07-04T08:40:00Z",
    rationale: "Dormant 214 days while holding 2 privileged entitlements.",
  },
  {
    id: "sig-3",
    subjectRef: "agent-deploy",
    subjectName: "deploy-copilot",
    scorer: "blast-radius",
    caepEventType: "risk-level-change",
    score: 0.58,
    severity: "warning",
    iat: "2026-07-04T09:05:00Z",
    rationale: "Reaches 6 resources (2 critical) and 1 downstream identity.",
  },
  {
    id: "sig-4",
    subjectRef: "agent-analyst",
    subjectName: "data-analyst-agent",
    scorer: "behavioral-anomaly",
    caepEventType: "risk-level-change",
    score: 0.61,
    severity: "warning",
    iat: "2026-07-04T07:55:00Z",
    rationale: "Recent behavior deviates from baseline: 4 previously-unseen actions.",
  },
  {
    id: "sig-5",
    subjectRef: "nhi-ci",
    subjectName: "ci-deployer",
    scorer: "entitlement-overlap",
    caepEventType: "risk-level-change",
    score: 0.5,
    severity: "warning",
    iat: "2026-07-03T22:10:00Z",
    rationale: "Shares AdministratorAccess with 1 other identity — SoD concern.",
  },
  {
    id: "sig-6",
    subjectRef: "agent-deploy",
    subjectName: "deploy-copilot",
    scorer: "entitlement-overlap",
    caepEventType: "risk-level-change",
    score: 0.5,
    severity: "warning",
    iat: "2026-07-03T22:10:00Z",
    rationale: "Shares AdministratorAccess with 1 other identity — SoD concern.",
  },
  {
    id: "sig-7",
    subjectRef: "nhi-lambda",
    subjectName: "lambda-exec-role",
    scorer: "blast-radius",
    caepEventType: "risk-level-change",
    score: 0.41,
    severity: "warning",
    iat: "2026-07-03T18:30:00Z",
    rationale: "Reaches 3 resources (1 privileged).",
  },
  {
    id: "sig-8",
    subjectRef: "hum-marcus",
    subjectName: "Marcus Webb",
    scorer: "delegation-depth",
    caepEventType: "token-claims-change",
    score: 0.28,
    severity: "info",
    iat: "2026-07-03T14:00:00Z",
    rationale: "Holds authority via a 2-hop delegation chain.",
  },
];

const agents: AgentScopeView[] = [
  {
    agentId: "agent-deploy",
    agentName: "deploy-copilot",
    model: "claude-sonnet-4",
    declaredScope: ["deploy:service", "read:config", "restart:service"],
    totalEvents: 5,
    inScopeCount: 2,
    outOfScopeCount: 3,
    deviationScore: 0.6,
    outOfScopeEvents: [
      { action: "read:customer-pii-bucket", targetType: "Resource", outcome: "success", executedAt: "2026-07-04T09:11:00Z" },
      { action: "delete:rds-snapshot", targetType: "Resource", outcome: "success", executedAt: "2026-07-04T09:09:00Z" },
      { action: "create:iam-user", targetType: "NHIdentity", outcome: "denied", executedAt: "2026-07-04T09:02:00Z" },
    ],
  },
  {
    agentId: "agent-analyst",
    agentName: "data-analyst-agent",
    model: "claude-sonnet-4",
    declaredScope: ["query:warehouse", "read:s3"],
    totalEvents: 12,
    inScopeCount: 12,
    outOfScopeCount: 0,
    deviationScore: 0,
    outOfScopeEvents: [],
  },
  {
    agentId: "agent-triage",
    agentName: "triage-bot",
    model: "claude-haiku",
    declaredScope: ["read:tickets", "label:ticket"],
    totalEvents: 40,
    inScopeCount: 40,
    outOfScopeCount: 0,
    deviationScore: 0,
    outOfScopeEvents: [],
  },
];

function kindForNode(id: string): IdentitySummary["kind"] {
  const node = nodes.find((n) => n.id === id);
  return node?.kind ?? "resource";
}

// Assemble the DashboardData, deriving each identity's signalCount/topSeverity
// from the signal list.
export function buildDemoData(): DashboardData {
  const identityNodes = nodes.filter(
    (n) => n.kind === "human" || n.kind === "agent" || n.kind === "nhi",
  );

  const identities: IdentitySummary[] = identityNodes.map((n) => {
    const own = signals.filter((s) => s.subjectRef === n.id);
    const topSeverity = own.reduce<Severity | null>((best, s) => {
      if (best === null || SEVERITY_RANK[s.severity] > SEVERITY_RANK[best]) return s.severity;
      return best;
    }, null);
    const typeLabel =
      n.kind === "human" ? "HumanIdentity" : n.kind === "agent" ? "AgentIdentity" : "NHIdentity";
    return {
      id: n.id,
      name: n.label,
      type: typeLabel,
      kind: n.kind,
      riskScore: n.riskScore,
      status: "Active",
      detail: n.subtitle,
      topSeverity,
      signalCount: own.length,
    };
  });

  return {
    tenantId: "demo",
    generatedAt: "2026-07-04T09:15:00Z",
    identities,
    graph: { nodes, edges },
    signals,
    agents,
  };
}

export const DEMO_DATA: DashboardData = buildDemoData();

export { kindForNode };
