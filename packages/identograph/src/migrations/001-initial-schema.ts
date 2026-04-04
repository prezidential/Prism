// Initial Identograph schema for ArcadeDB.
// Creates all 12 vertex types, 10 edge types, properties, and indexes.
// Every statement uses IF NOT EXISTS so this migration is idempotent.

export const id = "001-initial-schema";
export const description = "Create all Identograph vertex types, edge types, properties, and indexes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Base properties shared by all vertex types
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

// Base index for all vertex types - unique per tenant
function baseVertexIndexes(type: string): string[] {
  return [
    `CREATE INDEX IF NOT EXISTS ON ${type} (tenantId, id) UNIQUE`,
  ];
}

// Base properties for all edge types
function baseEdgeProps(type: string): string[] {
  return [
    `CREATE PROPERTY ${type}.tenantId IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.edgeType IF NOT EXISTS STRING (mandatory true, notnull true)`,
    `CREATE PROPERTY ${type}.createdAt IF NOT EXISTS DATETIME`,
  ];
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export const statements: string[] = [

  // -------------------------------------------------------------------------
  // Vertex types: Identities
  // -------------------------------------------------------------------------

  "CREATE VERTEX TYPE HumanIdentity IF NOT EXISTS",
  ...baseVertexProps("HumanIdentity"),
  "CREATE PROPERTY HumanIdentity.employeeId IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.email IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.name IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.jobTitle IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.department IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.location IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.employmentType IF NOT EXISTS STRING",
  "CREATE PROPERTY HumanIdentity.hireDate IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HumanIdentity.terminationDate IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HumanIdentity.managerRef IF NOT EXISTS STRING",
  ...baseVertexIndexes("HumanIdentity"),
  "CREATE INDEX IF NOT EXISTS ON HumanIdentity (tenantId, email) UNIQUE",
  "CREATE INDEX IF NOT EXISTS ON HumanIdentity (tenantId, employeeId) UNIQUE",

  "CREATE VERTEX TYPE ServiceAccount IF NOT EXISTS",
  ...baseVertexProps("ServiceAccount"),
  "CREATE PROPERTY ServiceAccount.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY ServiceAccount.description IF NOT EXISTS STRING",
  "CREATE PROPERTY ServiceAccount.ownerRef IF NOT EXISTS STRING",
  "CREATE PROPERTY ServiceAccount.applicationRef IF NOT EXISTS STRING",
  "CREATE PROPERTY ServiceAccount.lastRotatedAt IF NOT EXISTS DATETIME",
  ...baseVertexIndexes("ServiceAccount"),

  "CREATE VERTEX TYPE AgentIdentity IF NOT EXISTS",
  ...baseVertexProps("AgentIdentity"),
  "CREATE PROPERTY AgentIdentity.agentType IF NOT EXISTS STRING",
  "CREATE PROPERTY AgentIdentity.model IF NOT EXISTS STRING",
  "CREATE PROPERTY AgentIdentity.parentAgentRef IF NOT EXISTS STRING",
  "CREATE PROPERTY AgentIdentity.spawnedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY AgentIdentity.maxLifetimeSeconds IF NOT EXISTS INTEGER",
  "CREATE PROPERTY AgentIdentity.credentialType IF NOT EXISTS STRING",
  "CREATE PROPERTY AgentIdentity.credentialRef IF NOT EXISTS STRING",
  ...baseVertexIndexes("AgentIdentity"),

  "CREATE VERTEX TYPE APIToken IF NOT EXISTS",
  ...baseVertexProps("APIToken"),
  "CREATE PROPERTY APIToken.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY APIToken.ownerRef IF NOT EXISTS STRING",
  "CREATE PROPERTY APIToken.applicationRef IF NOT EXISTS STRING",
  "CREATE PROPERTY APIToken.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY APIToken.scopes IF NOT EXISTS LIST",
  "CREATE PROPERTY APIToken.lastUsedAt IF NOT EXISTS DATETIME",
  ...baseVertexIndexes("APIToken"),

  "CREATE VERTEX TYPE WorkloadIdentity IF NOT EXISTS",
  ...baseVertexProps("WorkloadIdentity"),
  "CREATE PROPERTY WorkloadIdentity.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY WorkloadIdentity.workloadType IF NOT EXISTS STRING",
  "CREATE PROPERTY WorkloadIdentity.namespace IF NOT EXISTS STRING",
  "CREATE PROPERTY WorkloadIdentity.serviceAccountRef IF NOT EXISTS STRING",
  "CREATE PROPERTY WorkloadIdentity.clusterRef IF NOT EXISTS STRING",
  ...baseVertexIndexes("WorkloadIdentity"),

  "CREATE VERTEX TYPE DeviceIdentity IF NOT EXISTS",
  ...baseVertexProps("DeviceIdentity"),
  "CREATE PROPERTY DeviceIdentity.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY DeviceIdentity.deviceType IF NOT EXISTS STRING",
  "CREATE PROPERTY DeviceIdentity.ownerRef IF NOT EXISTS STRING",
  "CREATE PROPERTY DeviceIdentity.managedBy IF NOT EXISTS STRING",
  "CREATE PROPERTY DeviceIdentity.osVersion IF NOT EXISTS STRING",
  "CREATE PROPERTY DeviceIdentity.enrolledAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY DeviceIdentity.isCompliant IF NOT EXISTS BOOLEAN",
  ...baseVertexIndexes("DeviceIdentity"),

  // -------------------------------------------------------------------------
  // Vertex types: Resources
  // -------------------------------------------------------------------------

  "CREATE VERTEX TYPE Application IF NOT EXISTS",
  ...baseVertexProps("Application"),
  "CREATE PROPERTY Application.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Application.appType IF NOT EXISTS STRING",
  "CREATE PROPERTY Application.owner IF NOT EXISTS STRING",
  "CREATE PROPERTY Application.criticality IF NOT EXISTS STRING",
  "CREATE PROPERTY Application.url IF NOT EXISTS STRING",
  ...baseVertexIndexes("Application"),

  "CREATE VERTEX TYPE Resource IF NOT EXISTS",
  ...baseVertexProps("Resource"),
  "CREATE PROPERTY Resource.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Resource.resourceType IF NOT EXISTS STRING",
  "CREATE PROPERTY Resource.applicationRef IF NOT EXISTS STRING",
  "CREATE PROPERTY Resource.sensitivity IF NOT EXISTS STRING",
  "CREATE PROPERTY Resource.classification IF NOT EXISTS STRING",
  ...baseVertexIndexes("Resource"),

  // -------------------------------------------------------------------------
  // Vertex types: Policy
  // -------------------------------------------------------------------------

  "CREATE VERTEX TYPE Role IF NOT EXISTS",
  ...baseVertexProps("Role"),
  "CREATE PROPERTY Role.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Role.description IF NOT EXISTS STRING",
  "CREATE PROPERTY Role.applicationRef IF NOT EXISTS STRING",
  "CREATE PROPERTY Role.permissions IF NOT EXISTS LIST",
  "CREATE PROPERTY Role.isPrivileged IF NOT EXISTS BOOLEAN",
  ...baseVertexIndexes("Role"),

  "CREATE VERTEX TYPE Policy IF NOT EXISTS",
  ...baseVertexProps("Policy"),
  "CREATE PROPERTY Policy.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Policy.policyType IF NOT EXISTS STRING",
  "CREATE PROPERTY Policy.description IF NOT EXISTS STRING",
  "CREATE PROPERTY Policy.isHardBlock IF NOT EXISTS BOOLEAN",
  "CREATE PROPERTY Policy.priority IF NOT EXISTS INTEGER",
  ...baseVertexIndexes("Policy"),

  // -------------------------------------------------------------------------
  // Vertex types: Structural
  // -------------------------------------------------------------------------

  "CREATE VERTEX TYPE Group IF NOT EXISTS",
  ...baseVertexProps("Group"),
  "CREATE PROPERTY Group.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY Group.groupType IF NOT EXISTS STRING",
  "CREATE PROPERTY Group.ownerRef IF NOT EXISTS STRING",
  "CREATE PROPERTY Group.memberCount IF NOT EXISTS INTEGER",
  ...baseVertexIndexes("Group"),

  "CREATE VERTEX TYPE OrgUnit IF NOT EXISTS",
  ...baseVertexProps("OrgUnit"),
  "CREATE PROPERTY OrgUnit.displayName IF NOT EXISTS STRING",
  "CREATE PROPERTY OrgUnit.code IF NOT EXISTS STRING",
  "CREATE PROPERTY OrgUnit.parentOrgUnitRef IF NOT EXISTS STRING",
  "CREATE PROPERTY OrgUnit.headcountApprox IF NOT EXISTS INTEGER",
  ...baseVertexIndexes("OrgUnit"),

  // -------------------------------------------------------------------------
  // Edge types
  // -------------------------------------------------------------------------

  "CREATE EDGE TYPE HAS_ACCESS IF NOT EXISTS",
  ...baseEdgeProps("HAS_ACCESS"),
  "CREATE PROPERTY HAS_ACCESS.grantedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HAS_ACCESS.grantedBy IF NOT EXISTS STRING",
  "CREATE PROPERTY HAS_ACCESS.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY HAS_ACCESS.accessLevel IF NOT EXISTS STRING",
  "CREATE PROPERTY HAS_ACCESS.lastUsed IF NOT EXISTS DATETIME",

  "CREATE EDGE TYPE ASSIGNED_ROLE IF NOT EXISTS",
  ...baseEdgeProps("ASSIGNED_ROLE"),
  "CREATE PROPERTY ASSIGNED_ROLE.assignedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY ASSIGNED_ROLE.assignedBy IF NOT EXISTS STRING",
  "CREATE PROPERTY ASSIGNED_ROLE.expiresAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY ASSIGNED_ROLE.certifiedAt IF NOT EXISTS DATETIME",

  "CREATE EDGE TYPE MEMBER_OF IF NOT EXISTS",
  ...baseEdgeProps("MEMBER_OF"),
  "CREATE PROPERTY MEMBER_OF.joinedAt IF NOT EXISTS DATETIME",
  "CREATE PROPERTY MEMBER_OF.addedBy IF NOT EXISTS STRING",

  "CREATE EDGE TYPE REPORTS_TO IF NOT EXISTS",
  ...baseEdgeProps("REPORTS_TO"),
  "CREATE PROPERTY REPORTS_TO.effectiveDate IF NOT EXISTS DATETIME",
  "CREATE PROPERTY REPORTS_TO.source IF NOT EXISTS STRING",

  "CREATE EDGE TYPE OWNS IF NOT EXISTS",
  ...baseEdgeProps("OWNS"),
  "CREATE PROPERTY OWNS.since IF NOT EXISTS DATETIME",
  "CREATE PROPERTY OWNS.approvedBy IF NOT EXISTS STRING",

  "CREATE EDGE TYPE SPAWNED IF NOT EXISTS",
  ...baseEdgeProps("SPAWNED"),
  "CREATE PROPERTY SPAWNED.at IF NOT EXISTS DATETIME",
  "CREATE PROPERTY SPAWNED.parentCorrelationId IF NOT EXISTS STRING",

  "CREATE EDGE TYPE GOVERNS IF NOT EXISTS",
  ...baseEdgeProps("GOVERNS"),
  "CREATE PROPERTY GOVERNS.effectiveDate IF NOT EXISTS DATETIME",
  "CREATE PROPERTY GOVERNS.priority IF NOT EXISTS INTEGER",

  "CREATE EDGE TYPE PEER_OF IF NOT EXISTS",
  ...baseEdgeProps("PEER_OF"),
  "CREATE PROPERTY PEER_OF.similarityScore IF NOT EXISTS FLOAT",
  "CREATE PROPERTY PEER_OF.basisAttributes IF NOT EXISTS LIST",

  "CREATE EDGE TYPE CREATED_BY IF NOT EXISTS",
  ...baseEdgeProps("CREATED_BY"),
  "CREATE PROPERTY CREATED_BY.at IF NOT EXISTS DATETIME",
  "CREATE PROPERTY CREATED_BY.via IF NOT EXISTS STRING",

  "CREATE EDGE TYPE USED_BY IF NOT EXISTS",
  ...baseEdgeProps("USED_BY"),
  "CREATE PROPERTY USED_BY.lastSeen IF NOT EXISTS DATETIME",
  "CREATE PROPERTY USED_BY.callCount IF NOT EXISTS INTEGER",
];
