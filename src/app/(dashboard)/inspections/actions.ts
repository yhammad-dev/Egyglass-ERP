"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  createInspection,
  scheduleInspection,
  InspectionError,
} from "@/lib/services/inspections";
import {
  addMeasurement,
  deleteMeasurement,
  listMeasurements,
  getMeasurementAssignee,
  MeasurementError,
} from "@/lib/services/inspection-measurements";
import { sendNotification } from "@/lib/notifications/send";

const locationEnum = z.enum(["INSIDE_CAIRO", "OUTSIDE_CAIRO"]);
const typeEnum = z.enum(["PRICING", "EXECUTION"]);

const createSchema = z.object({
  customerId: z.string().min(1, "errors.required"),
  // D-31 (BL-91): الطلب إلزامي — يختاره المندوب صراحةً، لا تخمين
  quotationRequestId: z.string().min(1, "errors.requestNotSelectable"),
  location: locationEnum,
  address: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  type: typeEnum,
  notes: z.string().optional(),
});

const ALLOWED_ROLES = ["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"];
const MANAGER_ROLES = ["ADMIN", "INSPECTION_MANAGER"];
// D-37: مدير المعاينات يوزّع ويعتمد — لا يُنشئ. الطلب = المبيعات وحدها (D-31: من شاشة
// العميل باختيار QuotationRequest صريح). الجدولة/التعيين تبقى للمدير (MANAGER_ROLES).
const CREATE_ROLES = ["SALES_REP", "SALES_MANAGER", "ADMIN"];

// BL-105: تضييق الملكية على **الكتابة** لا القراءة وحدها (STD-15: الترشيح ليس حارسًا).
// INSPECTION_REP يسجّل على المعاينات المسندة إليه فقط — نفس تضييق getInspectionDetail.
// ADMIN/INSPECTION_MANAGER بلا تضييق (المدير يغطّي ويصحّح ميدانيًا).
function canWriteOnInspection(
  role: string,
  userId: string,
  assigneeId: string | null
): boolean {
  return role !== "INSPECTION_REP" || assigneeId === userId;
}

const scheduleSchema = z.object({
  id: z.string().min(1, "errors.required"),
  scheduledAt: z.string().min(1, "errors.required"),
  assigneeId: z.string().min(1, "errors.required"),
});

export async function scheduleInspectionAction(data: unknown) {
  const auth = await requireRole(MANAGER_ROLES);
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
  const auth = await requireRole(CREATE_ROLES);
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
  } catch (e) {
    // D-31: الحارس server-side (طلب غير مؤهَّل) يصل للواجهة برسالة صريحة
    if (e instanceof InspectionError)
      return { success: false as const, error: e.message };
    return { success: false as const, error: "errors.createFailed" };
  }
}

// D-31 (BL-91): طلبات العميل المؤهَّلة للربط بمعاينة — يختار المندوب منها صراحةً
export async function getSelectableRequests(customerId: string) {
  const auth = await requireRole(CREATE_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = z.string().min(1).safeParse(customerId);
  if (!parsed.success)
    return { success: false as const, error: "errors.invalidInput" };

  // BL-93 (مفتوح): لا نطاق ملكية للمندوب هنا — قرار سياسة (hard-scope مثل
  // changeCustomerStage أم R-02 soft-control). لم يُخترع؛ يُحسم بيد يوسف.
  const requests = await prisma.quotationRequest.findMany({
    where: {
      customerId: parsed.data,
      deletedAt: null,
      inspectionRequestId: null,
      status: { not: "DONE" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, technicalRoute: true },
  });
  return { success: true as const, data: requests };
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

    if (auth.role === "INSPECTION_REP" && inspection.assigneeId !== auth.userId) {
      return null;
    }

    // 1ب: المقاسات من الجدول المهيكل — لا ActivityLog
    const [attachments, measurements] = await Promise.all([
      prisma.attachment.findMany({
        where: { parent: "INSPECTION", parentId: id },
        orderBy: { createdAt: "desc" },
      }),
      listMeasurements(id),
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
      measurements,
    };
  } catch (error) {
    console.error("[getInspectionDetail]", error);
    return null;
  }
}

// 1ب (BL-81): صف مقاس مهيكل — البيان/العرض/الارتفاع/الوحدة/الكمية/ملاحظات
// `multipleOf(0.001)`: العمود Decimal(12,3) — أي دقة أعلى كانت ستُقرَّب بصمت،
// والمقاسات تغذّي المطابقة الثلاثية (BL-86). الرفض الصريح خير من تقريب صامت.
const addMeasurementSchema = z.object({
  inspectionRequestId: z.string().min(1, "errors.invalidInput"),
  description: z.string().trim().min(1, "errors.required"),
  width: z.coerce.number().positive("errors.invalidInput").multipleOf(0.001, "errors.invalidInput"),
  height: z.coerce.number().positive("errors.invalidInput").multipleOf(0.001, "errors.invalidInput"),
  unit: z.enum(["SQM", "CBM"]),
  quantity: z.coerce.number().int().positive("errors.invalidInput"),
  notes: z.string().optional(),
});

export async function addMeasurementAction(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = addMeasurementSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.inspectionRequestId },
      select: { id: true, assigneeId: true },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // BL-105: فحص الملكية قبل أي كتابة
    if (!canWriteOnInspection(auth.role, auth.userId, inspection.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

    const row = await addMeasurement(parsed.data, auth.userId);
    return { success: true as const, data: row };
  } catch (error) {
    // مفتاح الخطأ من الاتحاد المُصرَّح في الخدمة (MeasurementErrorKey) — لا `as`
    if (error instanceof MeasurementError) return { error: error.key };
    console.error("[addMeasurementAction]", error);
    return { error: "errors.serverError" as const };
  }
}

const deleteMeasurementSchema = z.object({
  measurementId: z.string().min(1, "errors.invalidInput"),
});

export async function deleteMeasurementAction(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = deleteMeasurementSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    // BL-105: الملكية تُقرأ من معاينة الصف نفسه — لا من مُدخل العميل
    const owner = await getMeasurementAssignee(parsed.data.measurementId);
    if (!owner) return { error: "errors.notFound" as const };

    if (!canWriteOnInspection(auth.role, auth.userId, owner.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

    await deleteMeasurement(parsed.data.measurementId, auth.userId);
    return { success: true as const };
  } catch (error) {
    // مفتاح الخطأ من الاتحاد المُصرَّح في الخدمة (MeasurementErrorKey) — لا `as`
    if (error instanceof MeasurementError) return { error: error.key };
    console.error("[deleteMeasurementAction]", error);
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

    // BL-105: فحص الملكية قبل أي كتابة
    if (!canWriteOnInspection(auth.role, auth.userId, inspection.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

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
    const auth = await requireRole(MANAGER_ROLES);
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
