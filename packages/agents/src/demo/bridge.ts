// Demo-provisioner bridge.
//
// Reads the demo environment's exported state (tools/demo-provisioner/state.json)
// and seeds the Identograph from it. Per CLAUDE.md, the `seedId` fields are the
// Identograph anchors — the foreign keys that link the demo AWS/Okta data into
// the graph — so every vertex is keyed by its seedId, making the bridge
// idempotent and letting later ingestion reconcile against the same anchors.

import { readFile } from "node:fs/promises";
import type { DeadLetterQueue } from "../dlq/dead-letter-queue.js";
import {
  applyMappedGraph,
  type GraphEdgeUpsert,
  type GraphVertexUpsert,
  type GraphWriter,
  type IngestSummary,
  type MappedGraph,
} from "../ingest/graph-ops.js";
import { isPrivilegedPolicy, type IamAttachedPolicy } from "../aws/mapper.js";

export interface DemoIamUser {
  seedId: string;
  userName: string;
  attachedPolicies?: IamAttachedPolicy[];
}

export interface DemoIamRole {
  seedId: string;
  roleName: string;
  attachedPolicies?: IamAttachedPolicy[];
}

export interface DemoOktaUser {
  seedId: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  title?: string;
  groupSeedIds?: string[];
}

export interface DemoOktaGroup {
  seedId: string;
  name: string;
}

export interface DemoSeedState {
  aws?: { iamUsers?: DemoIamUser[]; iamRoles?: DemoIamRole[] };
  okta?: { users?: DemoOktaUser[]; groups?: DemoOktaGroup[] };
}

const DEFAULT_STATE_PATH = "tools/demo-provisioner/state.json";

function policyVertexAndEdge(
  ownerSeedId: string,
  policy: IamAttachedPolicy,
  tenantId: string,
  now: string,
): { vertex: GraphVertexUpsert; edge: GraphEdgeUpsert } {
  const privileged = isPrivilegedPolicy(policy);
  return {
    vertex: {
      type: "Entitlement",
      externalId: policy.policyArn,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "Entitlement",
        displayName: policy.policyName,
        entitlementType: "iam-policy",
        provider: "aws",
        isPrivileged: privileged,
        riskWeight: privileged ? 0.8 : 0.3,
        status: "Active",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
      },
    },
    edge: {
      edgeType: "HAS_ENTITLEMENT",
      fromType: "NHIdentity",
      toType: "Entitlement",
      fromExternalId: ownerSeedId,
      toExternalId: policy.policyArn,
      props: { grantedAt: now, isActive: true },
    },
  };
}

export function mapDemoState(state: DemoSeedState, tenantId: string, now: string): MappedGraph {
  const vertices: GraphVertexUpsert[] = [];
  const edges: GraphEdgeUpsert[] = [];
  const policySeen = new Set<string>();

  const addPolicies = (ownerSeedId: string, policies?: IamAttachedPolicy[]): void => {
    for (const policy of policies ?? []) {
      const { vertex, edge } = policyVertexAndEdge(ownerSeedId, policy, tenantId, now);
      if (!policySeen.has(policy.policyArn)) {
        policySeen.add(policy.policyArn);
        vertices.push(vertex);
      }
      edges.push(edge);
    }
  };

  for (const user of state.aws?.iamUsers ?? []) {
    vertices.push({
      type: "NHIdentity",
      externalId: user.seedId,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "NHIdentity",
        kind: "IAMUser",
        displayName: user.userName,
        provider: "aws",
        status: "Active",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    addPolicies(user.seedId, user.attachedPolicies);
  }

  for (const role of state.aws?.iamRoles ?? []) {
    vertices.push({
      type: "NHIdentity",
      externalId: role.seedId,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "NHIdentity",
        kind: "IAMRole",
        displayName: role.roleName,
        provider: "aws",
        status: "Active",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    addPolicies(role.seedId, role.attachedPolicies);
  }

  for (const group of state.okta?.groups ?? []) {
    vertices.push({
      type: "Group",
      externalId: group.seedId,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "Group",
        displayName: group.name,
        groupType: "security",
        status: "Active",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const user of state.okta?.users ?? []) {
    vertices.push({
      type: "HumanIdentity",
      externalId: user.seedId,
      externalIdField: "id",
      props: {
        tenantId,
        nodeType: "HumanIdentity",
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        department: user.department ?? "",
        jobTitle: user.title ?? "",
        status: "Active",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    for (const groupSeedId of user.groupSeedIds ?? []) {
      edges.push({
        edgeType: "MEMBER_OF",
        fromType: "HumanIdentity",
        toType: "Group",
        fromExternalId: user.seedId,
        toExternalId: groupSeedId,
        props: { joinedAt: now },
      });
    }
  }

  return { vertices, edges };
}

export interface DemoBridgeDeps {
  writer: GraphWriter;
  tenantId: string;
  dlq?: DeadLetterQueue;
  now?: () => string;
  // Injected state reader; defaults to reading DEFAULT_STATE_PATH from disk.
  readState?: () => Promise<DemoSeedState>;
  statePath?: string;
}

export class DemoBridge {
  constructor(private readonly deps: DemoBridgeDeps) {}

  private async loadState(): Promise<DemoSeedState> {
    if (this.deps.readState) return this.deps.readState();
    const path = this.deps.statePath ?? DEFAULT_STATE_PATH;
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as DemoSeedState;
  }

  async run(): Promise<IngestSummary> {
    const now = this.deps.now ?? (() => new Date().toISOString());
    const state = await this.loadState();
    const mapped = mapDemoState(state, this.deps.tenantId, now());
    return applyMappedGraph(this.deps.writer, this.deps.tenantId, mapped, {
      source: "demo-bridge",
      ...(this.deps.dlq ? { dlq: this.deps.dlq } : {}),
      now,
    });
  }
}
