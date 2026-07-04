// Data sources feeding the dashboard.
//
// DemoDataSource returns the bundled fixture so the UI runs standalone (the
// default, and what the demo walkthrough uses). ApiDataSource pulls live risk
// data from the Phase 5 REST API (`GET /api/v1/risk/identities`). The graph and
// agent-scope views need dedicated endpoints that don't exist yet, so the API
// source populates identities + signals and leaves those to be filled in as the
// API grows.

import { DEMO_DATA } from "./demo-data.ts";
import type {
  DashboardData,
  IdentitySummary,
  NodeKind,
  RiskSignalView,
  Severity,
} from "./types.ts";

export interface DataSource {
  load(): Promise<DashboardData>;
}

export class DemoDataSource implements DataSource {
  load(): Promise<DashboardData> {
    return Promise.resolve(DEMO_DATA);
  }
}

function kindForType(type: string): NodeKind {
  if (type === "HumanIdentity") return "human";
  if (type === "AgentIdentity") return "agent";
  return "nhi";
}

interface ApiRiskSignal {
  signalId: string;
  scorer: string | null;
  caepEventType: string;
  score: number;
  severity: string;
  iat: string;
  rationale: string | null;
}

interface ApiRiskIdentity {
  identityId: string;
  identityType: string;
  riskScore: number;
  status: string;
  signals: ApiRiskSignal[];
  signalCount: number;
  highestSeverity: string | null;
}

interface ApiResponse {
  tenantId: string;
  identities: ApiRiskIdentity[];
}

export class ApiDataSource implements DataSource {
  constructor(
    private readonly baseUrl: string,
    private readonly tenantId: string,
  ) {}

  async load(): Promise<DashboardData> {
    const url = `${this.baseUrl}/api/v1/risk/identities?tenantId=${encodeURIComponent(this.tenantId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`risk API failed (HTTP ${res.status})`);
    const body = (await res.json()) as ApiResponse;
    return mapApiResponse(body);
  }
}

// Exported for testing: convert the risk API response into DashboardData.
export function mapApiResponse(body: ApiResponse): DashboardData {
  const identities: IdentitySummary[] = body.identities.map((r) => ({
    id: r.identityId,
    name: r.identityId,
    type: r.identityType,
    kind: kindForType(r.identityType),
    riskScore: r.riskScore,
    status: r.status,
    topSeverity: (r.highestSeverity as Severity | null) ?? null,
    signalCount: r.signalCount,
  }));

  const signals: RiskSignalView[] = body.identities.flatMap((r) =>
    r.signals.map((s) => ({
      id: s.signalId,
      subjectRef: r.identityId,
      subjectName: r.identityId,
      scorer: s.scorer,
      caepEventType: s.caepEventType,
      score: s.score,
      severity: (s.severity as Severity) ?? "info",
      iat: s.iat,
      rationale: s.rationale,
    })),
  );

  return {
    tenantId: body.tenantId,
    generatedAt: new Date().toISOString(),
    identities,
    graph: {
      nodes: identities.map((i) => ({ id: i.id, label: i.name, kind: i.kind, riskScore: i.riskScore })),
      edges: [],
    },
    signals,
    agents: [],
  };
}
