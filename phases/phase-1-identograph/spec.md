# Phase 1 Spec — Identograph Core

## Vertex Classes

**Phase 0 (12):** HumanIdentity, ServiceAccount, AgentIdentity, APIToken, WorkloadIdentity, DeviceIdentity, Application, Resource, Role, Policy, Group, OrgUnit

**Phase 1 additions (6):** NHIdentity, Entitlement, Session, Delegation, ExecutionEvent, RiskSignal

See `architecture/identograph-schema.md` for full field definitions.

## Edge Classes

**Phase 0 (10):** HAS_ACCESS, ASSIGNED_ROLE, MEMBER_OF, REPORTS_TO, OWNS, SPAWNED, GOVERNS, PEER_OF, CREATED_BY, USED_BY

**Phase 1 additions (6):** HAS_ENTITLEMENT, DELEGATES_TO, EXECUTED_BY, OWNS_RESOURCE, TRUSTS, GENERATES_SIGNAL

## RiskSignal Schema

Based on OpenID Shared Signals Framework (SSF) / CAEP 1.0.
Key fields mirror the Security Event Token (SET) structure:
- `jti` — unique JWT ID
- `iss` — issuer component
- `iat` — issued at
- `caepEventType` — one of 7 CAEP event types
- `eventTypeUri` — full CAEP URI
- `score` — derived 0.0–1.0 risk score
- `severity` — info | warning | critical

## IdentographClient

Located at `packages/identograph/src/graph/client.ts`.
Provides:
- Typed CRUD for each Phase 1 vertex type
- `upsertVertex()` — idempotent insert-or-update
- 6 traversal query dispatchers

## Traversal Queries

1. **access-lineage** — HAS_ENTITLEMENT → Entitlement → Resource + direct HAS_ACCESS
2. **agent-scope** — AgentIdentity.scopeDefinition vs ExecutionEvent records
3. **delegation-paths** — Delegation vertices from source, optionally filtered to target
4. **risk-surface** — All identity types with riskScore ≥ threshold + their RiskSignals
5. **blast-radius** — Resources + identities reachable if an identity is compromised
6. **entitlement-overlap** — Identity pairs sharing Entitlements (SoD violation detection)
