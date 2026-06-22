"use server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stageChangeSchema = z.object({
  customerId: z.string(),
  newStage: z.enum([
    "NEW",
    "PRICED",
    "FOLLOW_UP",
    "INSPECTION",
    "EXECUTION",
    "RE_INSPECTION_FOLLOWUP",
    "REJECTED",
  ]),
  rejectReason: z.string().optional(),
});

export async function changeCustomerStage(
  input: z.infer<typeof stageChangeSchema>
): Promise<{ success: true } | { error: string }> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, newStage, rejectReason } = parsed.data;

  if (newStage === "REJECTED" && !rejectReason?.trim()) {
    return { error: "errors.rejectReasonRequired" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, ownerId: true, stage: true },
  });

  if (!customer) return { error: "errors.notFound" };

  if (roleCheck.role === "SALES_REP" && customer.ownerId !== roleCheck.userId) {
    return { error: "errors.notAuthorized" };
  }

  const oldStage = customer.stage;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      stage: newStage,
      ...(newStage === "REJECTED" ? { rejectReason: rejectReason!.trim() } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "STAGE_CHANGED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: oldStage,
        to: newStage,
        ...(newStage === "REJECTED" ? { rejectReason: rejectReason!.trim() } : {}),
      }),
    },
  });

  return { success: true };
}
