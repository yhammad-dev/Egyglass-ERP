"use server";

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { AttachmentCategory } from "@prisma/client";
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
import { notifyRole, sendNotification } from "@/lib/notifications/send";

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
        category: a.category,
        createdAt: a.createdAt.toISOString(),
      })),
      measurements,
      approvalStatus: inspection.approvalStatus,
      returnReason: inspection.returnReason,
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
      select: { id: true, assigneeId: true, approvalStatus: true },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // BL-105: فحص الملكية قبل أي كتابة
    if (!canWriteOnInspection(auth.role, auth.userId, inspection.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

    // D-38 (BL-110): بعد اعتماد المدير تُقفَل المقاسات لأي دور
    if (inspection.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedLocked" as const };

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

    // D-38 (BL-110): بعد اعتماد المدير تُقفَل المقاسات لأي دور
    if (owner.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedLocked" as const };

    await deleteMeasurement(parsed.data.measurementId, auth.userId);
    return { success: true as const };
  } catch (error) {
    // مفتاح الخطأ من الاتحاد المُصرَّح في الخدمة (MeasurementErrorKey) — لا `as`
    if (error instanceof MeasurementError) return { error: error.key };
    console.error("[deleteMeasurementAction]", error);
    return { error: "errors.serverError" as const };
  }
}

// 1ج (D-36): رفع فعلي — صورة موقع أو كروكي، كلاهما صورة عبر مسار المرفقات،
// يُميَّزان بـ AttachmentCategory. نفس نمط uploadDrawingAction: يُكتب للقرص ثم صف Attachment.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

// أمان الرفع: allowlist صريح يستبعد image/svg+xml (ناقل XSS عند العرض المضمّن).
// النوع والامتداد يُشتقّان من البايتات المُحقَّقة سيرفر-سايد لا من ادعاء العميل.
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// اشتقاق النوع من البصمة السحرية للبايتات (magic bytes) — لا ثقة بـ mimeType العميل
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  )
    return "image/gif";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

const attachmentSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  category: z.enum(["SITE_PHOTO", "SKETCH"]),
  originalName: z.string().min(1, "errors.required"),
  base64: z.string().min(1, "errors.required"),
});

export async function addInspectionAttachment(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = attachmentSchema.safeParse(input);
    if (!parsed.success) {
      // مفتاح الخطأ الأول من التحقق (نوع/حجم الملف) يصل للواجهة صريحًا
      const first = parsed.error.errors[0]?.message ?? "errors.invalidInput";
      return { error: first as "errors.invalidInput" };
    }

    const { id, category, originalName, base64 } = parsed.data;

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, approvalStatus: true },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // BL-105: فحص الملكية قبل أي كتابة
    if (!canWriteOnInspection(auth.role, auth.userId, inspection.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

    // D-38 (BL-110): بعد اعتماد المدير تُقفَل المرفقات أيضًا لأي دور
    if (inspection.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedLocked" as const };

    // فكّ الترميز ثم افرض الحد على البايتات الفعلية (لا على رقم يرسله العميل)
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) return { error: "errors.invalidInput" as const };
    if (buffer.length > MAX_ATTACHMENT_BYTES)
      return { error: "errors.fileTooLarge" as const };

    // النوع من البصمة السحرية للمحتوى نفسه — svg وأي شيء غير صورة يُرفض هنا
    const mimeType = sniffImageMime(buffer);
    if (!mimeType || !(mimeType in IMAGE_EXT))
      return { error: "errors.invalidFileType" as const };
    const ext = IMAGE_EXT[mimeType];

    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "inspections");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);
    const filePath = `/uploads/inspections/${filename}`;

    const attachment = await prisma.attachment.create({
      data: {
        parent: "INSPECTION",
        parentId: id,
        category: category as AttachmentCategory,
        fileName: originalName,
        filePath,
        mimeType,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "ATTACHMENT_ADDED",
        entity: "InspectionRequest",
        entityId: id,
        details: JSON.stringify({ category, originalName }),
      },
    });

    return {
      success: true as const,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        filePath: attachment.filePath,
        category: attachment.category,
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

    // D-40/D-37 (BL-109): DONE **لا يُخطر المكتب الفني** — الإخطار حصريًا عند اعتماد
    // المدير (approveInspection). DONE هنا حالة تشغيلية للمعاينة، لا بوابة تسليم.

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

// ══ D-40 / BL-109: بوابة اعتماد المعاينة ══════════════════════════════════════
// بُعد منفصل عن InspectionStatus. REP يسجّل بحرية (DRAFT/RETURNED) ثم يقدّم صراحةً
// (submitInspectionForApproval — لا انتقال تلقائي عند الحفظ، يحمي من اعتماد ناقص).
// المدير يعتمد (approveInspection) أو يُرجع (returnInspection). المكتب الفني يُخطَر
// **حصريًا عند APPROVED** (D-37). المقاسات تُقفَل بعد APPROVED (D-38).

const inspectionApprovalIdSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
});

export async function submitInspectionForApproval(input: unknown) {
  try {
    const auth = await requireRole(ALLOWED_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = inspectionApprovalIdSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, assigneeId: true, approvalStatus: true },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // BL-105: REP يقدّم معايناته فقط
    if (!canWriteOnInspection(auth.role, auth.userId, inspection.assigneeId))
      return { error: "errors.inspectionNotAssigned" as const };

    // حارس البوابة: DRAFT/RETURNED فقط (لا PENDING مكرر، لا APPROVED نهائي)
    if (
      inspection.approvalStatus !== "DRAFT" &&
      inspection.approvalStatus !== "RETURNED"
    )
      return { error: "errors.inspectionNotSubmittable" as const };

    // D-40: لا تقديم بلا مقاس واحد على الأقل (لا معاينة فارغة للاعتماد)
    const measurementCount = await prisma.inspectionMeasurement.count({
      where: { inspectionRequestId: parsed.data.id },
    });
    if (measurementCount === 0)
      return { error: "errors.inspectionNoMeasurements" as const };

    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: { approvalStatus: "PENDING_APPROVAL" },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_SUBMITTED_FOR_APPROVAL",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: "قُدّمت المعاينة لاعتماد المدير",
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[submitInspectionForApproval]", error);
    return { error: "errors.serverError" as const };
  }
}

export async function approveInspection(input: unknown) {
  try {
    const auth = await requireRole(MANAGER_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = inspectionApprovalIdSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        approvalStatus: true,
        customer: { select: { name: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // حارس: لا يُعتمد إلا PENDING_APPROVAL (لا DRAFT، لا RETURNED، لا APPROVED ثانية)
    if (inspection.approvalStatus !== "PENDING_APPROVAL")
      return { error: "errors.inspectionNotPending" as const };

    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: auth.userId,
        approvedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_APPROVED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: `اعتمد المدير معاينة العميل ${inspection.customer.name}`,
      },
    });

    // D-37: المكتب الفني يُخطَر **الآن فقط** (بعد الاعتماد) — جاهزة لإعادة التسعير
    await notifyRole("TECHNICAL_OFFICE", {
      title: "notifications.measurementsReadyTitle",
      body: `مقاسات معتمدة للعميل ${inspection.customer.name} — جاهزة لإعادة التسعير`,
      type: "MEASUREMENTS_READY",
      entityId: parsed.data.id,
      entityType: "InspectionRequest",
    });

    return { success: true as const };
  } catch (error) {
    console.error("[approveInspection]", error);
    return { error: "errors.serverError" as const };
  }
}

const returnInspectionSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().trim().min(1, "errors.returnReasonRequired"),
});

export async function returnInspection(input: unknown) {
  try {
    const auth = await requireRole(MANAGER_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = returnInspectionSchema.safeParse(input);
    if (!parsed.success)
      return {
        error:
          parsed.error.flatten().fieldErrors.reason?.[0] ??
          ("errors.invalidInput" as const),
      };

    const inspection = await prisma.inspectionRequest.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        approvalStatus: true,
        assigneeId: true,
        customer: { select: { name: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // حارس: لا يُرجَع إلا PENDING_APPROVAL
    if (inspection.approvalStatus !== "PENDING_APPROVAL")
      return { error: "errors.inspectionNotPending" as const };

    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: {
        approvalStatus: "RETURNED",
        // D-40/D-30: returnReason يبقى أثرًا — لا يُمسح عند إعادة التقديم
        returnReason: parsed.data.reason,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_RETURNED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: `أرجع المدير المعاينة للتصحيح — السبب: ${parsed.data.reason}`,
      },
    });

    // إشعار REP المُسنَد بالسبب (إن وُجد مُسنَد) — نظام الإشعارات بالع (D-39)
    if (inspection.assigneeId) {
      await sendNotification({
        userId: inspection.assigneeId,
        title: "notifications.inspectionReturnedTitle",
        body: `أُرجعت معاينة العميل ${inspection.customer.name} للتصحيح — السبب: ${parsed.data.reason}`,
        type: "INSPECTION_RETURNED",
        entityId: parsed.data.id,
        entityType: "InspectionRequest",
      });
    }

    return { success: true as const };
  } catch (error) {
    console.error("[returnInspection]", error);
    return { error: "errors.serverError" as const };
  }
}
