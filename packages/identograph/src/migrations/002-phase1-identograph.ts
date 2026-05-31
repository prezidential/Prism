// Phase 1 Identograph Core schema additions.
// Adds the 6 core Identograph vertex types and 6 edge types defined in PLAN.md.
// RiskSignal is modeled on OpenID Shared Signals Framework (SSF) / CAEP 1.0.
// Every statement uses IF NOT EXISTS — fully idempotent.

export const id = "002-phase1-identograph";
export const description =
  "Add NHIdentity, Entitlement, Session, Delegation, ExecutionEvent, RiskSignal vertices " +
  "and HAS_ENTITLEMENT, DELEGATES_TO, EXECUTED_BY, OWNS_RESOURCE, TRUSTS, GENERATES_SIGNAL edges";

function baseVertexProps(type: string): string[] {
  return [
    `CREATE PROPERTY ${type}.id IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.tenantId IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.nodeType IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.status IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.riskScore IF NOT EXISTS FLOAT`,
    `CREATE PROPERTY ${type}.lastActivity IF NOT EXISTS DATETIME`,
    `CREATE PROPERTY ${type}.createdAt IF NOT EXISTS DATETIME (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.updatedAt IF NOT EXISTS DATETIME (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.tags IF NOT EXISTS LIST`,
  ];
}

function baseVertexIndexes(type: string): string[] {
  return [`CREATE INDEX IF NOT EXISTS ON ${type} (tenantId, id) UNIQUE`];
}

function baseEdgeProps(type: string): string[] {
  return [
    `CREATE PROPERTY ${type}.tenantId IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.edgeType IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.createdAt IF NOT EXISTS DATETIME`,
  ];
}

export const statements: string[] = [
  // -------------------------------------------------------------------------
  // NHIdentity — non-human identities (IAM users, service principals, API keys)
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE NHIdentity IF NOT EXISTS",
  ...baseVertexProps("NHIdentity"),
  "CREATE PROPERTY NHIdentity.kind IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY NHIdentity.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY NHIdentity.provider IF NOT EXISTS STRING",
  "CREATE PROPERTY NHIdentity.ownerRef IF NOT EXISTS STRING",
  "CREATE PROPERTY NHIdentity.lastRotatedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY NHIdentity.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY NHIdentity.isRotationEnabled IF NOT EXISTS BOOLEAN",
  ...baseVertexIndexes("NHIdentity"),
  "CREATE INDEX IF NOT EXISTS ON NHIdentity (tenantId, provider, kind)",

  // -------------------------------------------------------------------------
  // Entitlement — a permission or capability grantable to any identity
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE Entitlement IF NOT EXISTS",
  ...baseVertexProps("Entitlement"),
  "CREATE PROPERTY Entitlement.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Entitlement.description IF NOT EXISTS STRING",
  "CREATE PROPERTY Entitlement.entitlementType IF NOT EXISTS STRING",
  "CREATE PROPERTY Entitlement.provider IF NOT EXISTS STRING",
  "CREATE PROPERTY Entitlement.resourceRef IF NOT EXISTS STRING",
  "CREATE PROPERTY Entitlement.isPrivileged IF NOT EXISTS BOOLEAN",
  "CREATE PROPERTY Entitlement.riskWeight IF NOT EXISTS FLOAT",
  ...baseVertexIndexes("Entitlement"),
  "CREATE INDEX IF NOT EXISTS ON Entitlement (tenantId, isPrivileged)",

  // -------------------------------------------------------------------------
  // Session — an active or historical access session
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE Session IF NOT EXISTS",
  ...baseVertexProps("Session"),
  "CREATE PROPERTY Session.identityRef IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Session.identityType IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Session.startedAt IF NOT EXISTS DATETIME (mandatory true, notnull true)",
  "CREATE PROPERTY Session.endedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY Session.state IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Session.sourceIp IF NOT EXISTS STRING",
  "CREATE PROPERTY Session.userAgent IF NOT EXISTS STRING",
  "CREATE PROPERTY Session.mfaVerified IF NOT EXISTS BOOLEAN",
  "CREATE PROPERTY Session.revokedReason IF NOT EXISTS STRING",
  ...baseVertexIndexes("Session"),
  "CREATE INDEX IF NOT EXISTS ON Session (tenantId, identityRef, state)",

  // -------------------------------------------------------------------------
  // Delegation — a trust delegation from one identity to another
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE Delegation IF NOT EXISTS",
  ...baseVertexProps("Delegation"),
  "CREATE PROPERTY Delegation.fromIdentityRef IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.fromIdentityType IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.toIdentityRef IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.toIdentityType IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.scope IF NOT EXISTS LIST",
  "CREATE PROPERTY Delegation.grantedAt IF NOT EXISTS DATETIME (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY Delegation.grantedBy IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY Delegation.isTransitive IF NOT EXISTS BOOLEAN",
  "CREATE PROPERTY Delegation.depth IF NOT EXISTS INTEGER",
  ...baseVertexIndexes("Delegation"),
  "CREATE INDEX IF NOT EXISTS ON Delegation (tenantId, fromIdentityRef)",
  "CREATE INDEX IF NOT EXISTS ON Delegation (tenantId, toIdentityRef)",

  // -------------------------------------------------------------------------
  // ExecutionEvent — a recorded action taken by an agent
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE ExecutionEvent IF NOT EXISTS",
  ...baseVertexProps("ExecutionEvent"),
  "CREATE PROPERTY ExecutionEvent.agentRef IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY ExecutionEvent.action IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY ExecutionEvent.targetRef IF NOT EXISTS STRING",
  "CREATE PROPERTY ExecutionEvent.targetType IF NOT EXISTS STRING",
  "CREATE PROPERTY ExecutionEvent.outcome IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY ExecutionEvent.withinDeclaredScope IF NOT EXISTS BOOLEAN",
  "CREATE PROPERTY ExecutionEvent.correlationId IF NOT EXISTS STRING",
  "CREATE PROPERTY ExecutionEvent.executedAt IF NOT EXISTS DATETIME (mandatory true, notnull true)",
  ...baseVertexIndexes("ExecutionEvent"),
  "CREATE INDEX IF NOT EXISTS ON ExecutionEvent (tenantId, agentRef)",
  "CREATE INDEX IF NOT EXISTS ON ExecutionEvent (tenantId, correlationId)",
  "CREATE INDEX IF NOT EXISTS ON ExecutionEvent (tenantId, withinDeclaredScope)",

  // -------------------------------------------------------------------------
  // RiskSignal — SSF/CAEP-modeled risk signal vertex
  // -------------------------------------------------------------------------
  "CREATE VERTEX TYPE RiskSignal IF NOT EXISTS",
  ...baseVertexProps("RiskSignal"),
  // SSF SET fields
  "CREATE PROPERTY RiskSignal.jti IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY RiskSignal.iss IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY RiskSignal.iat IF NOT EXISTS DATETIME (mandatory true, notnull true)",
  // Subject
  "CREATE PROPERTY RiskSignal.subjectRef IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY RiskSignal.subjectType IF NOT EXISTS STRING (mandatory true, notnull true)",
  // CAEP event classification
  "CREATE PROPERTY RiskSignal.caepEventType IF NOT EXISTS STRING (mandatory true, notnull true)",
  "CREATE PROPERTY RiskSignal.eventTypeUri IF NOT EXISTS STRING (mandatory true, notnull true)",
  // Derived risk
  "CREATE PROPERTY RiskSignal.score IF NOT EXISTS FLOAT (mandatory true, notnull true)",
  "CREATE PROPERTY RiskSignal.severity IF NOT EXISTS STRING (mandatory true, notnull true)",
  // CAEP payload stored as JSON string
  "CREATE PROPERTY RiskSignal.eventPayload IF NOT EXISTS STRING",
  "CREATE PROPERTY RiskSignal.resolvedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY RiskSignal.resolvedBy IF NOT EXISTS STRING",
  ...baseVertexIndexes("RiskSignal"),
  "CREATE INDEX IF NOT EXISTS ON RiskSignal (tenantId, jti) UNIQUE",
  "CREATE INDEX IF NOT EXISTS ON RiskSignal (tenantId, subjectRef)",
  "CREATE INDEX IF NOT EXISTS ON RiskSignal (tenantId, score)",
  "CREATE INDEX IF NOT EXISTS ON RiskSignal (tenantId, caepEventType)",

  // -------------------------------------------------------------------------
  // Phase 1 edge types
  // -------------------------------------------------------------------------

  "CREATE EDGE TYPE HAS_ENTITLEMENT IF NOT EXISTS",
  ...baseEdgeProps("HAS_ENTITLEMENT"),
  "CREATE PROPERTY HAS_ENTITLEMENT.grantedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HAS_ENTITLEMENT.grantedBy IF NOT EXISTS STRING",
  "CREATE PROPERTY HAS_ENTITLEMENT.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HAS_ENTITLEMENT.isActive IF NOT EXISTS BOOLEAN",

  "CREATE EDGE TYPE DELEGATES_TO IF NOT EXISTS",
  ...baseEdgeProps("DELEGATES_TO"),
  "CREATE PROPERTY DELEGATES_TO.delegationRef IF NOT EXISTS STRING",
  "CREATE PROPERTY DELEGATES_TO.scope IF NOT EXISTS LIST",
  "CREATE PROPERTY DELEGATES_TO.grantedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY DELEGATES_TO.expiresAt IF NOT EXISTS DATETIME",

  "CREATE EDGE TYPE EXECUTED_BY IF NOT EXISTS",
  ...baseEdgeProps("EXECUTED_BY"),
  "CREATE PROPERTY EXECUTED_BY.executionEventRef IF NOT EXISTS STRING",
  "CREATE PROPERTY EXECUTED_BY.executedAt IF NOT EXISTS DATETIME",

  "CREATE EDGE TYPE OWNS_RESOURCE IF NOT EXISTS",
  ...baseEdgeProps("OWNS_RESOURCE"),
  "CREATE PROPERTY OWNS_RESOURCE.since IF NOT EXISTS DATETIME",
  "CREATE PROPERTY OWNS_RESOURCE.approvedBy IF NOT EXISTS STRING",

  "CREATE EDGE TYPE TRUSTS IF NOT EXISTS",
  ...baseEdgeProps("TRUSTS"),
  "CREATE PROPERTY TRUSTS.trustLevel IF NOT EXISTS STRING",
  "CREATE PROPERTY TRUSTS.conditions IF NOT EXISTS LIST",
  "CREATE PROPERTY TRUSTS.establishedAt IF NOT EXISTS DATETIME",

  "CREATE EDGE TYPE GENERATES_SIGNAL IF NOT EXISTS",
  ...baseEdgeProps("GENERATES_SIGNAL"),
  "CREATE PROPERTY GENERATES_SIGNAL.signalRef IF NOT EXISTS STRING",
  "CREATE PROPERTY GENERATES_SIGNAL.generatedAt IF NOT EXISTS DATETIME",
];
