// Generates 500 HumanIdentity nodes with realistic field values.

import { faker } from "@faker-js/faker";
import { EmploymentType, IdentityStatus, NodeType } from "../../schema/enums.js";
import type { HumanIdentity } from "../../schema/types.js";
import type { OrgUnit } from "../../schema/types.js";

const EMPLOYMENT_WEIGHTS: EmploymentType[] = [
  ...Array<EmploymentType>(70).fill(EmploymentType.FTE),
  ...Array<EmploymentType>(20).fill(EmploymentType.Contractor),
  ...Array<EmploymentType>(7).fill(EmploymentType.Vendor),
  ...Array<EmploymentType>(3).fill(EmploymentType.Partner),
];

const STATUS_WEIGHTS: IdentityStatus[] = [
  ...Array<IdentityStatus>(88).fill(IdentityStatus.Active),
  ...Array<IdentityStatus>(5).fill(IdentityStatus.Inactive),
  ...Array<IdentityStatus>(4).fill(IdentityStatus.Suspended),
  ...Array<IdentityStatus>(2).fill(IdentityStatus.PendingReview),
  ...Array<IdentityStatus>(1).fill(IdentityStatus.Orphaned),
];

function past(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function generateHumans(
  count: number,
  tenantId: string,
  orgUnits: OrgUnit[],
): HumanIdentity[] {
  const humans: HumanIdentity[] = [];

  // Build the list first so managers can reference earlier entries
  for (let i = 0; i < count; i++) {
    const orgUnit = faker.helpers.arrayElement(orgUnits);
    const employmentType = faker.helpers.arrayElement(EMPLOYMENT_WEIGHTS);
    const status = faker.helpers.arrayElement(STATUS_WEIGHTS);
    const hireDaysAgo = faker.number.int({ min: 30, max: 3650 });
    const isTerminated = status === IdentityStatus.Inactive && faker.datatype.boolean();

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const domain = "corp.example.com";
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}`;

    // Managers come from earlier in the list (executives/seniors first)
    const managerRef =
      i > 10 && faker.datatype.boolean({ probability: 0.85 })
        ? humans[faker.number.int({ min: 0, max: Math.min(i - 1, 20) })]?.id
        : undefined;

    humans.push({
      id: faker.string.uuid(),
      tenantId,
      nodeType: NodeType.HumanIdentity,
      externalIds: {
        okta: faker.string.alphanumeric(20),
        workday: `WD-${faker.string.numeric(6)}`,
        "active-directory": username,
      },
      createdAt: past(hireDaysAgo + 2),
      updatedAt: past(faker.number.int({ min: 0, max: 30 })),
      status,
      riskScore: faker.number.float({
        min: status === IdentityStatus.Suspended ? 0.4 : 0.0,
        max: status === IdentityStatus.Suspended ? 1.0 : 0.35,
        fractionDigits: 2,
      }),
      lastActivity: status === IdentityStatus.Active
        ? past(faker.number.int({ min: 0, max: 7 }))
        : past(faker.number.int({ min: 90, max: 400 })),
      tags: employmentType !== EmploymentType.FTE ? [employmentType.toLowerCase()] : [],
      metadata: { source: "workday" },
      employeeId: `EMP-${faker.string.numeric(6)}`,
      email: `${username}@${domain}`,
      name: `${firstName} ${lastName}`,
      jobTitle: faker.person.jobTitle(),
      department: orgUnit.displayName,
      location: faker.location.city(),
      employmentType,
      hireDate: past(hireDaysAgo),
      terminationDate: isTerminated
        ? past(faker.number.int({ min: 1, max: 365 }))
        : undefined,
      managerRef,
    });
  }

  return humans;
}
