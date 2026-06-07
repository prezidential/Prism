export enum NodeType {
  HumanIdentity = "HumanIdentity",
  ServiceAccount = "ServiceAccount",
  AgentIdentity = "AgentIdentity",
  APIToken = "APIToken",
  WorkloadIdentity = "WorkloadIdentity",
  DeviceIdentity = "DeviceIdentity",
  Application = "Application",
  Resource = "Resource",
  Role = "Role",
  Policy = "Policy",
  Group = "Group",
  OrgUnit = "OrgUnit",
}

export enum EdgeType {
  HAS_ACCESS = "HAS_ACCESS",
  ASSIGNED_ROLE = "ASSIGNED_ROLE",
  MEMBER_OF = "MEMBER_OF",
  REPORTS_TO = "REPORTS_TO",
  OWNS = "OWNS",
  SPAWNED = "SPAWNED",
  GOVERNS = "GOVERNS",
  PEER_OF = "PEER_OF",
  CREATED_BY = "CREATED_BY",
  USED_BY = "USED_BY",
}

export enum IdentityStatus {
  Active = "Active",
  Inactive = "Inactive",
  Suspended = "Suspended",
  Orphaned = "Orphaned",
  PendingReview = "PendingReview",
}

export enum EmploymentType {
  FTE = "FTE",
  Contractor = "Contractor",
  Vendor = "Vendor",
  Partner = "Partner",
}

export enum CredentialType {
  OAuth = "OAuth",
  APIKey = "APIKey",
  mTLS = "mTLS",
  OIDC = "OIDC",
}

export enum AccessLevel {
  Read = "Read",
  Write = "Write",
  Admin = "Admin",
  Owner = "Owner",
}

/**
 * Provenance of an access or role grant — the "why" behind an edge. This is what
 * lets the graph answer not just who-has-what, but how that access came to exist,
 * so AI layers reasoning over the graph can distinguish a deliberate, justified
 * grant from an unexamined one ingested without context.
 */
export enum GrantSource {
  BirthrightPolicy = "BirthrightPolicy", // auto-provisioned by a role/policy (RBAC/ABAC)
  AccessRequest = "AccessRequest", // user-requested and approved
  ManualGrant = "ManualGrant", // granted directly by an admin
  Inherited = "Inherited", // received via group/role nesting
  Unknown = "Unknown", // ingested without provenance metadata
}
