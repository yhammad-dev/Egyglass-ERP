"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const CONTRACT_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];

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
    const roleCheck = await requireRole([...CONTRACT_ROLES, "REVIEW", "VIEWER"]);
    if (!roleCheck.authorized) return null;

    return await prisma.contract.findUnique({
      where: { quotationId },
      include: { createdBy: { select: { name: true } } },
    });
  } catch {
    return null;
  }
}
