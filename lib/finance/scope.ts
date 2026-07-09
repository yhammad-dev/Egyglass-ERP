import type { Prisma } from "@prisma/client";

export type FinanceScope =
  | { kind: "all" }
  | { kind: "filtered"; quotationWhere: Prisma.QuotationWhereInput }
  | { kind: "none" };

const FINANCE_FULL_ACCESS_ROLES = ["ADMIN", "ACCOUNTING"];

/**
 * R-03: least-privilege financial read scope, keyed off Role.
 * PROJECTS -> only quotations linked to projects they manage (Project.managerId).
 * TECHNICAL_OFFICE -> only the PROJECTS technicalRoute (Nouran's team), not SOCIAL_MEDIA.
 * Everyone else (incl. TEC_APPROVER) -> no financial visibility.
 */
export function getFinanceScope(role: string, userId: string): FinanceScope {
  if (FINANCE_FULL_ACCESS_ROLES.includes(role)) {
    return { kind: "all" };
  }

  if (role === "PROJECTS") {
    return {
      kind: "filtered",
      quotationWhere: { project: { managerId: userId } },
    };
  }

  if (role === "TECHNICAL_OFFICE") {
    return {
      kind: "filtered",
      quotationWhere: { quotationRequest: { technicalRoute: "PROJECTS" } },
    };
  }

  return { kind: "none" };
}
