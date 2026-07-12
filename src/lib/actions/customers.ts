"use server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notifyRole, notifyDepartment } from "@/lib/notifications/send";
import { createInspection } from "@/lib/services/inspections";
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
  // دفعة هـ · Phase 4: المرحلة مشتقّة آليًا — التغيير اليدوي استثناء ADMIN فقط
  // (override + قرار الرفض البشري). باقي الأدوار لم تعد تحرّك المرحلة يدويًا.
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, newStage, rejectReason } = parsed.data;

  if (newStage === "REJECTED" && !rejectReason?.trim()) {
    return { error: "errors.rejectReasonRequired" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, ownerId: true, stage: true, name: true, address: true, phone: true },
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

  try {
    if (newStage === "INSPECTION") {
      const existingInspection = await prisma.inspectionRequest.findFirst({
        where: {
          customerId,
          deletedAt: null,
          status: { in: ["REQUESTED", "SCHEDULED"] },
        },
      });

      if (!existingInspection) {
        await createInspection(
          {
            customerId,
            location: "INSIDE_CAIRO",
            address: customer.address || "",
            phone: customer.phone,
            type: "PRICING",
          },
          roleCheck.userId
        );
      }

      await notifyRole("INSPECTION_MANAGER", {
        title: "notifications.stageInspectionTitle",
        body: `تم نقل العميل ${customer.name} إلى مرحلة المعاينة`,
        type: "STAGE_CHANGED",
        entityId: customerId,
        entityType: "Customer",
      });
    } else if (newStage === "PRICED") {
      await notifyDepartment("TECHNICAL_OFFICE", {
        title: "notifications.stagePricedTitle",
        body: `تم نقل العميل ${customer.name} إلى مرحلة التسعير`,
        type: "STAGE_CHANGED",
        entityId: customerId,
        entityType: "Customer",
      });
    }
  } catch {
    // notification failure must not block the operation
  }

  return { success: true };
}

const assignSchema = z.object({
  customerId: z.string(),
  ownerId: z.string().nullable(),
});

export async function assignCustomer(
  input: z.infer<typeof assignSchema>
): Promise<{ success: true } | { error: string }> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, ownerId } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { error: "errors.notFound" };

  const oldOwner = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { ownerId: true },
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: { ownerId },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "OWNER_ASSIGNED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: oldOwner?.ownerId,
        to: ownerId,
      }),
    },
  });

  return { success: true };
}

const coverageSchema = z.object({
  customerId: z.string(),
  coveredById: z.string().nullable(),
});

export async function setCustomerCoverage(
  input: z.infer<typeof coverageSchema>
): Promise<{ success: true } | { error: string }> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = coverageSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, coveredById } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, coveredById: true },
  });
  if (!customer) return { error: "errors.notFound" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { coveredById },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "COVERAGE_UPDATED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: customer.coveredById,
        to: coveredById,
      }),
    },
  });

  return { success: true };
}

const addInteractionSchema = z.object({
  customerId: z.string(),
  type: z.enum(["CALL", "WHATSAPP", "VISIT", "NOTE"]),
  note: z.string().min(1, "errors.required"),
});

export async function addInteraction(
  input: z.infer<typeof addInteractionSchema>
): Promise<
  | { success: true; data: { id: string; type: string; note: string; userName: string; createdAt: Date } }
  | { error: string }
> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = addInteractionSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, type, note } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { error: "errors.notFound" };

  const interaction = await prisma.interaction.create({
    data: {
      customerId,
      userId: roleCheck.userId,
      type: type as any,
      note: note.trim(),
    },
    include: {
      user: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "INTERACTION_ADDED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        interactionId: interaction.id,
        type: interaction.type,
      }),
    },
  });

  return {
    success: true,
    data: {
      id: interaction.id,
      type: interaction.type,
      note: interaction.note,
      userName: interaction.user.name,
      createdAt: interaction.createdAt,
    },
  };
}
