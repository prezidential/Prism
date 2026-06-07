import type {
  AccessLevel,
  CredentialType,
  EdgeType,
  EmploymentType,
  GrantSource,
  IdentityStatus,
  NodeType,
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
  // Provenance — "why" this access exists.
  grantSource?: GrantSource;
  justification?: string;
  policyRef?: string; // id of the Policy/Role node that authorized the grant
  // Currency — "whether it's still true" for this specific access.
  lastReviewedAt?: string;
}

export interface AssignedRoleEdge extends BaseEdge {
  edgeType: EdgeType.ASSIGNED_ROLE;
  assignedAt: string;
  assignedBy?: string;
  expiresAt?: string;
  certifiedAt?: string;
  // Provenance — "why" this role was assigned.
  grantSource?: GrantSource;
  justification?: string;
  policyRef?: string;
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
  | UsedByEdge;
