export enum NodeType {
  // Phase 0 types
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
  // Phase 1 Identograph core types
  NHIdentity = "NHIdentity",
  Entitlement = "Entitlement",
  Session = "Session",
  Delegation = "Delegation",
  ExecutionEvent = "ExecutionEvent",
  RiskSignal = "RiskSignal",
}

export enum EdgeType {
  // Phase 0 types
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
  // Phase 1 Identograph core edge types
  HAS_ENTITLEMENT = "HAS_ENTITLEMENT",
  DELEGATES_TO = "DELEGATES_TO",
  EXECUTED_BY = "EXECUTED_BY",
  OWNS_RESOURCE = "OWNS_RESOURCE",
  TRUSTS = "TRUSTS",
  GENERATES_SIGNAL = "GENERATES_SIGNAL",
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

export enum NHIdentityKind {
  IAMUser = "IAMUser",
  IAMRole = "IAMRole",
  ServicePrincipal = "ServicePrincipal",
  ManagedIdentity = "ManagedIdentity",
  APIKey = "APIKey",
  ServiceAccount = "ServiceAccount",
}

export enum SessionState {
  Active = "Active",
  Revoked = "Revoked",
  Expired = "Expired",
  Suspended = "Suspended",
}

export enum SignalSeverity {
  Info = "info",
  Warning = "warning",
  Critical = "critical",
}

// CAEP event types per OpenID Shared Signals Framework / CAEP 1.0
export enum CaepEventType {
  SessionRevoked = "session-revoked",
  SessionEstablished = "session-established",
  CredentialChange = "credential-change",
  TokenClaimsChange = "token-claims-change",
  AssuranceLevelChange = "assurance-level-change",
  DeviceComplianceChange = "device-compliance-change",
  RiskLevelChange = "risk-level-change",
}
