import type {
  AccessLevel,
  CaepEventType,
  CredentialType,
  EdgeType,
  EmploymentType,
  IdentityStatus,
  NHIdentityKind,
  NodeType,
  SessionState,
  SignalSeverity,
} from "./enums.js";

// ---------------------------------------------------------------------------
// Base node - all identity nodes share these fields
// ---------------------------------------------------------------------------

export interface BaseNode {
  id: string;
  tenantId: string;
  nodeType: NodeType;
  externalIds: Record<string, string>; // sourceSystem -> externalId
  createdAt: string; // ISO8601
  updatedAt: string;
  status: IdentityStatus;
  riskScore: number; // 0.0 - 1.0
  lastActivity: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Identity node types
// ---------------------------------------------------------------------------

export interface HumanIdentity extends BaseNode {
  nodeType: NodeType.HumanIdentity;
  employeeId: string;
  email: string;
  name: string;
  jobTitle: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  hireDate: string;
  terminationDate?: string;
  managerRef?: string; // -> HumanIdentity.id
}

export interface ServiceAccount extends BaseNode {
  nodeType: NodeType.ServiceAccount;
  displayName: string;
  description: string;
  ownerRef?: string; // -> HumanIdentity.id
  applicationRef?: string; // -> Application.id
  lastRotatedAt?: string;
}

export interface AgentIdentity extends BaseNode {
  nodeType: NodeType.AgentIdentity;
  agentType: string;
  model: string;
  scopeDefinition: Record<string, unknown>;
  parentAgentRef?: string;
  spawnedAt: string;
  maxLifetimeSeconds: number;
  credentialType: CredentialType;
  credentialRef: string; // pointer to secrets manager - never the secret itself
}

export interface APIToken extends BaseNode {
  nodeType: NodeType.APIToken;
  displayName: string;
  ownerRef?: string;
  applicationRef?: string;
  expiresAt?: string;
  scopes: string[];
  lastUsedAt?: string;
}

export interface WorkloadIdentity extends BaseNode {
  nodeType: NodeType.WorkloadIdentity;
  displayName: string;
  workloadType: string; // "kubernetes-pod" | "lambda-function" | "container" | ...
  namespace?: string;
  serviceAccountRef?: string;
  clusterRef?: string;
}

export interface DeviceIdentity extends BaseNode {
  nodeType: NodeType.DeviceIdentity;
  displayName: string;
  deviceType: string; // "managed-laptop" | "iot-endpoint" | ...
  ownerRef?: string;
  managedBy?: string;
  osVersion?: string;
  enrolledAt: string;
  isCompliant: boolean;
}

// ---------------------------------------------------------------------------
// Resource node types
// ---------------------------------------------------------------------------

export interface Application extends BaseNode {
  nodeType: NodeType.Application;
  displayName: string;
  appType: string; // "saas" | "internal" | "api"
  owner?: string;
  criticality: "low" | "medium" | "high" | "critical";
  url?: string;
}

export interface Resource extends BaseNode {
  nodeType: NodeType.Resource;
  displayName: string;
  resourceType: string; // "database" | "file" | "api" | "cloud-resource"
  applicationRef?: string;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  classification?: string;
}

// ---------------------------------------------------------------------------
// Policy node types
// ---------------------------------------------------------------------------

export interface Role extends BaseNode {
  nodeType: NodeType.Role;
  displayName: string;
  description: string;
  applicationRef?: string;
  permissions: string[];
  isPrivileged: boolean;
}

export interface Policy extends BaseNode {
  nodeType: NodeType.Policy;
  displayName: string;
  policyType: string; // "SoD" | "LeastPrivilege" | "TimeBound" | "Regulatory" | ...
  description: string;
  isHardBlock: boolean;
  priority: number;
  ruleDefinition: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Structural node types
// ---------------------------------------------------------------------------

export interface Group extends BaseNode {
  nodeType: NodeType.Group;
  displayName: string;
  groupType: string; // "security" | "distribution" | "org"
  ownerRef?: string;
  memberCount: number;
}

export interface OrgUnit extends BaseNode {
  nodeType: NodeType.OrgUnit;
  displayName: string;
  code: string;
  parentOrgUnitRef?: string;
  headcountApprox: number;
}

// Union of all node types
export type IdentityNode =
  | HumanIdentity
  | ServiceAccount
  | AgentIdentity
  | APIToken
  | WorkloadIdentity
  | DeviceIdentity
  | Application
  | Resource
  | Role
  | Policy
  | Group
  | OrgUnit;

// ---------------------------------------------------------------------------
// Edge types
// ---------------------------------------------------------------------------

export interface BaseEdge {
  id: string;
  tenantId: string;
  edgeType: EdgeType;
  fromId: string;
  toId: string;
  createdAt: string;
}

export interface HasAccessEdge extends BaseEdge {
  edgeType: EdgeType.HAS_ACCESS;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
  accessLevel: AccessLevel;
  lastUsed?: string;
}

export interface AssignedRoleEdge extends BaseEdge {
  edgeType: EdgeType.ASSIGNED_ROLE;
  assignedAt: string;
  assignedBy?: string;
  expiresAt?: string;
  certifiedAt?: string;
}

export interface MemberOfEdge extends BaseEdge {
  edgeType: EdgeType.MEMBER_OF;
  joinedAt: string;
  addedBy?: string;
}

export interface ReportsToEdge extends BaseEdge {
  edgeType: EdgeType.REPORTS_TO;
  effectiveDate: string;
  source: string;
}

export interface OwnsEdge extends BaseEdge {
  edgeType: EdgeType.OWNS;
  since: string;
  approvedBy?: string;
}

export interface SpawnedEdge extends BaseEdge {
  edgeType: EdgeType.SPAWNED;
  at: string;
  parentCorrelationId?: string;
}

export interface GovernsEdge extends BaseEdge {
  edgeType: EdgeType.GOVERNS;
  effectiveDate: string;
  priority: number;
}

export interface PeerOfEdge extends BaseEdge {
  edgeType: EdgeType.PEER_OF;
  similarityScore: number;
  basisAttributes: string[];
}

export interface CreatedByEdge extends BaseEdge {
  edgeType: EdgeType.CREATED_BY;
  at: string;
  via?: string;
}

export interface UsedByEdge extends BaseEdge {
  edgeType: EdgeType.USED_BY;
  lastSeen?: string;
  callCount: number;
}

export type IdentityEdge =
  | HasAccessEdge
  | AssignedRoleEdge
  | MemberOfEdge
  | ReportsToEdge
  | OwnsEdge
  | SpawnedEdge
  | GovernsEdge
  | PeerOfEdge
  | CreatedByEdge
  | UsedByEdge
  | HasEntitlementEdge
  | DelegatesToEdge
  | ExecutedByEdge
  | OwnsResourceEdge
  | TrustsEdge
  | GeneratesSignalEdge;

// ---------------------------------------------------------------------------
// Phase 1 — Identograph Core vertex types
// ---------------------------------------------------------------------------

// Non-human identity: IAM users, service principals, managed identities, API keys
export interface NHIdentity extends BaseNode {
  nodeType: NodeType.NHIdentity;
  kind: NHIdentityKind;
  displayName: string;
  provider: string;        // "aws" | "azure" | "gcp" | "okta" | ...
  ownerRef?: string;       // -> HumanIdentity.id or AgentIdentity.id
  lastRotatedAt?: string;
  expiresAt?: string;
  isRotationEnabled: boolean;
}

// A permission or capability that can be granted to an identity
export interface Entitlement extends BaseNode {
  nodeType: NodeType.Entitlement;
  displayName: string;
  description: string;
  entitlementType: string; // "iam-policy" | "role" | "scope" | "permission" | ...
  provider: string;
  resourceRef?: string;    // -> Resource.id
  isPrivileged: boolean;
  riskWeight: number;      // 0.0–1.0 contribution to risk score
}

// An active or historical access session
export interface Session extends BaseNode {
  nodeType: NodeType.Session;
  identityRef: string;     // -> any identity vertex id
  identityType: string;    // which vertex class
  startedAt: string;
  endedAt?: string;
  state: SessionState;
  sourceIp?: string;
  userAgent?: string;
  mfaVerified: boolean;
  revokedReason?: string;
}

// A trust delegation from one identity to another
export interface Delegation extends BaseNode {
  nodeType: NodeType.Delegation;
  fromIdentityRef: string; // who delegated
  fromIdentityType: string;
  toIdentityRef: string;   // who received the delegation
  toIdentityType: string;
  scope: string[];         // what is delegated
  grantedAt: string;
  expiresAt?: string;
  grantedBy: string;       // -> HumanIdentity.id
  isTransitive: boolean;   // can the delegate further delegate?
  depth: number;           // hops from original principal
}

// A recorded action taken by an agent identity
export interface ExecutionEvent extends BaseNode {
  nodeType: NodeType.ExecutionEvent;
  agentRef: string;        // -> AgentIdentity.id
  action: string;          // what the agent did
  targetRef?: string;      // the resource or identity acted upon
  targetType?: string;
  outcome: "success" | "failure" | "denied";
  withinDeclaredScope: boolean;
  correlationId: string;   // links events in the same agent session
  executedAt: string;
}

// A risk signal generated from Identograph traversal, modeled on SSF/CAEP SET
export interface RiskSignal extends BaseNode {
  nodeType: NodeType.RiskSignal;
  // SSF Security Event Token (SET) fields
  jti: string;             // JWT ID — unique signal identifier
  iss: string;             // issuer component that generated this signal
  iat: string;             // issued at (ISO8601)
  // Subject — the identity this signal concerns
  subjectRef: string;      // vertex id
  subjectType: string;     // vertex class name
  // CAEP event classification
  caepEventType: CaepEventType;
  eventTypeUri: string;    // full URI, e.g. https://schemas.openid.net/secevent/caep/event-type/risk-level-change
  // Derived risk score
  score: number;           // 0.0–1.0
  severity: SignalSeverity;
  // CAEP event payload (arbitrary per event type)
  eventPayload: Record<string, unknown>;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ---------------------------------------------------------------------------
// Phase 1 — Identograph Core edge types
// ---------------------------------------------------------------------------

export interface HasEntitlementEdge extends BaseEdge {
  edgeType: EdgeType.HAS_ENTITLEMENT;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface DelegatesToEdge extends BaseEdge {
  edgeType: EdgeType.DELEGATES_TO;
  delegationRef: string;   // -> Delegation.id
  scope: string[];
  grantedAt: string;
  expiresAt?: string;
}

export interface ExecutedByEdge extends BaseEdge {
  edgeType: EdgeType.EXECUTED_BY;
  executionEventRef: string; // -> ExecutionEvent.id
  executedAt: string;
}

export interface OwnsResourceEdge extends BaseEdge {
  edgeType: EdgeType.OWNS_RESOURCE;
  since: string;
  approvedBy?: string;
}

export interface TrustsEdge extends BaseEdge {
  edgeType: EdgeType.TRUSTS;
  trustLevel: "full" | "partial" | "conditional";
  conditions?: string[];
  establishedAt: string;
}

export interface GeneratesSignalEdge extends BaseEdge {
  edgeType: EdgeType.GENERATES_SIGNAL;
  signalRef: string;       // -> RiskSignal.id
  generatedAt: string;
}
