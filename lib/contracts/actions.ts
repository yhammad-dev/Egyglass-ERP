"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "../finance/scope";
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

    const existing = await prisma.contract.findUnique({ where: { quotationId } });
    if (existing) return { error: "يوجد عقد مرتبط بهذا العرض بالفعل" };

    const contract = await prisma.contract.create({
      data: {
        customerId,
        quotationId,
        signedAt: signedAt ? new Date(signedAt) : null,
        notes: notes || null,
        createdById: roleCheck.userId,
      },
    });

    // Advance customer stage to CONTRACT
    await prisma.customer.update({
      where: { id: customerId },
      data: { stage: "CONTRACT" },
    });

    return { success: true, contract };
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
