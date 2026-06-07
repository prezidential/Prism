// Generates 200 ServiceAccount nodes.

import { faker } from "@faker-js/faker";
import { IdentityStatus, NodeType } from "../../schema/enums.js";
import type { Application, HumanIdentity, ServiceAccount } from "../../schema/types.js";

const SA_PREFIXES = [
  "svc", "app", "bot", "ci", "deploy", "scan",
  "monitor", "backup", "sync", "ingest", "api", "worker",
];

const STATUS_WEIGHTS: IdentityStatus[] = [
  ...Array<IdentityStatus>(80).fill(IdentityStatus.Active),
  ...Array<IdentityStatus>(10).fill(IdentityStatus.Inactive),
  ...Array<IdentityStatus>(5).fill(IdentityStatus.Orphaned), // no owner found
  ...Array<IdentityStatus>(5).fill(IdentityStatus.PendingReview),
];

function past(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function generateServiceAccounts(
  count: number,
  tenantId: string,
  humans: HumanIdentity[],
  applications: Application[],
): ServiceAccount[] {
  const accounts: ServiceAccount[] = [];

  for (let i = 0; i < count; i++) {
    const status = faker.helpers.arrayElement(STATUS_WEIGHTS);
    const app = faker.helpers.arrayElement(applications);
    const prefix = faker.helpers.arrayElement(SA_PREFIXES);
    const suffix = faker.helpers.arrayElement([app.displayName.toLowerCase().replace(/\s+/g, "-"), faker.word.noun()]);
    const name = `${prefix}-${suffix}`;
    const createdDaysAgo = faker.number.int({ min: 7, max: 1800 });

    // Orphaned accounts deliberately have no owner
    const owner =
      status !== IdentityStatus.Orphaned && faker.datatype.boolean({ probability: 0.75 })
        ? faker.helpers.arrayElement(humans)
        : undefined;

    accounts.push({
      id: faker.string.uuid(),
      tenantId,
      nodeType: NodeType.ServiceAccount,
      externalIds: {
        [app.displayName.toLowerCase().replace(/\s+/g, "-")]: faker.string.alphanumeric(16),
      },
      createdAt: past(createdDaysAgo),
      updatedAt: past(faker.number.int({ min: 0, max: 30 })),
      status,
      riskScore: faker.number.float({
        // Orphaned accounts are *elevated* risk: strictly above 0.5. `min` is
        // inclusive in faker, so 0.51 keeps the "> 0.5" invariant deterministic
        // (0.5 could otherwise be drawn and fail an elevated-risk assertion).
        min: status === IdentityStatus.Orphaned ? 0.51 : 0.0,
        max: status === IdentityStatus.Orphaned ? 0.95 : 0.4,
        fractionDigits: 2,
      }),
      lastActivity: status === IdentityStatus.Active
        ? past(faker.number.int({ min: 0, max: 14 }))
        : past(faker.number.int({ min: 60, max: 730 })),
      tags: status === IdentityStatus.Orphaned ? ["orphaned", "needs-review"] : [],
      metadata: { createdVia: "manual" },
      displayName: name,
      description: `Service account for ${app.displayName} - ${prefix} workload`,
      ownerRef: owner?.id,
      applicationRef: app.id,
      lastRotatedAt: faker.datatype.boolean({ probability: 0.6 })
        ? past(faker.number.int({ min: 1, max: 180 }))
        : undefined,
    });
  }

  return accounts;
}
