// Generates 50 AgentIdentity nodes representing AI agent instances.

import { faker } from "@faker-js/faker";
import { CredentialType, IdentityStatus, NodeType } from "../../schema/enums.js";
import type { AgentIdentity } from "../../schema/types.js";

const AGENT_TYPES = [
  "prism-ingest-agent",
  "prism-cert-agent",
  "prism-reporting-agent",
  "prism-access-request-agent",
  "external-ai-assistant",
  "ci-agent",
  "security-scanner-agent",
  "data-classification-agent",
];

const MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "gemini-1.5-pro",
];

const CREDENTIAL_WEIGHTS: CredentialType[] = [
  ...Array<CredentialType>(50).fill(CredentialType.OIDC),
  ...Array<CredentialType>(30).fill(CredentialType.OAuth),
  ...Array<CredentialType>(15).fill(CredentialType.APIKey),
  ...Array<CredentialType>(5).fill(CredentialType.mTLS),
];

const STATUS_WEIGHTS: IdentityStatus[] = [
  ...Array<IdentityStatus>(60).fill(IdentityStatus.Active),
  ...Array<IdentityStatus>(20).fill(IdentityStatus.Inactive),
  ...Array<IdentityStatus>(10).fill(IdentityStatus.Suspended),
  ...Array<IdentityStatus>(10).fill(IdentityStatus.PendingReview),
];

function past(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function generateAgentIdentities(
  count: number,
  tenantId: string,
): AgentIdentity[] {
  const agents: AgentIdentity[] = [];

  for (let i = 0; i < count; i++) {
    const agentType = faker.helpers.arrayElement(AGENT_TYPES);
    const model = faker.helpers.arrayElement(MODELS);
    const status = faker.helpers.arrayElement(STATUS_WEIGHTS);
    const credentialType = faker.helpers.arrayElement(CREDENTIAL_WEIGHTS);
    const spawnedDaysAgo = faker.number.int({ min: 0, max: 365 });
    const maxLifetime = faker.helpers.arrayElement([3600, 86400, 604800, 2592000]); // 1h, 1d, 1w, 30d

    // Some agents were spawned by other agents (parent-child relationship)
    const parentRef =
      i > 5 && faker.datatype.boolean({ probability: 0.3 })
        ? agents[faker.number.int({ min: 0, max: i - 1 })]?.id
        : undefined;

    agents.push({
      id: faker.string.uuid(),
      tenantId,
      nodeType: NodeType.AgentIdentity,
      externalIds: {
        "internal-registry": `agent-${faker.string.alphanumeric(12)}`,
      },
      createdAt: past(spawnedDaysAgo + 1),
      updatedAt: past(faker.number.int({ min: 0, max: Math.min(spawnedDaysAgo, 7) })),
      status,
      riskScore: faker.number.float({
        min: status === IdentityStatus.Suspended ? 0.5 : 0.0,
        max: status === IdentityStatus.Suspended ? 1.0 : 0.4,
        fractionDigits: 2,
      }),
      lastActivity: status === IdentityStatus.Active
        ? past(faker.number.int({ min: 0, max: 3 }))
        : past(faker.number.int({ min: 30, max: 365 })),
      tags: [agentType, model.split("-")[0] ?? "unknown"],
      metadata: {
        deployedBy: "orchestration-layer",
        version: `${faker.number.int({ min: 1, max: 3 })}.${faker.number.int({ min: 0, max: 9 })}.${faker.number.int({ min: 0, max: 9 })}`,
      },
      agentType,
      model,
      scopeDefinition: {
        allowedNodeTypes: ["HumanIdentity", "ServiceAccount"],
        allowedOperations: ["read", "write"],
        maxBatchSize: 100,
        requiresHumanApproval: agentType.includes("access-request"),
      },
      parentAgentRef: parentRef,
      spawnedAt: past(spawnedDaysAgo),
      maxLifetimeSeconds: maxLifetime,
      credentialType,
      // credentialRef points to Vault - never store the actual credential
      credentialRef: `vault/secret/agents/${tenantId}/${agentType}-${i}`,
    });
  }

  return agents;
}
