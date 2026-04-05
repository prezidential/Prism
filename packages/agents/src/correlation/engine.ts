import type { ArcadeClient } from "@prism/identograph";

export type CorrelationMatchType =
  | "exact_email"
  | "exact_employee_id"
  | "exact_sso_subject"
  | "no_match";

export interface CorrelationResult {
  matched: boolean;
  matchType: CorrelationMatchType;
  existingNodeId?: string;
  confidence: 1.0 | 0.0;
}

export interface CorrelationCandidate {
  email?: string;
  employeeId?: string;
  ssoSubject?: string;
  sourceSystemId: string;
  externalId: string;
}

interface HumanIdentityRow {
  id: string;
}

export class CorrelationEngine {
  constructor(
    private readonly db: ArcadeClient,
    private readonly tenantId: string,
  ) {}

  async correlate(candidate: CorrelationCandidate): Promise<CorrelationResult> {
    const escaped = (v: string): string => v.replace(/'/g, "\\'");

    // 1. Try exact email match
    if (candidate.email !== undefined) {
      const rows = await this.db.query<HumanIdentityRow>(
        `SELECT id FROM HumanIdentity WHERE tenantId = '${escaped(this.tenantId)}' AND email = '${escaped(candidate.email)}'`,
      );
      const first = rows[0];
      if (first !== undefined) {
        return {
          matched: true,
          matchType: "exact_email",
          existingNodeId: first.id,
          confidence: 1.0,
        };
      }
    }

    // 2. Try exact employeeId match
    if (candidate.employeeId !== undefined) {
      const rows = await this.db.query<HumanIdentityRow>(
        `SELECT id FROM HumanIdentity WHERE tenantId = '${escaped(this.tenantId)}' AND employeeId = '${escaped(candidate.employeeId)}'`,
      );
      const first = rows[0];
      if (first !== undefined) {
        return {
          matched: true,
          matchType: "exact_employee_id",
          existingNodeId: first.id,
          confidence: 1.0,
        };
      }
    }

    // 3. Try exact ssoSubject match
    if (candidate.ssoSubject !== undefined) {
      const rows = await this.db.query<HumanIdentityRow>(
        `SELECT id FROM HumanIdentity WHERE tenantId = '${escaped(this.tenantId)}' AND (email = '${escaped(candidate.ssoSubject)}')`,
      );
      const first = rows[0];
      if (first !== undefined) {
        return {
          matched: true,
          matchType: "exact_sso_subject",
          existingNodeId: first.id,
          confidence: 1.0,
        };
      }
    }

    // 4. No match
    return {
      matched: false,
      matchType: "no_match",
      confidence: 0.0,
    };
  }
}
