"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createInspection, scheduleInspection } from "@/lib/services/inspections";
import { sendNotification } from "@/lib/notifications/send";

const locationEnum = z.enum(["INSIDE_CAIRO", "OUTSIDE_CAIRO"]);
const typeEnum = z.enum(["PRICING", "EXECUTION"]);

const createSchema = z.object({
  customerId: z.string().min(1, "errors.required"),
  location: locationEnum,
  address: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  type: typeEnum,
  notes: z.string().optional(),
});

const ALLOWED_ROLES = ["ADMIN", "INSPECTION_MANAGER"];

const scheduleSchema = z.object({
  id: z.string().min(1, "errors.required"),
  scheduledAt: z.string().min(1, "errors.required"),
  assigneeId: z.string().min(1, "errors.required"),
});

export async function scheduleInspectionAction(data: unknown) {
  const auth = await requireRole(ALLOWED_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = scheduleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const inspection = await scheduleInspection(
      parsed.data.id,
      new Date(parsed.data.scheduledAt),
      parsed.data.assigneeId,
      auth.userId
    );
    return { success: true as const, data: inspection };
  } catch {
    return { success: false as const, error: "errors.updateFailed" };
  }
}

export async function createInspectionAction(data: unknown) {
  const auth = await requireRole(ALLOWED_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const inspection = await createInspection(parsed.data, auth.userId);
    return { success: true as const, data: inspection };
  } catch {
    return { success: false as const, error: "errors.createFailed" };
  }
}

export async function getInspectionDetail(id: string) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return null;

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!inspection) return null;

    const [attachments, measurementLogs] = await Promise.all([
      prisma.attachment.findMany({
        where: { parent: "INSPECTION", parentId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.findMany({
        where: { entity: "InspectionRequest", entityId: id, action: "MEASUREMENTS_RECORDED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      id: inspection.id,
      customer: inspection.customer,
      location: inspection.location,
      address: inspection.address,
      phone: inspection.phone,
      notes: inspection.notes,
      status: inspection.status,
      type: inspection.type,
      siteReadiness: inspection.siteReadiness ?? null,
      scheduledAt: inspection.scheduledAt ? inspection.scheduledAt.toISOString() : null,
      dueDate: inspection.dueDate.toISOString(),
      assignee: inspection.assignee,
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        filePath: a.filePath,
        createdAt: a.createdAt.toISOString(),
      })),
      measurements: measurementLogs.map((log) => ({
        id: log.id,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[getInspectionDetail]", error);
    return null;
  }
}

const measurementsSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  width: z.coerce.number().positive("errors.invalidInput"),
  height: z.coerce.number().positive("errors.invalidInput"),
  notes: z.string().optional(),
});

export async function addMeasurements(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = measurementsSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "MEASUREMENTS_RECORDED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: JSON.stringify({
          width: parsed.data.width,
          height: parsed.data.height,
          notes: parsed.data.notes ?? null,
        }),
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[addMeasurements]", error);
    return { error: "errors.serverError" as const };
  }
}

const attachmentSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  fileName: z.string().min(1, "errors.required"),
  filePath: z.string().min(1, "errors.required"),
});

export async function addInspectionAttachment(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = attachmentSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    const attachment = await prisma.attachment.create({
      data: {
        parent: "INSPECTION",
        parentId: parsed.data.id,
        fileName: parsed.data.fileName,
        filePath: parsed.data.filePath,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "ATTACHMENT_ADDED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: `تم إضافة مرفق: ${parsed.data.fileName}`,
      },
    });

    return {
      success: true as const,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        filePath: attachment.filePath,
        createdAt: attachment.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("[addInspectionAttachment]", error);
    return { error: "errors.serverError" as const };
  }
}

const statusEnum = z.enum(["REQUESTED", "SCHEDULED", "DONE", "OVERDUE"]);

const updateStatusSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  status: statusEnum,
});

export async function updateInspectionStatus(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
      include: { customer: { select: { name: true } } },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "UPDATE_STATUS",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: `تم تغيير حالة المعاينة من ${inspection.status} إلى ${parsed.data.status}`,
      },
    });

    if (parsed.data.status === "DONE") {
      const technicalOfficeUsers = await prisma.user.findMany({
        where: { department: "TECHNICAL_OFFICE", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        technicalOfficeUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.inspectionCompletedTitle",
            body: `تم إكمال معاينة العميل ${inspection.customer.name}`,
            type: "INSPECTION_COMPLETED",
            entityId: parsed.data.id,
            entityType: "InspectionRequest",
          })
        )
      );
    }

    return { success: true as const };
  } catch (error) {
    console.error("[updateInspectionStatus]", error);
    return { error: "errors.serverError" as const };
  }
}

const siteReadinessSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  siteReadiness: z.boolean().nullable(),
});

export async function updateSiteReadiness(input: unknown) {
  try {
    const auth = await requireRole(["ADMIN", "INSPECTION_MANAGER"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = siteReadinessSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, siteReadiness } = parsed.data;

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    await prisma.inspectionRequest.update({
      where: { id },
      data: { siteReadiness },
    });

    const details =
      siteReadiness === true
        ? "الموقع جاهز"
        : siteReadiness === false
        ? "الموقع غير جاهز"
        : "تم إلغاء تحديد جاهزية الموقع";

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "SITE_READINESS_UPDATED",
        entity: "InspectionRequest",
        entityId: id,
        details,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[updateSiteReadiness]", error);
    return { error: "errors.serverError" as const };
  }
}
