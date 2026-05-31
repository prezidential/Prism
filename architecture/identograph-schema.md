# Identograph Schema — ArcadeDB

> Authoritative reference for all vertex and edge classes in the Identograph.
> All other documentation defers to this file.

---

## Vertex Classes

### Phase 0 — Foundation

These vertex types were established in Phase 0 scaffolding and represent the richer identity
model used by the ingestion pipeline and seed data generators.

| Vertex Type      | Purpose                                              |
|------------------|------------------------------------------------------|
| `HumanIdentity`  | Employees, contractors, partners                     |
| `ServiceAccount` | Service accounts owned by applications or humans     |
| `AgentIdentity`  | AI agent instances (LLMs, automation bots)           |
| `APIToken`       | API tokens and OAuth clients                         |
| `WorkloadIdentity` | Kubernetes pods, Lambda functions, containers      |
| `DeviceIdentity` | Managed laptops, IoT endpoints                       |
| `Application`    | SaaS or internal applications                        |
| `Resource`       | Databases, files, APIs, cloud resources              |
| `Role`           | Application roles with permission sets               |
| `Policy`         | SoD, LeastPrivilege, TimeBound, Regulatory policies  |
| `Group`          | Security or distribution groups                      |
| `OrgUnit`        | Organizational units                                 |

### Phase 1 — Identograph Core

These are the canonical Identograph vertex types from the PLAN.md specification.

#### `HumanIdentity`
Human users, employees, contractors.

| Field            | Type     | Notes                              |
|------------------|----------|------------------------------------|
| `id`             | STRING   | UUID, unique per tenant            |
| `tenantId`       | STRING   | Tenant partition key               |
| `nodeType`       | STRING   | `"HumanIdentity"`                  |
| `email`          | STRING   | Unique per tenant                  |
| `employeeId`     | STRING   | HRIS employee ID                   |
| `name`           | STRING   |                                    |
| `jobTitle`       | STRING   |                                    |
| `department`     | STRING   |                                    |
| `employmentType` | STRING   | `FTE \| Contractor \| Vendor \| Partner` |
| `riskScore`      | FLOAT    | 0.0–1.0                            |
| `status`         | STRING   | `Active \| Inactive \| Suspended \| Orphaned \| PendingReview` |
| `createdAt`      | DATETIME |                                    |
| `updatedAt`      | DATETIME |                                    |
| `managerRef`     | STRING   | → HumanIdentity.id                 |

#### `AgentIdentity`
AI agent instances — LLM agents, automation bots, AI workers.

| Field                | Type     | Notes                           |
|----------------------|----------|---------------------------------|
| `id`                 | STRING   | UUID                            |
| `agentType`          | STRING   | e.g. `"idem-ingest-agent"`      |
| `model`              | STRING   | e.g. `"claude-sonnet-4-6"`      |
| `scopeDefinition`    | STRING   | JSON — declared allowed actions |
| `credentialType`     | STRING   | `OAuth \| APIKey \| mTLS \| OIDC` |
| `credentialRef`      | STRING   | Vault path — never the secret   |
| `spawnedAt`          | DATETIME |                                 |
| `maxLifetimeSeconds` | INTEGER  |                                 |
| `parentAgentRef`     | STRING   | → AgentIdentity.id (optional)   |
| `riskScore`          | FLOAT    | 0.0–1.0                         |

#### `NHIdentity`
Non-human identities: IAM users, service principals, managed identities, API keys.

| Field               | Type     | Notes                                                       |
|---------------------|----------|-------------------------------------------------------------|
| `id`                | STRING   | UUID                                                        |
| `kind`              | STRING   | `IAMUser \| IAMRole \| ServicePrincipal \| ManagedIdentity \| APIKey \| ServiceAccount` |
| `displayName`       | STRING   |                                                             |
| `provider`          | STRING   | `"aws" \| "azure" \| "gcp" \| "okta" \| "internal"`        |
| `ownerRef`          | STRING   | → HumanIdentity.id or AgentIdentity.id                      |
| `lastRotatedAt`     | DATETIME | null = never rotated                                        |
| `expiresAt`         | DATETIME | null = non-expiring                                         |
| `isRotationEnabled` | BOOLEAN  |                                                             |
| `riskScore`         | FLOAT    | 0.0–1.0                                                     |

#### `Resource`
AWS services, applications, data stores.

| Field            | Type   | Notes                                                  |
|------------------|--------|--------------------------------------------------------|
| `displayName`    | STRING |                                                        |
| `resourceType`   | STRING | `"database" \| "file" \| "api" \| "cloud-resource"`   |
| `sensitivity`    | STRING | `"public" \| "internal" \| "confidential" \| "restricted"` |
| `classification` | STRING | e.g. `"PII"`, `"PHI"`                                 |
| `applicationRef` | STRING | → Application.id (optional)                           |

#### `Entitlement`
Permissions or capabilities that can be granted to any identity.

| Field             | Type    | Notes                                               |
|-------------------|---------|-----------------------------------------------------|
| `displayName`     | STRING  |                                                     |
| `description`     | STRING  |                                                     |
| `entitlementType` | STRING  | `"iam-policy" \| "role" \| "scope" \| "permission"` |
| `provider`        | STRING  | e.g. `"aws"`, `"internal"`                          |
| `resourceRef`     | STRING  | → Resource.id (optional)                            |
| `isPrivileged`    | BOOLEAN |                                                     |
| `riskWeight`      | FLOAT   | 0.0–1.0 contribution to risk score                  |

#### `Session`
Active or historical access sessions.

| Field          | Type     | Notes                                         |
|----------------|----------|-----------------------------------------------|
| `identityRef`  | STRING   | → any identity vertex id                      |
| `identityType` | STRING   | which vertex class                            |
| `startedAt`    | DATETIME |                                               |
| `endedAt`      | DATETIME | null = still active                           |
| `state`        | STRING   | `Active \| Revoked \| Expired \| Suspended`   |
| `sourceIp`     | STRING   |                                               |
| `mfaVerified`  | BOOLEAN  |                                               |
| `revokedReason`| STRING   |                                               |

#### `Delegation`
Trust delegations from one identity to another.

| Field              | Type     | Notes                                     |
|--------------------|----------|-------------------------------------------|
| `fromIdentityRef`  | STRING   |                                           |
| `fromIdentityType` | STRING   |                                           |
| `toIdentityRef`    | STRING   |                                           |
| `toIdentityType`   | STRING   |                                           |
| `scope`            | LIST     | What is delegated                         |
| `grantedAt`        | DATETIME |                                           |
| `expiresAt`        | DATETIME | null = perpetual                          |
| `grantedBy`        | STRING   | → HumanIdentity.id                       |
| `isTransitive`     | BOOLEAN  | Can the delegate further delegate?        |
| `depth`            | INTEGER  | Hops from original principal              |

#### `ExecutionEvent`
Recorded actions taken by agent identities.

| Field                | Type     | Notes                                     |
|----------------------|----------|-------------------------------------------|
| `agentRef`           | STRING   | → AgentIdentity.id                        |
| `action`             | STRING   | What the agent did                        |
| `targetRef`          | STRING   | Identity or resource acted upon           |
| `targetType`         | STRING   | Vertex class of targetRef                 |
| `outcome`            | STRING   | `"success" \| "failure" \| "denied"`      |
| `withinDeclaredScope`| BOOLEAN  | Was this action in scopeDefinition?       |
| `correlationId`      | STRING   | Groups events from one agent session      |
| `executedAt`         | DATETIME |                                           |

#### `RiskSignal`
Risk signals modeled on OpenID Shared Signals Framework (SSF) / CAEP 1.0.

| Field            | Type     | Notes                                                                           |
|------------------|----------|---------------------------------------------------------------------------------|
| `jti`            | STRING   | JWT ID — unique signal identifier (unique per tenant)                           |
| `iss`            | STRING   | Issuer component (e.g. `"idem-risk-engine"`)                                    |
| `iat`            | DATETIME | Issued at                                                                       |
| `subjectRef`     | STRING   | → any identity vertex id                                                        |
| `subjectType`    | STRING   | Vertex class name                                                               |
| `caepEventType`  | STRING   | CAEP event type: `session-revoked \| credential-change \| risk-level-change \|` etc. |
| `eventTypeUri`   | STRING   | Full URI e.g. `https://schemas.openid.net/secevent/caep/event-type/...`        |
| `score`          | FLOAT    | 0.0–1.0                                                                         |
| `severity`       | STRING   | `"info" \| "warning" \| "critical"`                                             |
| `eventPayload`   | STRING   | JSON string — CAEP event payload (schema per event type)                        |
| `resolvedAt`     | DATETIME |                                                                                 |
| `resolvedBy`     | STRING   | → HumanIdentity.id                                                             |

---

## Edge Classes

### Phase 0 — Foundation

| Edge Type       | From → To                          | Purpose                              |
|-----------------|------------------------------------|--------------------------------------|
| `HAS_ACCESS`    | Identity → Resource                | Direct resource access grant         |
| `ASSIGNED_ROLE` | Identity → Role                    | Role assignment                      |
| `MEMBER_OF`     | Identity → Group                   | Group membership                     |
| `REPORTS_TO`    | HumanIdentity → HumanIdentity      | Management chain                     |
| `OWNS`          | Identity → ServiceAccount/Resource | Ownership                            |
| `SPAWNED`       | AgentIdentity → AgentIdentity      | Parent agent spawned child agent     |
| `GOVERNS`       | Policy → any                       | Policy governs an entity             |
| `PEER_OF`       | Identity → Identity                | Peer group membership                |
| `CREATED_BY`    | any → Identity                     | Creation provenance                  |
| `USED_BY`       | Resource/Token → Identity          | Usage tracking                       |

### Phase 1 — Identograph Core

| Edge Type          | From → To                    | Key Fields                              |
|--------------------|------------------------------|-----------------------------------------|
| `HAS_ENTITLEMENT`  | Identity → Entitlement       | `grantedAt`, `expiresAt`, `isActive`    |
| `DELEGATES_TO`     | Identity → Identity          | `delegationRef`, `scope`, `expiresAt`   |
| `EXECUTED_BY`      | AgentIdentity → ExecutionEvent | `executedAt`                          |
| `OWNS_RESOURCE`    | Identity → Resource          | `since`, `approvedBy`                   |
| `TRUSTS`           | Identity → AgentIdentity     | `trustLevel`, `conditions`              |
| `GENERATES_SIGNAL` | Identity → RiskSignal        | `signalRef`, `generatedAt`              |

---

## Indexes

| Vertex Type      | Index Fields                     | Type   |
|------------------|----------------------------------|--------|
| All types        | `(tenantId, id)`                 | UNIQUE |
| `HumanIdentity`  | `(tenantId, email)`              | UNIQUE |
| `HumanIdentity`  | `(tenantId, employeeId)`         | UNIQUE |
| `NHIdentity`     | `(tenantId, provider, kind)`     | Non-unique |
| `Entitlement`    | `(tenantId, isPrivileged)`       | Non-unique |
| `Session`        | `(tenantId, identityRef, state)` | Non-unique |
| `Delegation`     | `(tenantId, fromIdentityRef)`    | Non-unique |
| `Delegation`     | `(tenantId, toIdentityRef)`      | Non-unique |
| `ExecutionEvent` | `(tenantId, agentRef)`           | Non-unique |
| `ExecutionEvent` | `(tenantId, correlationId)`      | Non-unique |
| `ExecutionEvent` | `(tenantId, withinDeclaredScope)`| Non-unique |
| `RiskSignal`     | `(tenantId, jti)`                | UNIQUE |
| `RiskSignal`     | `(tenantId, subjectRef)`         | Non-unique |
| `RiskSignal`     | `(tenantId, score)`              | Non-unique |
| `RiskSignal`     | `(tenantId, caepEventType)`      | Non-unique |

---

## Traversal Queries

All 6 traversal queries live in `packages/identograph/src/graph/queries/`.

| File                    | Function                | Returns                                         |
|-------------------------|-------------------------|-------------------------------------------------|
| `access-lineage.ts`     | `queryAccessLineage`    | All resources reachable from an identity        |
| `agent-scope.ts`        | `queryAgentScope`       | Declared scope vs. actual execution events      |
| `delegation-paths.ts`   | `queryDelegationPaths`  | Full delegation chain from a source identity    |
| `risk-surface.ts`       | `queryRiskSurface`      | All identities above a risk threshold + signals |
| `blast-radius.ts`       | `queryBlastRadius`      | All resources/identities reachable if compromised |
| `entitlement-overlap.ts`| `queryEntitlementOverlap` | Cross-identity SoD violations                |
