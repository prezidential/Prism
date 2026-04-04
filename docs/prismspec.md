# Prism — Agentic Identity Security Platform

## Platform Architecture Specification v0.1 | April 2026 | Confidential

-----

## 0. Executive Overview

Prism is an agentic-native identity security platform. It is not a traditional IGA platform with AI features bolted on. It is built from first principles around the assumption that autonomous agents are the correct unit of identity governance - not scheduled jobs, static connectors, or human-driven certification campaigns.

Every current identity security platform was architected when identity meant a person with an employee ID. That assumption is now broken. Machine identities outnumber human identities in the enterprise. AI agents create, consume, and discard access in real time. Non-human identities accumulate privileges silently across cloud workloads, CI/CD pipelines, and service meshes with no lifecycle management and no governance visibility.

Prism is built to govern all identity types - human, non-human, and agentic - under a unified data model with real-time awareness, continuous certification, autonomous access decisions, and on-demand reporting from plain language queries.

### Core Design Principles

- **Agents replace connectors.** No scheduled jobs. No batch ETL. No stale data presented as truth.
- **The data model is the platform.** Everything is built on top of a unified, semantic identity graph (Identograph).
- **Governance is continuous.** Not quarterly. Not annual. Every access event is a governance event.
- **Autonomy is tunable.** Enterprises set their own autonomy thresholds. The platform supports full auto-approval, agent-assisted review, and everything in between.
- **Reporting is a conversation.** Users ask questions. The platform answers from live data.
- **Security is the product.** This is an identity security platform. Its own security posture is non-negotiable.

-----

## 1. Architecture Overview

### 1.1 High-Level Component Map

Prism consists of ten discrete components. Each is independently deployable and communicates via a defined interface contract. No component has a direct dependency on another component’s internal implementation.

|Component            |Layer       |Primary Role                                                |
|---------------------|------------|------------------------------------------------------------|
|Identograph          |Data        |Unified identity graph and semantic data model              |
|Ingest Agent Layer   |Data        |Event-driven identity data collection - replaces connectors |
|Policy Engine        |Core        |Evaluates access decisions against policy, risk, and context|
|Access Request Agent |Core        |Receives, reasons about, and fulfills access requests       |
|Certification Agent  |Core        |Continuous access review and anomaly-driven certification   |
|Reporting Agent      |Core        |On-demand report generation from natural language queries   |
|Orchestration Layer  |Platform    |Coordinates agent execution, lifecycle, and communication   |
|Autonomy Config Layer|Platform    |Per-tenant tunable autonomy thresholds and overrides        |
|API Surface          |Platform    |External integration: SCIM, REST, GraphQL, webhooks         |
|UI Layer             |Presentation|Conversational, user-driven interface                       |

### 1.2 Fundamental Architecture Decision: Event-Driven

Prism is event-driven end to end. There are no scheduled jobs in the core platform. Every state change in a connected system emits an event. Every event is processed by the appropriate agent. Every agent action is recorded as an event. The identity graph reflects current state, not last-aggregation state.

> **CRITICAL:** Every source system integration must support webhooks, change data capture, or a polling agent that operates on sub-minute intervals. Integrations that cannot support event emission are second-class citizens in this architecture.

### 1.3 Agent Communication Protocol

All agents communicate through a shared message bus (Kafka). Agents consume events from topic-specific queues and emit events to output topics. No agent calls another agent directly. This prevents coupling and allows independent scaling.

- **Input topics:** `identity.events.raw`, `access.requests.inbound`, `cert.triggers`, `report.requests`
- **Output topics:** `identity.events.processed`, `access.decisions`, `cert.decisions`, `reports.ready`, `audit.log`
- All messages are JSON-serialized with a standard envelope: `{ eventType, timestamp, sourceAgent, correlationId, payload }`

-----

## 2. Component 1: Identograph (Identity Data Model)

### 2.1 Purpose

Identograph is the semantic identity graph that is the foundation of the entire platform. Without a correct, rich, and current Identograph, no agent can make good decisions. Everything built on top of Identograph is only as good as the data model underneath.

Identograph normalizes all identity types into a unified graph schema. A human employee, a service account, an AI agent, an API token, an OAuth client, and a Kubernetes pod identity are all first-class nodes in the same graph with defined relationship types between them.

### 2.2 Node Types

|Node Type       |Category  |Description                                               |
|----------------|----------|----------------------------------------------------------|
|HumanIdentity   |Human     |Employee, contractor, vendor, partner                     |
|ServiceAccount  |Non-Human |Application service accounts, automation accounts         |
|AgentIdentity   |Non-Human |AI agent instances with defined scope and lifetime        |
|APIToken        |Non-Human |OAuth tokens, API keys, personal access tokens            |
|WorkloadIdentity|Non-Human |Kubernetes pods, Lambda functions, container workloads    |
|DeviceIdentity  |Non-Human |Managed devices, IoT endpoints                            |
|Application     |Resource  |SaaS apps, enterprise apps, internal tools                |
|Resource        |Resource  |Files, databases, APIs, cloud resources                   |
|Role            |Policy    |RBAC roles, entitlement groups, permission sets           |
|Policy          |Policy    |Access policies, governance rules, compliance controls    |
|Group           |Structural|Organizational groups, security groups, distribution lists|
|OrgUnit         |Structural|Business units, departments, cost centers                 |

### 2.3 Edge Types (Relationships)

|Edge Type    |Source -> Target               |Properties                                            |
|-------------|-------------------------------|------------------------------------------------------|
|HAS_ACCESS   |Any Identity -> Resource       |grantedAt, grantedBy, expiresAt, accessLevel, lastUsed|
|ASSIGNED_ROLE|Any Identity -> Role           |assignedAt, assignedBy, expiresAt, certifiedAt        |
|MEMBER_OF    |Any Identity -> Group          |joinedAt, addedBy                                     |
|REPORTS_TO   |HumanIdentity -> HumanIdentity |effectiveDate, source                                 |
|OWNS         |HumanIdentity -> ServiceAccount|since, approvedBy                                     |
|SPAWNED      |AgentIdentity -> AgentIdentity |at, parentCorrelationId                               |
|GOVERNS      |Policy -> Any Node             |effectiveDate, priority                               |
|PEER_OF      |Any Identity -> Any Identity   |similarityScore, basisAttributes                      |
|CREATED_BY   |Any Node -> HumanIdentity      |at, via                                               |
|USED_BY      |APIToken -> Application        |lastSeen, callCount                                   |

### 2.4 Identity Schema: Core Fields

#### All Identity Nodes

```
id: UUID (globally unique across all node types)
nodeType: enum (HumanIdentity | ServiceAccount | AgentIdentity | ...)
externalIds: Map<SourceSystem, string>  // cross-system correlation
createdAt: ISO8601
updatedAt: ISO8601
status: enum (Active | Inactive | Suspended | Orphaned | PendingReview)
riskScore: float (0.0 - 1.0, calculated continuously)
lastActivity: ISO8601
tags: string[]
metadata: Map<string, any>  // extensible, source-system-specific
```

#### HumanIdentity Additional Fields

```
employeeId: string
email: string
name: string
jobTitle: string
department: string
location: string
employmentType: enum (FTE | Contractor | Vendor | Partner)
hireDate: ISO8601
terminationDate?: ISO8601
managerRef: UUID  // -> HumanIdentity
```

#### AgentIdentity Additional Fields

```
agentType: string  // e.g. "prism-ingest-agent", "external-ai-assistant"
model: string  // underlying LLM or runtime
scopeDefinition: ScopeObject  // what this agent is allowed to do
parentAgentRef?: UUID
spawnedAt: ISO8601
maxLifetimeSeconds: int
credentialType: enum (OAuth | APIKey | mTLS | OIDC)
credentialRef: string  // pointer to secrets manager, never stored in graph
```

### 2.5 Technology

- **Graph database:** ArcadeDB (Apache 2.0) with built-in MCP server and native vector search
- **Query languages:** Cypher, SQL, and Gremlin all supported natively by ArcadeDB
- **Operational store:** PostgreSQL for relational data, audit logs, configuration
- **Cache:** Redis for hot-path identity lookups and real-time risk scores
- **Search:** OpenSearch for full-text identity search and log analytics
- **Schema versioning:** Liquibase for relational, custom migration scripts for graph

> **Design Decision:** ArcadeDB is chosen for three reasons: (1) relationship traversal is the primary query pattern and ArcadeDB handles it natively, (2) ArcadeDB has a built-in MCP server enabling direct LLM-to-database communication for the Reporting Agent without a translation layer, and (3) Apache 2.0 license means zero licensing cost from day one through enterprise scale.

-----

## 3. Component 2: Ingest Agent Layer

### 3.1 Purpose

The Ingest Agent Layer replaces connectors. There are no scheduled aggregation jobs. Each source system integration is an agent that maintains continuous awareness of that system’s identity state and emits events to the platform when state changes.

An ingest agent is not a polling loop with a fancy name. It is an LLM-backed reasoning process that understands the source system’s identity schema, can map that schema to Identograph node types, resolve ambiguities in the data, and decide when a change is significant enough to warrant an event.

### 3.2 Agent Architecture

#### Per-Source Agent

Each source system has exactly one ingest agent instance. That agent is responsible for:

1. **Initial discovery** - full scan of all identities and access in the source system on first connection or reconnection
1. **Change detection** - listening to webhooks, polling change APIs, or using CDC where available
1. **Schema resolution** - mapping source system fields to Identograph schema, resolving nulls and ambiguities
1. **Event emission** - publishing normalized identity events to the `identity.events.raw` Kafka topic
1. **Conflict detection** - flagging when data from this source conflicts with data from other sources for the same identity

#### Agent Prompt Structure

Each ingest agent is initialized with a system prompt that encodes:

- The Identograph schema for all node and edge types
- The source system’s known schema and quirks (loaded from a Source System Definition file)
- Resolution rules for identity correlation (how to match identities across systems)
- Event significance thresholds (what changes are worth emitting vs. noise)
- Escalation logic for unresolvable ambiguities

### 3.3 Source System Definition (SSD) File

Each source system integration is described by a Source System Definition YAML file. This replaces the connector configuration. The SSD tells the ingest agent everything it needs to know about the source system without hard-coded integration logic.

```yaml
sourceSystem:
  id: workday-prod
  type: HRIS
  displayName: Workday Production
  connection:
    type: REST_API
    baseUrl: https://api.workday.com/v1
    authType: OAuth2_ClientCredentials
    credentialRef: vault/secret/workday-prod
  changeDetection:
    type: webhook  # or: poll, cdc, event_stream
    webhookEndpoint: /ingest/workday-prod/events
    pollIntervalSeconds: 60  # fallback if webhook unavailable
  identityMapping:
    primaryNodeType: HumanIdentity
    correlationFields:
      - sourceField: worker_id
        idemField: externalIds.workday-prod
      - sourceField: email
        idemField: email  # used for cross-system correlation
  fieldMappings:
    - source: worker_id    target: employeeId
    - source: legal_name   target: name
    - source: job_profile  target: jobTitle
  significanceRules:
    highSignificance: [status_change, manager_change, termination]
    lowSignificance: [display_name_change, phone_change]
```

### 3.4 Identity Correlation Engine

When an ingest agent receives a new identity record, it must determine whether this is a new identity or an existing identity already known to Identograph from another source system. This cross-system correlation is one of the hardest problems in identity governance.

The correlation engine uses a multi-factor matching algorithm:

1. Exact match on known correlation keys (email, employee ID, SSO subject)
1. Probabilistic match on name, department, and metadata similarity
1. LLM-assisted disambiguation for edge cases where rule-based matching produces ambiguous results
1. Human review escalation for unresolvable conflicts

### 3.5 Supported Source System Types (v0.1)

- **HRIS:** Workday, BambooHR, ADP
- **IdP / Directory:** Okta, Microsoft Entra ID (Azure AD), Ping Identity
- **Cloud:** AWS IAM, GCP IAM, Azure RBAC
- **SaaS:** Salesforce, ServiceNow, GitHub, Jira, Slack
- **PAM:** CyberArk, BeyondTrust (read-only for correlation)
- **Custom:** Generic REST API via SSD configuration

-----

## 4. Component 3: Policy Reasoning Engine

### 4.1 Purpose

The Policy Reasoning Engine is the brain of every access decision. When an access request arrives, a certification decision is needed, or a risk score changes, the Policy Engine evaluates the situation against the full policy context and returns a structured decision with a reasoning trace.

Every decision made by any agent flows through the Policy Engine. No agent makes access decisions independently.

### 4.2 Policy Types

|Policy Type         |Enforcement |Example                                                 |
|--------------------|------------|--------------------------------------------------------|
|Separation of Duties|Hard block  |Cannot hold AP and AR roles simultaneously              |
|Least Privilege     |Soft flag   |Access unused for 90 days triggers review               |
|Time-Bound Access   |Auto-expire |Contractor access expires on contract end date          |
|Peer Group Baseline |Anomaly flag|Access significantly above peer group average           |
|Regulatory          |Hard block  |PII access requires DPA role and training certification |
|Lifecycle           |Auto-action |Terminated identity triggers immediate access revocation|
|Risk-Based          |Dynamic     |High risk score triggers step-up auth requirement       |
|Agent Scope         |Hard block  |Agent cannot access resources outside its defined scope |

### 4.3 Decision Output Schema

```typescript
decision: {
  requestId: UUID
  timestamp: ISO8601
  outcome: enum (APPROVE | DENY | ESCALATE | APPROVE_WITH_CONDITIONS)
  confidence: float (0.0 - 1.0)
  reasoningTrace: string[]  // ordered list of policy checks evaluated
  appliedPolicies: Policy[]  // policies that affected the outcome
  conditions?: Condition[]  // if APPROVE_WITH_CONDITIONS
  escalationTarget?: string  // if ESCALATE, who reviews
  expiresAt?: ISO8601  // if time-limited approval
  riskFactors: RiskFactor[]  // all risk signals considered
  auditHash: string  // tamper-evident hash of this decision record
}
```

### 4.4 Peer Group Analysis

One of the most powerful policy inputs is peer group baseline analysis. The Policy Engine continuously maintains peer group models based on job title, department, location, and access patterns. When evaluating a request, it compares the requested access against the peer group baseline and flags significant deviations.

Peer groups are computed dynamically from the Identograph graph, not from static role assignments. Two identities are peers if they share a sufficient combination of: job title similarity, department, manager tree proximity, and similar existing access patterns.

-----

## 5. Component 4: Access Request Agent

### 5.1 Purpose

The Access Request Agent receives, reasons about, and fulfills (or denies) access requests. It replaces the ticket-based access request workflow entirely. There is no form. There is no ticket. There is a request - expressed in natural language or structured format - and the agent handles it.

### 5.2 Request Lifecycle

1. Request received (via UI, API, or programmatic submission)
1. Requestor identity resolved and context loaded from Identograph
1. Requested resource resolved and access graph loaded
1. Policy Engine queried for decision
1. Autonomy threshold checked against tenant configuration
1. If within auto-approve threshold: fulfill immediately, log decision
1. If above threshold: generate approval package and route to appropriate reviewer
1. Reviewer receives contextualized recommendation, not a raw request
1. Decision recorded in audit log and Identograph updated

### 5.3 Natural Language Request Processing

Users can submit requests in natural language. The agent resolves ambiguous requests before routing to the Policy Engine.

```
Input:  "I need access to the Salesforce reports for the EMEA region"

Agent resolves:
  - Requestor: confirmed from session context
  - Resource: Salesforce -> EMEA Reports -> [specific permission set identified]
  - Business justification: inferred from role context, or clarification requested
  - Duration: default (permanent) unless specified

Output: structured AccessRequest submitted to Policy Engine
```

### 5.4 Approval Package Structure

When human review is required, the reviewer receives an approval package - not a raw request. The package contains everything needed to make a good decision without having to investigate independently.

- Who is requesting and their full access context
- What is being requested (resolved to specific permissions, not vague descriptions)
- Policy Engine recommendation with full reasoning trace
- Peer group comparison: do their peers have this access?
- Risk factors associated with granting this access
- Historical context: has this identity had this access before? Why was it removed?
- One-click approve, deny, or modify with required comment only on deny

### 5.5 Provisioning Execution

On approval (automated or human), the Access Request Agent triggers provisioning via the Ingest Agent Layer of the target system. Provisioning is confirmed when the Ingest Agent reports back that the access change is visible in the source system. If provisioning fails, the agent retries with backoff and escalates if unresolved within the configured SLA window.

-----

## 6. Component 5: Certification Agent

### 6.1 Purpose

The Certification Agent replaces the periodic certification campaign. There are no quarterly access reviews where reviewers rubber-stamp 800 items in 20 minutes. Certification is continuous and risk-driven. The agent surfaces only items that require genuine human judgment.

### 6.2 Continuous Certification Model

Access is considered continuously certified if all of the following are true:

- It was granted through a policy-compliant request process
- It has been used within the configured activity window
- No policy violations have been detected since last certification
- The identity’s risk score is below the escalation threshold
- The access is within the identity’s peer group baseline

Access is flagged for review when any of the following occur:

- Inactivity exceeds configured threshold (default: 60 days)
- Identity risk score crosses escalation threshold
- Policy conflict detected (e.g., SoD violation from new role assignment)
- Access significantly exceeds peer group baseline
- Identity lifecycle event (promotion, transfer, termination, leave)
- Source system reports anomalous activity on this access path
- Regulatory trigger (e.g., annual SOX certification requirement)

### 6.3 Certification Item Auto-Resolution

|Condition                                  |Auto Action                   |Audit Record                |
|-------------------------------------------|------------------------------|----------------------------|
|Access unused > 90 days, low risk resource |Auto-revoke                   |Full reasoning trace logged |
|Access unused > 90 days, high risk resource|Escalate to owner             |Recommended action: revoke  |
|SoD violation detected                     |Escalate (cannot auto-resolve)|Policy violation flagged    |
|Identity terminated, any access            |Auto-revoke all               |Lifecycle event logged      |
|Risk score normalized after anomaly        |Auto-certify                  |Risk resolution logged      |
|Access within peer baseline, active use    |Auto-certify                  |Baseline confirmation logged|

### 6.4 Reviewer Experience

A reviewer’s certification queue is a curated list of items that genuinely need their judgment. Each item includes:

- What access is under review and why it was flagged
- Certification Agent recommendation with confidence score
- Full reasoning trace showing what the agent evaluated
- Peer group context
- Historical certification history for this identity/resource pair
- One action required: Certify, Revoke, or Escalate

> **Target Metric:** Reviewers should see a maximum of 15-20 items per certification queue. If a reviewer consistently sees more, the autonomy threshold configuration should be reviewed. 95%+ of items should be auto-resolved without human intervention.

-----

## 7. Component 6: Reporting Agent

### 7.1 Purpose

The Reporting Agent generates reports on demand from natural language queries. There are no pre-built report templates. There is no BI tool configuration. A user asks a question and receives a report. The report reflects the current state of the Identograph at query time.

### 7.2 Query Processing

1. User submits natural language query via UI or API
1. Reporting Agent interprets query intent and identifies required data dimensions
1. Agent constructs graph query against Identograph (via ArcadeDB’s native MCP server)
1. Query executed against live graph database
1. Results formatted into appropriate report structure (table, summary, visualization data)
1. Report returned to user with data provenance and query timestamp
1. Report saved to user’s report history with the originating query stored

> **Architecture Advantage:** ArcadeDB’s built-in MCP server means the Reporting Agent communicates directly with the Identograph using the same protocol Claude natively speaks. No intermediate query-building middleware required. The agent asks the database a question and gets a structured answer.

### 7.3 Example Queries

```
"Which contractors have access to production databases and haven't logged in for 60 days?"

"Show me all AI agent identities created in the last 30 days with access to sensitive resources"

"What is the blast radius if the Okta service account is compromised?"

"Give me a SOX SoD conflict report for the Finance department"
```

### 7.4 Report Output Formats

- Interactive table (default, sortable and filterable in UI)
- Structured JSON (for API consumers)
- PDF export (for compliance and audit submission)
- Natural language summary (agent-generated executive summary of findings)

### 7.5 Compliance Report Library

Pre-defined query templates for common regulatory requirements. These are not pre-built reports. They are pre-built queries that still execute against live data.

- **SOX:** Segregation of Duties conflict report
- **SOX:** Privileged access inventory
- **HIPAA:** PHI access by non-clinical staff
- **GDPR:** PII access inventory and data subject access mapping
- **ISO 27001:** Access review completion status
- **Custom:** Tenant-defined query templates

-----

## 8. Component 7: Agent Orchestration Layer

### 8.1 Purpose

The Orchestration Layer manages the lifecycle of all agents in the platform. It handles agent spawning, monitoring, failure recovery, scaling, and communication routing. No agent manages itself.

### 8.2 Agent Lifecycle States

- **INITIALIZING** - Agent is starting, loading configuration and context
- **ACTIVE** - Agent is running and processing events
- **IDLE** - Agent is running but has no current work
- **SUSPENDED** - Agent is paused by administrative action
- **FAILED** - Agent has encountered an unrecoverable error
- **TERMINATED** - Agent has completed its work and been shut down

### 8.3 Orchestration Framework

- **Kubernetes** for agent container lifecycle management
- **Apache Kafka** for inter-agent message routing
- **MCP (Model Context Protocol)** for LLM-to-tool communication within agents
- **Custom agent registry service** for discovery and health monitoring

### 8.4 Failure Handling

All agents are designed to be stateless. State lives in the Identograph or the message bus, not in the agent process. If an agent fails, the Orchestration Layer restarts it. The agent replays its event queue from the last confirmed checkpoint. No state is lost.

> **CRITICAL:** Agent failures must never corrupt the Identograph. All graph writes are transactional. If an agent write fails mid-transaction, the entire transaction rolls back. Partial writes do not exist in this system.

-----

## 9. Component 8: Autonomy Configuration Layer

### 9.1 Purpose

Different enterprises have different risk tolerances and regulatory environments. The Autonomy Configuration Layer allows each tenant to tune exactly how much autonomous action agents are permitted to take without human review.

### 9.2 Autonomy Dimensions

|Dimension                    |Range                     |Description                                               |
|-----------------------------|--------------------------|----------------------------------------------------------|
|Access Request Auto-Approval |Disabled to Full Auto     |What request types agents can fulfill without human review|
|Certification Auto-Resolution|0% to 100%                |What % of items agents can resolve autonomously           |
|Provisioning Auto-Execution  |Disabled to Full Auto     |Can agents write access changes or only recommend them?   |
|Risk Score Response          |Alert-Only to Auto-Suspend|How agents respond to elevated risk scores                |
|Lifecycle Auto-Action        |Alert to Full Auto        |Automatic actions on termination, transfer events         |

### 9.3 Configuration Schema

```typescript
autonomyConfig: {
  tenantId: UUID
  accessRequest: {
    autoApproveEnabled: boolean
    autoApproveMaxRiskScore: float  // 0.0 = nothing auto-approved
    autoApproveResourceClasses: string[]  // ["low", "medium"]
    requireJustificationThreshold: float  // risk score above which justification required
  },
  certification: {
    autoRevokeInactiveDays: int  // days of inactivity before auto-revoke eligible
    autoRevokeMaxRiskScore: float  // only auto-revoke below this risk score
    humanReviewRiskThreshold: float  // above this, always human review
  },
  lifecycle: {
    autoRevokeOnTermination: boolean
    terminationRevocationDelayMinutes: int  // 0 = immediate
    autoSuspendOnAnomalyScore: float
  }
}
```

-----

## 10. Component 9: API Surface

### 10.1 Purpose

The API Surface is how external systems interact with Prism. It exposes identity data, access decisions, and platform controls through a well-defined interface. It also handles inbound identity events from source systems that prefer push over pull.

### 10.2 API Protocols

- **REST** - primary interface for CRUD operations and integrations
- **GraphQL** - query interface for complex identity graph traversal
- **SCIM 2.0** - standard identity provisioning protocol for source system integration
- **Webhooks** - outbound event notifications to external systems
- **WebSocket** - real-time event stream for UI and live integrations

### 10.3 Core REST Endpoints

|Endpoint                      |Method        |Purpose                                               |
|------------------------------|--------------|------------------------------------------------------|
|/v1/identities                |GET, POST     |Identity CRUD                                         |
|/v1/identities/{id}/access    |GET           |All access for an identity                            |
|/v1/access-requests           |POST          |Submit access request (natural language or structured)|
|/v1/access-requests/{id}      |GET, PATCH    |Get or action an access request                       |
|/v1/certifications/queue      |GET           |Get open certification items for reviewer             |
|/v1/certifications/{id}/action|POST          |Certify, revoke, or escalate an item                  |
|/v1/reports                   |POST          |Submit a report query                                 |
|/v1/reports/{id}              |GET           |Retrieve report results                               |
|/v1/ingest/events             |POST          |Inbound identity events from source systems           |
|/v1/policies                  |GET, POST, PUT|Policy management                                     |
|/v1/autonomy-config           |GET, PUT      |Tenant autonomy configuration                         |

### 10.4 Authentication

- All API calls require OAuth 2.0 bearer tokens
- Machine-to-machine: client credentials flow
- User-delegated: authorization code flow with PKCE
- All tokens are scoped to minimum required permissions
- Token introspection is performed on every request (no JWT verification shortcuts)

-----

## 11. Component 10: UI Layer

### 11.1 Design Philosophy

The Prism UI is not a dashboard with pre-built widgets. It is a conversational interface layered over a live identity graph. Users interact with it the way they would interact with a knowledgeable colleague who has complete visibility into the organization’s access state.

### 11.2 Primary Interface Patterns

#### Conversation Panel

The primary interface. Users submit queries, requests, and commands in natural language. Every governance action is accessible through this interface. Access requests, certification decisions, report queries, policy lookups - all flow through the same conversational model.

#### Live Identity Graph View

An interactive visualization of the Identograph for a selected identity or resource. Shows all access relationships, risk signals, and governance state in a force-directed graph. Filtered by identity, resource class, or risk score.

#### Certification Queue

A curated, prioritized list of items requiring human review. Maximum 20 items per queue session. Each item is self-contained with all context needed to make a decision. No clicking through to another screen. One action per item.

#### My Access

A personal view for every user. Shows their own current access, pending requests, and any access that is flagged for review. Users can submit access requests, extend access, or request removal directly from this view.

### 11.3 Technology Stack

- **Framework:** React 18 with TypeScript
- **State management:** Zustand
- **Graph visualization:** D3.js for identity graph view
- **Real-time:** WebSocket connection to API for live updates
- **Styling:** Tailwind CSS
- **Component library:** Radix UI primitives

-----

## 12. Full Technology Stack

|Layer                  |Technology                  |Rationale                                                     |
|-----------------------|----------------------------|--------------------------------------------------------------|
|Primary Language       |TypeScript (Node.js)        |Type safety, ecosystem, async-native                          |
|Agent Runtime          |Claude via Anthropic API    |Reasoning capability for identity semantics                   |
|Agent Protocol         |MCP (Model Context Protocol)|Standard tool use interface for agents                        |
|Message Bus            |Apache Kafka                |High-throughput, durable, replayable events                   |
|Graph DB               |ArcadeDB (Apache 2.0)       |Built-in MCP server, native vector search, zero licensing cost|
|Relational DB          |PostgreSQL                  |Operational data, config, audit logs                          |
|Cache                  |Redis                       |Hot-path identity lookups, session state                      |
|Search                 |OpenSearch                  |Full-text search, log analytics                               |
|Secrets                |HashiCorp Vault             |Credential storage, dynamic secrets                           |
|Container Orchestration|Kubernetes                  |Agent lifecycle management, scaling                           |
|API Layer              |Fastify + Apollo GraphQL    |REST + GraphQL dual interface                                 |
|Frontend               |React 18 + TypeScript       |Conversational UI                                             |
|Auth                   |Keycloak (self-hosted)      |OIDC provider for platform auth                               |
|Observability          |OpenTelemetry + Grafana     |Traces, metrics, logs                                         |
|CI/CD                  |GitHub Actions              |Build, test, deploy pipeline                                  |
|IaC                    |Terraform                   |Cloud infrastructure definition                               |

-----

## 13. Security Architecture

> **CRITICAL:** This is an identity security platform. Its own security posture must be beyond reproach. Every architectural decision must be evaluated against the question: what happens if this platform is compromised?

### 13.1 Credential Handling

- No credentials are stored in the Identograph or any application database
- All credentials are stored in HashiCorp Vault with dynamic secret generation where possible
- Agent identities use short-lived OIDC tokens, not long-lived API keys
- Credential rotation is automated and rotation events are surfaced in the audit log

### 13.2 Audit Immutability

- All access decisions, agent actions, and policy evaluations are written to an append-only audit log
- Audit records include a tamper-evident hash chained to the previous record
- Audit log is replicated to an isolated store not accessible by application-layer agents
- Audit log retention minimum: 7 years (configurable per regulatory requirement)

### 13.3 Agent Trust Boundary

- Each agent has a defined scope. Agents cannot take actions outside their defined scope even if instructed to by another agent or user
- Agent-to-agent communication is authenticated. An agent cannot impersonate another agent
- All agent actions are logged with the agent’s identity, scope, and the instruction that triggered the action
- Prompt injection attacks are mitigated by treating all user-supplied input as untrusted data, not instructions

### 13.4 Encryption

- All data at rest encrypted (AES-256)
- All data in transit encrypted (TLS 1.3 minimum)
- Graph database encryption at the storage layer
- End-to-end encryption for sensitive identity attributes (PII fields)

-----

## 14. Build Sequence

### Philosophy

Build in phases. Each phase produces something runnable and demonstrable. No phase is a pure foundation with nothing to show at the end. Claude Code is the primary implementor. Specs must be precise enough to produce correct outputs without ambiguity.

### Phase 1: Identograph Core (Weeks 1-3)

**Goal:** A running ArcadeDB graph with the full identity schema, a seed data set, and a query interface.

1. Define complete ArcadeDB schema with all node types, edge types, and property constraints
1. Build schema migration tooling
1. Generate synthetic seed data for 500 human identities, 200 service accounts, 50 agent identities
1. Build basic query library for common access pattern queries
1. GraphQL API over the identity graph (read-only)

**Deliverable:** Running graph DB with queryable identity data via GraphQL

### Phase 2: First Ingest Agent (Weeks 4-6)

**Goal:** A working ingest agent for Okta that populates Identograph from a live or sandboxed Okta tenant.

1. Build Kafka infrastructure and topic definitions
1. Build SSD parser and loader
1. Build Okta ingest agent with webhook listener and polling fallback
1. Build identity correlation engine (exact match for Phase 2)
1. Build graph write service with transactional guarantees

**Deliverable:** Real Okta identities flowing into Identograph in real time

### Phase 3: Policy Engine + Access Request Agent (Weeks 7-10)

**Goal:** End-to-end access request flow from natural language input to policy decision to provisioning action.

1. Build Policy Engine with core policy types (SoD, Least Privilege, Time-Bound)
1. Build Access Request Agent with NL parsing
1. Build peer group analysis from existing graph data
1. Build approval routing and reviewer notification
1. Build provisioning execution for Okta (write access changes back to source)

**Deliverable:** Submit “I need access to X” -> agent decides -> access granted or escalated

### Phase 4: Certification Agent (Weeks 11-13)

**Goal:** Continuous certification running against live Identograph with a working reviewer queue.

1. Build continuous certification evaluation loop
1. Build auto-resolution logic for clear cases
1. Build reviewer queue UI (basic)
1. Build audit log with tamper-evident chaining

**Deliverable:** Running certification with auto-resolution and minimal human queue

### Phase 5: Reporting Agent + Full UI (Weeks 14-16)

**Goal:** Conversational reporting and full UI launch. Identiverse v0.1 demo-ready.

1. Build Reporting Agent with NL-to-graph query translation via ArcadeDB MCP server
1. Build full conversational UI layer
1. Build My Access view
1. Build identity graph visualization
1. Performance testing at scale (50,000+ identities)

**Deliverable:** Full platform demo. Identiverse launch.

-----

## 15. Open Questions for Resolution

These items require a decision before Phase 1 begins.

|Question            |Options                                                 |Decision Needed By           |
|--------------------|--------------------------------------------------------|-----------------------------|
|Multi-tenancy model |Shared DB with tenant isolation vs. DB-per-tenant       |Before Phase 1 schema design |
|Cloud target        |AWS-first vs. cloud-agnostic from day 1                 |Before Phase 2 infrastructure|
|Open source strategy|Identograph schema only vs. full platform open core     |Before any public code push  |
|Licensing model     |Outcome-based vs. identity-count vs. source-system-count|Before first enterprise pilot|
|Agent LLM strategy  |Anthropic-only vs. provider-agnostic from start         |Before Phase 2 agent build   |
|First pilot customer|Design partner identified or build spec-first           |Before Phase 3               |

-----

*Prism Platform Architecture Specification v0.1 | April 2026 | Confidential*