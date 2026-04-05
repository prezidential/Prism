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
