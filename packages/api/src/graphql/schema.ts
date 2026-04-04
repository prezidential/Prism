// GraphQL schema definition for the Identograph read API.
// Mirrors the 12 vertex types and 10 edge types from the Identograph spec.

export const typeDefs = /* GraphQL */ `
  # ---------------------------------------------------------------------------
  # Enums
  # ---------------------------------------------------------------------------

  enum NodeType {
    HumanIdentity
    ServiceAccount
    AgentIdentity
    APIToken
    WorkloadIdentity
    DeviceIdentity
    Application
    Resource
    Role
    Policy
    Group
    OrgUnit
  }

  enum IdentityStatus {
    Active
    Inactive
    Suspended
    Orphaned
    PendingReview
  }

  enum EmploymentType {
    FTE
    Contractor
    Vendor
    Partner
  }

  enum CredentialType {
    OAuth
    APIKey
    mTLS
    OIDC
  }

  enum AccessLevel {
    Read
    Write
    Admin
    Owner
  }

  enum ResourceSensitivity {
    public
    internal
    confidential
    restricted
  }

  enum AppCriticality {
    low
    medium
    high
    critical
  }

  # ---------------------------------------------------------------------------
  # Shared base fields (represented as an interface)
  # ---------------------------------------------------------------------------

  interface IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
  }

  # ---------------------------------------------------------------------------
  # Identity node types
  # ---------------------------------------------------------------------------

  type HumanIdentity implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    employeeId: String
    email: String
    name: String
    jobTitle: String
    department: String
    location: String
    employmentType: EmploymentType
    hireDate: String
    terminationDate: String
    managerRef: String
  }

  type ServiceAccount implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    description: String
    ownerRef: String
    applicationRef: String
    lastRotatedAt: String
  }

  type AgentIdentity implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    agentType: String
    model: String
    parentAgentRef: String
    spawnedAt: String
    maxLifetimeSeconds: Int
    credentialType: CredentialType
    credentialRef: String
  }

  type APIToken implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    ownerRef: String
    applicationRef: String
    expiresAt: String
    scopes: [String!]!
    lastUsedAt: String
  }

  type WorkloadIdentity implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    workloadType: String
    namespace: String
    serviceAccountRef: String
    clusterRef: String
  }

  type DeviceIdentity implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    deviceType: String
    ownerRef: String
    managedBy: String
    osVersion: String
    enrolledAt: String
    isCompliant: Boolean
  }

  type Application implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    appType: String
    owner: String
    criticality: AppCriticality
    url: String
  }

  type Resource implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    resourceType: String
    applicationRef: String
    sensitivity: ResourceSensitivity
    classification: String
  }

  type Role implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    description: String
    applicationRef: String
    permissions: [String!]!
    isPrivileged: Boolean
  }

  type Policy implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    policyType: String
    description: String
    isHardBlock: Boolean
    priority: Int
  }

  type Group implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    groupType: String
    ownerRef: String
    memberCount: Int
  }

  type OrgUnit implements IdentityNode {
    id: ID!
    tenantId: String!
    nodeType: NodeType!
    status: IdentityStatus!
    riskScore: Float
    lastActivity: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]!
    displayName: String
    code: String
    parentOrgUnitRef: String
    headcountApprox: Int
  }

  # Union of all node types for mixed-type queries
  union AnyNode =
    HumanIdentity | ServiceAccount | AgentIdentity | APIToken |
    WorkloadIdentity | DeviceIdentity | Application | Resource |
    Role | Policy | Group | OrgUnit

  # ---------------------------------------------------------------------------
  # Edge result types (flattened for GraphQL - no graph traversal for Phase 1)
  # ---------------------------------------------------------------------------

  type AccessGrant {
    resource: Resource
    accessLevel: AccessLevel
    grantedAt: String
    expiresAt: String
    lastUsed: String
  }

  type RoleAssignment {
    role: Role
    assignedAt: String
    expiresAt: String
    certifiedAt: String
  }

  # ---------------------------------------------------------------------------
  # Queries
  # ---------------------------------------------------------------------------

  type Query {
    # Fetch a single node by ID (searches all types)
    node(id: ID!, tenantId: String): AnyNode

    # Paginated list of human identities with optional filters
    humans(
      tenantId: String
      status: IdentityStatus
      department: String
      employmentType: EmploymentType
      limit: Int
      offset: Int
    ): [HumanIdentity!]!

    # Fetch a single human by ID
    human(id: ID!, tenantId: String): HumanIdentity

    # Paginated list of service accounts
    serviceAccounts(
      tenantId: String
      status: IdentityStatus
      limit: Int
      offset: Int
    ): [ServiceAccount!]!

    # All agent identities
    agentIdentities(
      tenantId: String
      status: IdentityStatus
      agentType: String
      limit: Int
      offset: Int
    ): [AgentIdentity!]!

    # All applications
    applications(tenantId: String, limit: Int, offset: Int): [Application!]!

    # All resources with optional sensitivity filter
    resources(
      tenantId: String
      sensitivity: ResourceSensitivity
      limit: Int
      offset: Int
    ): [Resource!]!

    # All roles, optionally filtered to privileged only
    roles(tenantId: String, privilegedOnly: Boolean, limit: Int, offset: Int): [Role!]!

    # Identities with elevated risk scores
    highRiskIdentities(
      tenantId: String
      minRiskScore: Float
      nodeType: NodeType
      limit: Int
    ): [AnyNode!]!

    # Full-text search across identity displayName/name/email fields
    searchIdentities(query: String!, tenantId: String, limit: Int): [AnyNode!]!

    # Graph stats for a tenant
    stats(tenantId: String): IdentographStats!
  }

  type IdentographStats {
    tenantId: String!
    humanCount: Int!
    serviceAccountCount: Int!
    agentCount: Int!
    applicationCount: Int!
    resourceCount: Int!
    roleCount: Int!
    groupCount: Int!
    orgUnitCount: Int!
  }
`;
