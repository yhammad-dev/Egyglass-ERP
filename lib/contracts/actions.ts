"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "../finance/scope";
import { createContractCore } from "@/lib/services/contract-core";
import { z } from "zod";

const CONTRACT_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];
// R-03: read-only financial visibility, least-privilege scoped by getFinanceScope.
const CONTRACT_READ_ROLES = [...CONTRACT_ROLES, "REVIEW", "VIEWER", "PROJECTS", "TECHNICAL_OFFICE"];

const createSchema = z.object({
  customerId: z.string().min(1),
  quotationId: z.string().min(1),
  signedAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function createContract(input: unknown) {
  try {
    const roleCheck = await requireRole(CONTRACT_ROLES);
    if (!roleCheck.authorized) return { error: "غير مخول" };

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { error: "بيانات غير صحيحة" };

    const { customerId, quotationId, signedAt, notes } = parsed.data;

    // BL-45 (D-14/D-15): عقد السوشيال يُنشأ حصريًا آليًا من الحسابات عند أول دفعة
    // (addPayment → createContractCore). المسار اليدوي هنا مرفوض لمسار السوشيال
    // **لكل الأدوار بما فيها ADMIN** — لا نيابة عن الحسابات، ولا عقد بلا مال.
    const routeCheck = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { quotationRequest: { select: { technicalRoute: true } } },
    });
    if (routeCheck?.quotationRequest?.technicalRoute === "SOCIAL_MEDIA") {
      return { error: "errors.socialContractAutoOnly" };
    }

    const result = await createContractCore(
      { customerId, quotationId, signedAt, notes },
      roleCheck.userId
    );
    return result;
  } catch (e) {
    console.error(e);
    return { error: "فشل إنشاء العقد" };
  }
}

export async function getContractByQuotation(quotationId: string) {
  try {
    const roleCheck = await requireRole(CONTRACT_READ_ROLES);
    if (!roleCheck.authorized) return null;

    // R-03: only the newly-added least-privilege roles need scope filtering;
    // pre-existing roles (ADMIN/SALES_MANAGER/SALES_REP/REVIEW/VIEWER) keep
    // their existing unrestricted contract-read access unchanged.
    if (roleCheck.role === "PROJECTS" || roleCheck.role === "TECHNICAL_OFFICE") {
      const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
      if (scope.kind === "none") return null;
      if (scope.kind === "filtered") {
        const inScope = await prisma.quotation.findFirst({
          where: { id: quotationId, ...scope.quotationWhere },
          select: { id: true },
        });
        if (!inScope) return null;
      }
    }

    return await prisma.contract.findUnique({
      where: { quotationId },
      include: { createdBy: { select: { name: true } } },
    });
  } catch {
    return null;
  }
}
