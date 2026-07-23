import type { Prisma } from "@prisma/client";

export type FinanceScope =
  | { kind: "all" }
  | { kind: "filtered"; quotationWhere: Prisma.QuotationWhereInput }
  | { kind: "none" };

const FINANCE_FULL_ACCESS_ROLES = ["ADMIN", "ACCOUNTING"];

/**
 * R-03: least-privilege financial read scope, keyed off Role.
 * PROJECTS -> only quotations linked to projects they manage (Project.managerId).
 * Everyone else (incl. TECHNICAL_OFFICE, TEC_APPROVER) -> no financial visibility (BL-143).
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

  return { kind: "none" };
}
