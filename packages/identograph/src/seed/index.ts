// Seed orchestrator. Generates and loads all identity data into ArcadeDB.
// Targets: 500 HumanIdentity, 200 ServiceAccount, 50 AgentIdentity + supporting nodes + edges.

import { ArcadeClient, defaultConfig } from "../db/client.js";
import { generateAgentIdentities } from "./generators/agent-identity.js";
import { generateHumans } from "./generators/human.js";
import { generateServiceAccounts } from "./generators/service-account.js";
import {
  generateApplications,
  generateGroups,
  generateOrgUnits,
  generateResources,
  generateRoles,
} from "./generators/supporting.js";
import {
  generateAssignedRoles,
  generateHasAccess,
  generateMemberOf,
  generateOwns,
  generateReportsTo,
  generateSpawned,
  type EdgeRecord,
} from "./generators/relationships.js";

const TENANT_ID = process.env["PRISM_TENANT_ID"] ?? "prism-dev";

const client = new ArcadeClient(defaultConfig());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertNodes<T extends object>(
  label: string,
  nodes: T[],
  batchSize = 50,
): Promise<void> {
  let inserted = 0;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    await Promise.all(batch.map((node) => client.insertVertex(label, node as Record<string, unknown>)));
    inserted += batch.length;
    process.stdout.write(`\r  ${label}: ${inserted}/${nodes.length}`);
  }
  console.log(`\r  ${label}: ${nodes.length} inserted         `);
}

async function insertEdges(edges: EdgeRecord[], batchSize = 30): Promise<void> {
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < edges.length; i += batchSize) {
    const batch = edges.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (edge) => {
        try {
          await client.insertEdge(
            edge.edgeType,
            edge.fromType,
            edge.fromId,
            edge.toType,
            edge.toId,
            edge.props,
            TENANT_ID,
          );
          inserted++;
        } catch {
          // Some edges may fail if the referenced node wasn't seeded (orphaned refs)
          failed++;
        }
      }),
    );
    process.stdout.write(`\r  Edges: ${inserted} inserted, ${failed} skipped`);
  }
  console.log(`\r  Edges: ${inserted} inserted, ${failed} skipped         `);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log(`\nSeeding Identograph for tenant: ${TENANT_ID}\n`);

  // Check if already seeded (idempotency guard)
  try {
    const existing = await client.count("HumanIdentity", TENANT_ID);
    if (existing > 0) {
      console.log(`  Already seeded: ${existing} HumanIdentity nodes found.`);
      console.log("  To re-seed, run: npm run infra:reset && npm run migrate && npm run seed");
      return;
    }
  } catch {
    // Table may not exist yet - proceed
  }

  // -----------------------------------------------------------
  // Phase 1: Generate all node data (in-memory)
  // -----------------------------------------------------------
  console.log("Generating nodes...");

  const orgUnits = generateOrgUnits(TENANT_ID);
  const applications = generateApplications(TENANT_ID);
  const resources = generateResources(TENANT_ID, applications);
  const roles = generateRoles(TENANT_ID, applications);
  const groups = generateGroups(TENANT_ID);
  const humans = generateHumans(500, TENANT_ID, orgUnits);
  const serviceAccounts = generateServiceAccounts(200, TENANT_ID, humans, applications);
  const agentIdentities = generateAgentIdentities(50, TENANT_ID);

  const totalNodes =
    orgUnits.length + applications.length + resources.length + roles.length +
    groups.length + humans.length + serviceAccounts.length + agentIdentities.length;

  console.log(`  Total nodes to insert: ${totalNodes}`);

  // -----------------------------------------------------------
  // Phase 2: Generate edge data (in-memory)
  // -----------------------------------------------------------
  const reportsToEdges = generateReportsTo(humans);
  const assignedRoleEdges = generateAssignedRoles(humans, roles, applications);
  const hasAccessEdges = generateHasAccess(humans, serviceAccounts, agentIdentities, resources);
  const memberOfEdges = generateMemberOf(humans, groups);
  const ownsEdges = generateOwns(humans, serviceAccounts);
  const spawnedEdges = generateSpawned(agentIdentities);

  const allEdges = [
    ...reportsToEdges, ...assignedRoleEdges, ...hasAccessEdges,
    ...memberOfEdges, ...ownsEdges, ...spawnedEdges,
  ];
  console.log(`  Total edges to insert: ${allEdges.length}\n`);

  // -----------------------------------------------------------
  // Phase 3: Insert nodes
  // -----------------------------------------------------------
  console.log("Inserting nodes...");
  await insertNodes("OrgUnit", orgUnits);
  await insertNodes("Application", applications);
  await insertNodes("Resource", resources);
  await insertNodes("Role", roles);
  await insertNodes("Group", groups);
  await insertNodes("HumanIdentity", humans);
  await insertNodes("ServiceAccount", serviceAccounts);
  await insertNodes("AgentIdentity", agentIdentities);

  // -----------------------------------------------------------
  // Phase 4: Insert edges
  // -----------------------------------------------------------
  console.log("\nInserting edges...");
  await insertEdges(allEdges);

  // -----------------------------------------------------------
  // Summary
  // -----------------------------------------------------------
  console.log("\nSeed complete. Summary:");
  console.log(`  OrgUnits:         ${orgUnits.length}`);
  console.log(`  Applications:     ${applications.length}`);
  console.log(`  Resources:        ${resources.length}`);
  console.log(`  Roles:            ${roles.length}`);
  console.log(`  Groups:           ${groups.length}`);
  console.log(`  HumanIdentity:    ${humans.length}`);
  console.log(`  ServiceAccount:   ${serviceAccounts.length}`);
  console.log(`  AgentIdentity:    ${agentIdentities.length}`);
  console.log(`  Total nodes:      ${totalNodes}`);
  console.log(`  Total edges:      ${allEdges.length}`);
  console.log("\nOpen ArcadeDB Studio at http://localhost:2480 to explore the graph.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
