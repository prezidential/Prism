// Phase 1 demo seed — creates a representative Identograph for the idem demo.
// Populates the 6 Phase 1 vertex types with realistic data linked to each other.
// Designed to exercise all 6 traversal queries.
// Run via: npm run db:seed

import { ArcadeClient, defaultConfig } from "../db/client.js";
import { CaepEventType, NHIdentityKind, NodeType, SessionState, SignalSeverity } from "../schema/enums.js";

const TENANT_ID = process.env["PRISM_TENANT_ID"] ?? "idem-demo";
const client = new ArcadeClient(defaultConfig());

function uuid(): string {
  return `${rand4()}-${rand4()}-${rand4()}-${rand4()}`;
}

function rand4(): string {
  return Math.random().toString(16).slice(2, 10);
}

function iso(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

async function insert<T extends object>(type: string, props: T): Promise<T & { id: string }> {
  return client.insertVertex<T & { id: string }>(type, props as Record<string, unknown>);
}

export async function seedPhase1Demo(): Promise<void> {
  console.log(`\nSeeding Phase 1 Identograph demo data (tenant: ${TENANT_ID})...\n`);

  // Check idempotency
  try {
    const existing = await client.count("NHIdentity", TENANT_ID);
    if (existing > 0) {
      console.log(`Already seeded: ${existing} NHIdentity vertices found. Skipping.`);
      return;
    }
  } catch {
    // NHIdentity may not exist yet if schema hasn't been applied — proceed
  }

  // -------------------------------------------------------------------------
  // 3 Human Identities
  // -------------------------------------------------------------------------
  const humanBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.HumanIdentity,
    status: "Active",
    riskScore: 0.0,
    lastActivity: iso(0),
    createdAt: iso(365),
    updatedAt: iso(1),
    tags: ["engineering"],
    metadata: {},
    externalIds: {},
    employmentType: "FTE",
    hireDate: iso(730),
  };

  const alice = await insert("HumanIdentity", {
    ...humanBase,
    id: uuid(),
    email: "alice@corp.example.com",
    name: "Alice Nakamura",
    jobTitle: "Security Engineer",
    department: "Security",
    location: "San Francisco",
    riskScore: 0.1,
    employeeId: "EMP-001",
    managerRef: null,
  });
  console.log(`  HumanIdentity: ${alice.name ?? "Alice"} (${alice.id})`);

  const bob = await insert("HumanIdentity", {
    ...humanBase,
    id: uuid(),
    email: "bob@corp.example.com",
    name: "Bob Okonkwo",
    jobTitle: "DevOps Engineer",
    department: "Infrastructure",
    location: "Austin",
    riskScore: 0.25,
    employeeId: "EMP-002",
    managerRef: alice.id,
  });
  console.log(`  HumanIdentity: ${bob.name ?? "Bob"} (${bob.id})`);

  const carol = await insert("HumanIdentity", {
    ...humanBase,
    id: uuid(),
    email: "carol@corp.example.com",
    name: "Carol Zhang",
    jobTitle: "Data Analyst",
    department: "Analytics",
    location: "New York",
    riskScore: 0.05,
    employeeId: "EMP-003",
    managerRef: alice.id,
    tags: ["analytics", "contractor"],
    employmentType: "Contractor",
  });
  console.log(`  HumanIdentity: ${carol.name ?? "Carol"} (${carol.id})`);

  // -------------------------------------------------------------------------
  // 2 Agent Identities
  // -------------------------------------------------------------------------
  const agentBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.AgentIdentity,
    status: "Active",
    lastActivity: iso(0),
    createdAt: iso(30),
    updatedAt: iso(0),
    tags: ["agent"],
    metadata: {},
    externalIds: {},
    credentialType: "OIDC",
    maxLifetimeSeconds: 86400,
  };

  const ingestAgent = await insert("AgentIdentity", {
    ...agentBase,
    id: uuid(),
    agentType: "idem-ingest-agent",
    model: "claude-sonnet-4-6",
    scopeDefinition: {
      allowedNodeTypes: ["HumanIdentity", "NHIdentity", "Resource"],
      allowedOperations: ["read", "write"],
      maxBatchSize: 100,
      requiresHumanApproval: false,
    },
    spawnedAt: iso(30),
    riskScore: 0.15,
    credentialRef: `vault/secret/agents/${TENANT_ID}/idem-ingest-agent`,
    parentAgentRef: null,
  });
  console.log(`  AgentIdentity: idem-ingest-agent (${ingestAgent.id})`);

  const riskAgent = await insert("AgentIdentity", {
    ...agentBase,
    id: uuid(),
    agentType: "idem-risk-agent",
    model: "claude-haiku-4-5",
    scopeDefinition: {
      allowedNodeTypes: ["RiskSignal", "HumanIdentity", "AgentIdentity"],
      allowedOperations: ["read"],
      maxBatchSize: 500,
      requiresHumanApproval: true,
    },
    spawnedAt: iso(15),
    riskScore: 0.05,
    credentialRef: `vault/secret/agents/${TENANT_ID}/idem-risk-agent`,
    parentAgentRef: ingestAgent.id,
  });
  console.log(`  AgentIdentity: idem-risk-agent (${riskAgent.id})`);

  // -------------------------------------------------------------------------
  // 3 NHIdentities (AWS IAM users, service principal, API key)
  // -------------------------------------------------------------------------
  const nhBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.NHIdentity,
    status: "Active",
    lastActivity: iso(3),
    createdAt: iso(180),
    updatedAt: iso(7),
    tags: ["aws"],
    metadata: {},
    externalIds: {},
    riskScore: 0.0,
    isRotationEnabled: true,
  };

  const iamUser = await insert("NHIdentity", {
    ...nhBase,
    id: uuid(),
    kind: NHIdentityKind.IAMUser,
    displayName: "svc-data-pipeline",
    provider: "aws",
    ownerRef: bob.id,
    lastRotatedAt: iso(45),
    riskScore: 0.4, // stale rotation
  });
  console.log(`  NHIdentity: svc-data-pipeline (${iamUser.id})`);

  const lambdaRole = await insert("NHIdentity", {
    ...nhBase,
    id: uuid(),
    kind: NHIdentityKind.IAMRole,
    displayName: "lambda-execution-role",
    provider: "aws",
    ownerRef: null,
    lastRotatedAt: null,
    isRotationEnabled: false,
    riskScore: 0.6,
    tags: ["aws", "lambda", "high-risk"],
  });
  console.log(`  NHIdentity: lambda-execution-role (${lambdaRole.id})`);

  const apiKey = await insert("NHIdentity", {
    ...nhBase,
    id: uuid(),
    kind: NHIdentityKind.APIKey,
    displayName: "analytics-export-key",
    provider: "internal",
    ownerRef: carol.id,
    lastRotatedAt: iso(200), // never rotated — risky
    expiresAt: iso(-30),     // expired 30 days ago
    isRotationEnabled: false,
    riskScore: 0.85,
    tags: ["expired", "high-risk"],
  });
  console.log(`  NHIdentity: analytics-export-key (${apiKey.id})`);

  // -------------------------------------------------------------------------
  // 2 Resources
  // -------------------------------------------------------------------------
  const resourceBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.Resource,
    status: "Active",
    riskScore: 0.0,
    lastActivity: iso(1),
    createdAt: iso(365),
    updatedAt: iso(7),
    tags: [],
    metadata: {},
    externalIds: {},
  };

  const customerDB = await insert("Resource", {
    ...resourceBase,
    id: uuid(),
    displayName: "customer-db",
    resourceType: "database",
    sensitivity: "restricted",
    classification: "PII",
    applicationRef: null,
  });
  console.log(`  Resource: customer-db (${customerDB.id})`);

  const logsS3 = await insert("Resource", {
    ...resourceBase,
    id: uuid(),
    displayName: "logs-s3-bucket",
    resourceType: "cloud-resource",
    sensitivity: "internal",
    classification: "operational",
    applicationRef: null,
  });
  console.log(`  Resource: logs-s3-bucket (${logsS3.id})`);

  // -------------------------------------------------------------------------
  // 4 Entitlements
  // -------------------------------------------------------------------------
  const entBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.Entitlement,
    status: "Active",
    riskScore: 0.0,
    lastActivity: iso(1),
    createdAt: iso(365),
    updatedAt: iso(30),
    tags: [],
    metadata: {},
    externalIds: {},
    provider: "aws",
  };

  const dbAdmin = await insert("Entitlement", {
    ...entBase,
    id: uuid(),
    displayName: "DatabaseAdmin",
    description: "Full read/write access to all databases",
    entitlementType: "iam-policy",
    resourceRef: customerDB.id,
    isPrivileged: true,
    riskWeight: 0.9,
    tags: ["privileged", "dba"],
  });
  console.log(`  Entitlement: DatabaseAdmin (${dbAdmin.id})`);

  const s3ReadOnly = await insert("Entitlement", {
    ...entBase,
    id: uuid(),
    displayName: "S3ReadOnly",
    description: "Read-only access to S3 logs bucket",
    entitlementType: "iam-policy",
    resourceRef: logsS3.id,
    isPrivileged: false,
    riskWeight: 0.1,
    tags: ["read-only"],
  });
  console.log(`  Entitlement: S3ReadOnly (${s3ReadOnly.id})`);

  const lambdaInvoke = await insert("Entitlement", {
    ...entBase,
    id: uuid(),
    displayName: "LambdaInvoke",
    description: "Invoke any Lambda function in the account",
    entitlementType: "iam-policy",
    resourceRef: null,
    isPrivileged: true,
    riskWeight: 0.7,
    tags: ["privileged", "lambda"],
  });
  console.log(`  Entitlement: LambdaInvoke (${lambdaInvoke.id})`);

  const analyticsExport = await insert("Entitlement", {
    ...entBase,
    id: uuid(),
    displayName: "AnalyticsExport",
    description: "Export analytics data including PII fields",
    entitlementType: "scope",
    resourceRef: customerDB.id,
    isPrivileged: true,
    riskWeight: 0.8,
    provider: "internal",
    tags: ["privileged", "pii"],
  });
  console.log(`  Entitlement: AnalyticsExport (${analyticsExport.id})`);

  // -------------------------------------------------------------------------
  // 2 Delegations
  // -------------------------------------------------------------------------
  const delegBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.Delegation,
    status: "Active",
    riskScore: 0.0,
    lastActivity: iso(0),
    createdAt: iso(60),
    updatedAt: iso(60),
    tags: [],
    metadata: {},
    externalIds: {},
    grantedBy: alice.id,
    isTransitive: false,
  };

  const delegation1 = await insert("Delegation", {
    ...delegBase,
    id: uuid(),
    fromIdentityRef: bob.id,
    fromIdentityType: "HumanIdentity",
    toIdentityRef: ingestAgent.id,
    toIdentityType: "AgentIdentity",
    scope: ["read:HumanIdentity", "write:NHIdentity"],
    grantedAt: iso(60),
    expiresAt: iso(-30), // expired — risk signal opportunity
    depth: 1,
    riskScore: 0.5,
  });
  console.log(`  Delegation: bob → ingest-agent (${delegation1.id})`);

  const delegation2 = await insert("Delegation", {
    ...delegBase,
    id: uuid(),
    fromIdentityRef: ingestAgent.id,
    fromIdentityType: "AgentIdentity",
    toIdentityRef: riskAgent.id,
    toIdentityType: "AgentIdentity",
    scope: ["read:RiskSignal"],
    grantedAt: iso(15),
    expiresAt: null,
    depth: 2,
    isTransitive: true, // transitive chain: bob → ingest-agent → risk-agent
    riskScore: 0.3,
  });
  console.log(`  Delegation: ingest-agent → risk-agent (${delegation2.id})`);

  // -------------------------------------------------------------------------
  // 3 Execution Events
  // -------------------------------------------------------------------------
  const eventBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.ExecutionEvent,
    status: "Active",
    riskScore: 0.0,
    lastActivity: iso(0),
    createdAt: iso(1),
    updatedAt: iso(1),
    tags: [],
    metadata: {},
    externalIds: {},
    correlationId: uuid(),
  };

  const event1 = await insert("ExecutionEvent", {
    ...eventBase,
    id: uuid(),
    agentRef: ingestAgent.id,
    action: "read:HumanIdentity",
    targetRef: alice.id,
    targetType: "HumanIdentity",
    outcome: "success",
    withinDeclaredScope: true,
    executedAt: iso(1),
  });
  console.log(`  ExecutionEvent: ingest-agent read:HumanIdentity (${event1.id})`);

  const event2 = await insert("ExecutionEvent", {
    ...eventBase,
    id: uuid(),
    agentRef: ingestAgent.id,
    action: "delete:HumanIdentity", // OUT OF SCOPE — ingest agent can only read
    targetRef: carol.id,
    targetType: "HumanIdentity",
    outcome: "denied",
    withinDeclaredScope: false,
    executedAt: iso(0),
  });
  console.log(`  ExecutionEvent: ingest-agent delete:HumanIdentity [OUT OF SCOPE] (${event2.id})`);

  const event3 = await insert("ExecutionEvent", {
    ...eventBase,
    id: uuid(),
    agentRef: riskAgent.id,
    action: "read:RiskSignal",
    targetRef: null,
    targetType: null,
    outcome: "success",
    withinDeclaredScope: true,
    executedAt: iso(0),
  });
  console.log(`  ExecutionEvent: risk-agent read:RiskSignal (${event3.id})`);

  // -------------------------------------------------------------------------
  // 2 Risk Signals (SSF/CAEP modeled)
  // -------------------------------------------------------------------------
  const signalBase = {
    tenantId: TENANT_ID,
    nodeType: NodeType.RiskSignal,
    status: "Active",
    lastActivity: iso(0),
    createdAt: iso(0),
    updatedAt: iso(0),
    tags: [],
    metadata: {},
    externalIds: {},
    iss: "idem-risk-engine",
  };

  const signal1 = await insert("RiskSignal", {
    ...signalBase,
    id: uuid(),
    jti: uuid(),
    iat: iso(0),
    subjectRef: apiKey.id,
    subjectType: "NHIdentity",
    caepEventType: CaepEventType.CredentialChange,
    eventTypeUri: "https://schemas.openid.net/secevent/caep/event-type/credential-change",
    score: 0.85,
    severity: SignalSeverity.Critical,
    riskScore: 0.85,
    eventPayload: JSON.stringify({
      changeType: "credential-expired",
      credential_type: "api-key",
      daysExpired: 30,
    }),
    resolvedAt: null,
    resolvedBy: null,
  });
  console.log(`  RiskSignal: credential-expired on analytics-export-key [CRITICAL] (${signal1.id})`);

  const signal2 = await insert("RiskSignal", {
    ...signalBase,
    id: uuid(),
    jti: uuid(),
    iat: iso(0),
    subjectRef: ingestAgent.id,
    subjectType: "AgentIdentity",
    caepEventType: CaepEventType.RiskLevelChange,
    eventTypeUri: "https://schemas.openid.net/secevent/caep/event-type/risk-level-change",
    score: 0.6,
    severity: SignalSeverity.Warning,
    riskScore: 0.6,
    eventPayload: JSON.stringify({
      previous_level: "low",
      current_level: "medium",
      reason: "out-of-scope-execution-detected",
      eventRef: event2.id,
    }),
    resolvedAt: null,
    resolvedBy: null,
  });
  console.log(`  RiskSignal: risk-level-change on idem-ingest-agent [WARNING] (${signal2.id})`);

  // -------------------------------------------------------------------------
  // Edges
  // -------------------------------------------------------------------------
  console.log("\nInserting edges...");

  // HAS_ENTITLEMENT edges
  await client.insertEdge("HAS_ENTITLEMENT", "HumanIdentity", bob.id, "Entitlement", dbAdmin.id, {
    grantedAt: iso(180), grantedBy: alice.id, expiresAt: null, isActive: true,
  }, TENANT_ID);
  await client.insertEdge("HAS_ENTITLEMENT", "HumanIdentity", carol.id, "Entitlement", analyticsExport.id, {
    grantedAt: iso(90), grantedBy: alice.id, expiresAt: null, isActive: true,
  }, TENANT_ID);
  await client.insertEdge("HAS_ENTITLEMENT", "HumanIdentity", bob.id, "Entitlement", analyticsExport.id, {
    grantedAt: iso(60), grantedBy: alice.id, expiresAt: null, isActive: true,
  }, TENANT_ID);  // overlap with carol → SoD risk
  await client.insertEdge("HAS_ENTITLEMENT", "NHIdentity", lambdaRole.id, "Entitlement", lambdaInvoke.id, {
    grantedAt: iso(365), grantedBy: alice.id, expiresAt: null, isActive: true,
  }, TENANT_ID);
  await client.insertEdge("HAS_ENTITLEMENT", "AgentIdentity", ingestAgent.id, "Entitlement", s3ReadOnly.id, {
    grantedAt: iso(30), grantedBy: alice.id, expiresAt: null, isActive: true,
  }, TENANT_ID);
  console.log("  HAS_ENTITLEMENT edges: 5");

  // DELEGATES_TO edges
  await client.insertEdge("DELEGATES_TO", "HumanIdentity", bob.id, "AgentIdentity", ingestAgent.id, {
    delegationRef: delegation1.id, scope: ["read:HumanIdentity", "write:NHIdentity"],
    grantedAt: iso(60), expiresAt: iso(-30),
  }, TENANT_ID);
  await client.insertEdge("DELEGATES_TO", "AgentIdentity", ingestAgent.id, "AgentIdentity", riskAgent.id, {
    delegationRef: delegation2.id, scope: ["read:RiskSignal"],
    grantedAt: iso(15), expiresAt: null,
  }, TENANT_ID);
  console.log("  DELEGATES_TO edges: 2");

  // OWNS_RESOURCE edges
  await client.insertEdge("OWNS_RESOURCE", "HumanIdentity", alice.id, "Resource", customerDB.id, {
    since: iso(365), approvedBy: alice.id,
  }, TENANT_ID);
  await client.insertEdge("OWNS_RESOURCE", "HumanIdentity", bob.id, "Resource", logsS3.id, {
    since: iso(180), approvedBy: alice.id,
  }, TENANT_ID);
  console.log("  OWNS_RESOURCE edges: 2");

  // TRUSTS edges
  await client.insertEdge("TRUSTS", "HumanIdentity", alice.id, "AgentIdentity", ingestAgent.id, {
    trustLevel: "partial", conditions: ["within-business-hours"], establishedAt: iso(30),
  }, TENANT_ID);
  console.log("  TRUSTS edges: 1");

  // GENERATES_SIGNAL edges
  await client.insertEdge("GENERATES_SIGNAL", "NHIdentity", apiKey.id, "RiskSignal", signal1.id, {
    signalRef: signal1.id, generatedAt: iso(0),
  }, TENANT_ID);
  await client.insertEdge("GENERATES_SIGNAL", "AgentIdentity", ingestAgent.id, "RiskSignal", signal2.id, {
    signalRef: signal2.id, generatedAt: iso(0),
  }, TENANT_ID);
  console.log("  GENERATES_SIGNAL edges: 2");

  // EXECUTED_BY edges
  await client.insertEdge("EXECUTED_BY", "AgentIdentity", ingestAgent.id, "ExecutionEvent", event1.id, {
    executionEventRef: event1.id, executedAt: event1.executedAt,
  }, TENANT_ID);
  await client.insertEdge("EXECUTED_BY", "AgentIdentity", ingestAgent.id, "ExecutionEvent", event2.id, {
    executionEventRef: event2.id, executedAt: event2.executedAt,
  }, TENANT_ID);
  await client.insertEdge("EXECUTED_BY", "AgentIdentity", riskAgent.id, "ExecutionEvent", event3.id, {
    executionEventRef: event3.id, executedAt: event3.executedAt,
  }, TENANT_ID);
  console.log("  EXECUTED_BY edges: 3");

  console.log(`
Phase 1 demo seed complete:
  HumanIdentity:   3
  AgentIdentity:   2
  NHIdentity:      3
  Resource:        2
  Entitlement:     4
  Delegation:      2
  ExecutionEvent:  3
  RiskSignal:      2
  Total vertices:  21
  Total edges:     15

Open ArcadeDB Studio at http://localhost:2480 to explore the graph.
`);
}

seedPhase1Demo().catch((err: unknown) => {
  console.error("Phase 1 seed failed:", err);
  process.exit(1);
});
