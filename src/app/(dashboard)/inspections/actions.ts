"use server";

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { uploadDirFor, uploadUrl } from "@/lib/storage/paths";
import type { AttachmentCategory, Prisma } from "@prisma/client";
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
// IN-37: القاعدة الكاملة (حالة الطلب + مرحلة العميل) — المصدر الوحيد
import { recomputeAfterInspection } from "@/lib/services/status-derivation";
// IN-49: نطاق المكتب الفني القائم — يُستدعى ولا يُعاد كتابته
import { buildWhere } from "@/lib/services/tec";

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
  /**
   * IN-48 (D-IN-15): جاهزية الموقع تُعلَن من المبيعات وقت الطلب.
   * ثلاثية صريحة: "READY" · "NOT_READY" · "UNCONFIRMED" — **بلا افتراضي**، فالمندوب
   * مُجبَر على القراءة والاختيار. تُحوَّل لـ`boolean | null` أدناه لأن العمود القائم
   * `siteReadiness Boolean?` (لا عمود جديد، لا migration).
   */
  siteReadiness: z.enum(["READY", "NOT_READY", "UNCONFIRMED"]),
});

/** IN-48: ثلاثية الواجهة → العمود البولياني القائم. UNCONFIRMED = null (يحجب الجدولة). */
function toSiteReadiness(
  value: "READY" | "NOT_READY" | "UNCONFIRMED"
): boolean | null {
  if (value === "READY") return true;
  if (value === "NOT_READY") return false;
  return null;
}

// 🔴 ALLOWED_ROLES = أدوار **الكتابة** (مقاس/مرفق/تقديم). لا يُضاف إليها دور قراءة
// أبدًا: هي مستعملة في addMeasurementAction · deleteMeasurementAction ·
// addInspectionAttachment · submitInspectionForApproval. أي توسيع لها = منح كتابة.
const ALLOWED_ROLES = ["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"];
const MANAGER_ROLES = ["ADMIN", "INSPECTION_MANAGER"];

/**
 * IN-49 (D-IN-12): أدوار **قراءة تفاصيل المعاينة** — قائمة منفصلة عن الكتابة عمدًا.
 *
 * الجذر: المبيعات تطلب المعاينة وتُخطَر بتسجيل مقاساتها ولا تستطيع فتحها، والمكتب
 * الفني يُطلب منه إعادة التسعير على مقاسات لا يراها. القسم يعمل والبيانات تموت عنده.
 *
 * 🔴 لماذا قائمة ثانية لا توسيع للأولى: `ALLOWED_ROLES` تحرس مسارات الكتابة الأربعة،
 * و`canWriteOnInspection` يعيد `true` لكل دور ليس `INSPECTION_REP` — فإضافة
 * `SALES_REP` هناك كانت ستمنحه **كتابة المقاسات** لا قراءتها. القراءة والكتابة
 * قائمتان منفصلتان، ولا تُدمجان.
 *
 * النطاق لكل دور يُفرض أدناه في `getInspectionDetail` بإعادة استخدام دالة نطاق
 * قسمه القائمة — لا شروط ملكية جديدة (نفس علّة IN-12: نسختان من قاعدة = انحراف).
 */
const DETAIL_READ_ROLES = [
  ...ALLOWED_ROLES,
  "SALES_REP",
  "SALES_MANAGER",
  "TECHNICAL_OFFICE",
  "TEC_LEAD",
  "TEC_APPROVER",
];
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
  } catch (e) {
    // IN-11: حارس الحالة الجديد داخل الخدمة يرفع InspectionError بمفتاح مترجم —
    // ابتلاعه في `errors.updateFailed` كان سيُظهر «فشل التحديث» بدل سبب الرفض.
    // نفس نمط createInspectionAction أدناه.
    if (e instanceof InspectionError)
      return { success: false as const, error: e.message };
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
    const inspection = await createInspection(
      {
        ...parsed.data,
        // IN-48: الثلاثية تُترجَم عند حدّ الأكشن، فالخدمة ترى `boolean | null` وحده
        siteReadiness: toSiteReadiness(parsed.data.siteReadiness),
      },
      auth.userId
    );
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

  // IN-18 (يُغلِق BL-93 — قرار يوسف، موجة IN-A): **hard-scope** على التعداد.
  // كان بلا نطاق ملكية إطلاقًا ⇒ أي SALES_REP يمرّر أي customerId فيقرأ أكواد
  // ومسارات طلبات عميل زميله. النمط المُعاد استخدامه هو نفسه في العملاء
  // (`services/customers.ts` → OR[ownerId, coveredById]) — لا قاعدة ملكية جديدة.
  //
  // ⚠️ حدّ صريح: هذا يضيّق **القراءة/التعداد**. الكتابة عبر-مندوب تبقى مسموحة
  // بـsoft-control (R-02/D-32: إشعار المالك + ActivityLog) داخل `createInspection`
  // ولم تُمَس هنا — تضييقها قرار سياسة منفصل لم يُتخذ.
  const where: Prisma.QuotationRequestWhereInput = {
    customerId: parsed.data,
    deletedAt: null,
    inspectionRequestId: null,
    status: { not: "DONE" },
  };
  if (auth.role === "SALES_REP") {
    where.customer = {
      OR: [{ ownerId: auth.userId }, { coveredById: auth.userId }],
    };
  }

  const requests = await prisma.quotationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, technicalRoute: true },
  });
  return { success: true as const, data: requests };
}

export async function getInspectionDetail(id: string) {
  try {
    const auth = await requireRole(DETAIL_READ_ROLES);
    if (!auth.authorized) return null;

    // `findFirst` لا `findUnique`: يسمح بإضافة `deletedAt` للشرط. القائمة والاشتقاق
    // يستثنيان المحذوف منطقيًا (buildInspectionScope · recomputeCustomerStage) وهذه
    // القراءة كانت الوحيدة التي لا تفعل — فرق كان سيصير ثغرة يوم يُبنى soft-delete.
    const inspection = await prisma.inspectionRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        // IN-49: حقول الملكية لنطاق المبيعات — نفس زوج services/customers.ts
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            ownerId: true,
            coveredById: true,
          },
        },
        assignee: { select: { id: true, name: true } },
        // IN-39: سياق الطلب — كود/مسار/نوع/ملخّص. مُتحقَّق أن أي شاشة معاينة لا
        // تقرأ `summary` اليوم (IN-20) رغم وجوده. وهو أيضًا مصدر نطاق المكتب الفني.
        quotationRequest: {
          select: {
            id: true,
            code: true,
            technicalRoute: true,
            salesRequestType: true,
            summary: true,
          },
        },
      },
    });
    if (!inspection) return null;

    // ── IN-49: نطاق القراءة لكل دور — خارج النطاق ⇒ null ⇒ 404 (لا صفحة منع) ──
    if (auth.role === "INSPECTION_REP" && inspection.assigneeId !== auth.userId) {
      return null;
    }

    // المبيعات: معاينات عملائه فقط. نفس قاعدة العملاء حرفيًا (ownerId أو التغطية).
    if (
      auth.role === "SALES_REP" &&
      inspection.customer.ownerId !== auth.userId &&
      inspection.customer.coveredById !== auth.userId
    ) {
      return null;
    }

    // المكتب الفني: المعاينة مرئية إن كان **طلبها** داخل نطاقه القائم. النطاق
    // يُقرأ من `buildWhere` نفسها (مسار المهندس/التيم ليدر) — لا شرط جديد هنا.
    if (
      auth.role === "TECHNICAL_OFFICE" ||
      auth.role === "TEC_LEAD" ||
      auth.role === "TEC_APPROVER"
    ) {
      if (!inspection.quotationRequest) return null;
      const tecScope = await buildWhere(auth.userId, auth.role);
      const inScope = await prisma.quotationRequest.findFirst({
        where: { ...tecScope, id: inspection.quotationRequest.id },
        select: { id: true },
      });
      if (!inScope) return null;
    }

    // 🔴 IN-49/IN-06 (تعارض أُغلق): IN-06 يحجب المقاسات عن المكتب الفني قبل الاعتماد
    // (D-37: غير نهائية فلا تُسعَّر) — لكن IN-49 فتح له `/inspections/{id}` الذي كان
    // يعيد المقاسات **بلا شرط**، فيقرأ من باب ما مُنع منه في الباب الآخر.
    // القاعدة الواحدة: أدوار المكتب الفني ترى المقاسات **بعد الاعتماد فقط**.
    // المبيعات مستثناة عن قصد: تُخطَر بتسجيل المقاسات قبل الاعتماد أصلًا
    // (W-02/SAL-R10 في inspection-measurements) فحجبها عنها يخالف قاعدة قائمة.
    const isTecReader =
      auth.role === "TECHNICAL_OFFICE" ||
      auth.role === "TEC_LEAD" ||
      auth.role === "TEC_APPROVER";
    const measurementsVisible =
      !isTecReader || inspection.approvalStatus === "APPROVED";

    // 1ب: المقاسات من الجدول المهيكل — لا ActivityLog
    const [attachments, measurements] = await Promise.all([
      prisma.attachment.findMany({
        where: { parent: "INSPECTION", parentId: id },
        orderBy: { createdAt: "desc" },
      }),
      // لا تُقرأ من القاعدة أصلًا لمن لا يراها — الحجب عند المصدر لا عند العرض
      measurementsVisible ? listMeasurements(id) : Promise.resolve([]),
    ]);

    return {
      id: inspection.id,
      // الملكية لا تُسلَّم للعميل: النطاق فُرض أعلاه سيرفر-سايد، والواجهة لا تحتاجها
      customer: {
        id: inspection.customer.id,
        name: inspection.customer.name,
        phone: inspection.customer.phone,
      },
      // IN-49: الخادم يقرّر من يكتب، والواجهة تعرض فقط. `canWrite` مشتقّ من نفس
      // ALLOWED_ROLES التي تحرس الأكشنات ⇒ مصدر واحد، فلا تتباعد الواجهة عن الحارس.
      canWrite: ALLOWED_ROLES.includes(auth.role),
      /**
       * 🔴 IN-48 (تصحيح مراجعة): **مسار خروج داخل المنتج** لجاهزية الموقع.
       *
       * العيب الذي أُصلح: سحبتُ الكتابة من المدير وتركتُ الحقل بلا أي واجهة تعديل
       * لأي دور ⇒ معاينة أُنشئت بـ«لم يؤكّد العميل» تصير **غير قابلة للجدولة أبدًا**،
       * والصفوف المُنشأة بين تاريخ الحدّ ويوم الدمج كذلك. أي أنني أنتجتُ **نفس فئة
       * عيب الصف المحبوس** (IN-07) التي يقوم هذا البند على منعها.
       *
       * ولماذا **المبيعات** هي صاحبة التصحيح لا المدير: D-IN-15 يقول إن المبيعات
       * تُعلن الجاهزية لأن العميل هو مصدرها. القرار لم يقل «مرة واحدة عند الإنشاء» —
       * فمن يملك الإعلان يملك تصحيحه بعد أن يؤكّد العميل. المدير يبقى مستهلكًا فقط،
       * وهو جوهر IN-48. (وشاشة التفاصيل متاحة للمبيعات أصلًا من IN-49.)
       */
      canEditSiteReadiness:
        auth.role === "ADMIN" ||
        auth.role === "SALES_MANAGER" ||
        (auth.role === "SALES_REP" &&
          (inspection.customer.ownerId === auth.userId ||
            inspection.customer.coveredById === auth.userId)),
      /**
       * IN-06/IN-49: المقاسات محجوبة عن المكتب الفني قبل الاعتماد. تُبلَّغ الواجهة
       * صراحةً كي تعرض السبب («لم تُعتمد بعد») بدل جدول فارغ يُقرأ كـ«لا مقاسات».
       */
      measurementsVisible,
      // IN-39: سياق الطلب (null لو المعاينة بلا طلب مرتبط — لا يحدث بعد D-31)
      request: inspection.quotationRequest
        ? {
            id: inspection.quotationRequest.id,
            code: inspection.quotationRequest.code,
            technicalRoute: inspection.quotationRequest.technicalRoute,
            salesRequestType: inspection.quotationRequest.salesRequestType,
            summary: inspection.quotationRequest.summary,
          }
        : null,
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
    // TO-11: الجذر خارج public/ — الـfilePath المخزَّن لا يتغيّر (/uploads/inspections/…)
    const uploadDir = uploadDirFor("inspections");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);
    const filePath = uploadUrl("inspections", filename);

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

// IN-07: `OVERDUE` **محذوفة من القيم المقبولة من العميل**. التأخير حالة **مشتقّة**
// من `dueDate < now` (المصدر الوحيد: `services/inspections.ts` → `effectiveStatus`)
// لا قيمة تُكتب يدويًا. كتابتها كانت تُنتج عيبين معًا:
//   (١) لوحة تكذب: المدير يعلّم معاينة لم يفت موعدها كمتأخرة.
//   (٢) الأخطر — صف محبوس: بعد الكتابة لم تعد الحالة REQUESTED فيختفي زر
//       «جدولة» من القائمة نهائيًا، فتبقى المعاينة بلا توزيع.
// القيمة تبقى في enum قاعدة البيانات (صفوف قديمة) وتبقى معروضة ومترجمة — الممنوع
// هو **كتابتها**، لا قراءتها.
const statusEnum = z.enum(["REQUESTED", "SCHEDULED", "DONE"]);

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

    // IN-13: القفل بعد الاعتماد كان يغطي المقاسات والمرفقات فقط، وتغيير الحالة
    // يمرّ فوق معاينة معتمدة — فتُرجَع DONE إلى REQUESTED مع بقاء `approvedById`
    // و`approvedAt` كما هما، ويكون المكتب الفني قد أُخطر بمقاسات «معتمدة» لمعاينة
    // عادت قيد التنفيذ. الفتح المُقنَّن بعد الاعتماد بند الموجة B لا هذه.
    if (inspection.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedNoChange" as const };

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

    // 🔴 IN-37 — هنا كان الجذر. `DONE` هو الحدث الوحيد الذي يُسقط `inspectionActive`،
    // وكان يُكتب **بلا أي إعادة اشتقاق** ⇒ `Customer.stage` تبقى `INSPECTION` للأبد
    // ومعها `QuotationRequest.status` عند `ON_HOLD`. هذا حرفيًا ما رآه يوسف.
    // بلا معاملة هنا (الكتابة والسجل أعلاه بلا معاملة أصلًا — لا أُنشئ واحدة في بند
    // هدفه التوصيل)، ولذلك محوَّطة: فشل الاشتقاق لا يُبطل تغيير حالة تمّ فعلًا
    // (نمط D-39). الخطأ يُسجَّل لا يُبتلع — الاشتقاق الصامت الفاشل هو أصل هذا البند.
    try {
      await recomputeAfterInspection(
        parsed.data.id,
        inspection.customerId,
        auth.userId
      );
    } catch (error) {
      console.error("[updateInspectionStatus/recomputeAfterInspection]", error);
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

/**
 * IN-48 (D-IN-15): **سُحبت من مدير المعاينات.** جاهزية الموقع حقيقة يعرفها العميل،
 * ويعلنها مندوب المبيعات وقت الطلب (حوار طلب المعاينة) — المدير **يستهلكها** ليقرّر
 * الجدولة، لا يُدخلها. إدخالها من المدير كان يعني تسجيل حقيقة ميدانية بالسماع.
 *
 * 🔴 الأكشن باقٍ لـ`ADMIN` وحده كصمّام تصحيح (خطأ إدخال من المبيعات، أو صف قديم
 * بلا قيمة يلزم فتحه للجدولة) — لا كمسار تشغيلي. الواجهة لا تعرضه لأي دور
 * (`inspection-detail-client` لا يعرض العنصر لأدوار المعاينة)، وكل استدعاء مُسجَّل
 * في ActivityLog كما كان.
 */
export async function updateSiteReadiness(input: unknown) {
  try {
    // 🔴 تصحيح مراجعة: **ليس ADMIN-only.** قصره على ADMIN بلا أي واجهة جعل معاينة
    // بـ«لم يؤكّد العميل» طريقًا مسدودًا لا يُجدوَل أبدًا — نفس فئة عيب الصف المحبوس
    // (IN-07) التي يقوم هذا البند على منعها. المصرَّح لهم: ADMIN · SALES_MANAGER ·
    // و SALES_REP **لعملائه وحدهم**. مدير المعاينات ومندوبها مستبعدان عن قصد: هذا IN-48.
    const auth = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = siteReadinessSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, siteReadiness } = parsed.data;

    const inspection = await prisma.inspectionRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        approvalStatus: true,
        customer: { select: { ownerId: true, coveredById: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // الحارس على **السجل** لا على الدور وحده (L-05) — نفس نطاق IN-49 حرفيًا
    if (
      auth.role === "SALES_REP" &&
      inspection.customer.ownerId !== auth.userId &&
      inspection.customer.coveredById !== auth.userId
    ) {
      return { error: "errors.notAuthorized" as const };
    }

    // IN-13 (توسيع بمسار ثالث خارج نصّ البند — راجعه): البند نصّ على «الجدولة
    // والإسناد»، وهذا مسار ثالث بنفس العيب حرفيًا — جاهزية الموقع تُقلَب على معاينة
    // معتمدة أُخطِر بها المكتب الفني، مع بقاء approvedById/approvedAt كما هما.
    // تركه يعني قفلًا بثقب معروف، فأُضيف؛ وإن رأيته توسيعًا غير مرغوب فهذه الكتلة
    // وحدها تُحذف بلا أثر على البنود السبعة.
    if (inspection.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedNoChange" as const };

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
        // IN-50: الحالة السابقة تُقرأ لتُسجَّل في الأثر (من ماذا إلى DONE)
        status: true,
        // IN-37: مالك المعاينة لازم لإعادة اشتقاق مرحلته بعد الاعتماد
        customerId: true,
        customer: { select: { name: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // حارس: لا يُعتمد إلا PENDING_APPROVAL (لا DRAFT، لا RETURNED، لا APPROVED ثانية)
    if (inspection.approvalStatus !== "PENDING_APPROVAL")
      return { error: "errors.inspectionNotPending" as const };

    // 🔴 IN-50 (قرار يوسف، الخيار أ): **الاعتماد يُنهي المعاينة تشغيليًا.**
    // قبله كان `approvalStatus` و`InspectionStatus` بُعدين منفصلين تمامًا، فمعاينة
    // تُعتمد وهي `SCHEDULED` تبقى `inspectionActive = true` للأبد — ثم يرفض حارس
    // IN-13 تعليمها `DONE` لأنها معتمدة ⇒ **صف محبوس ومرحلة عميل لا تخرج من
    // INSPECTION مهما فعل المستخدم** (مُتحقَّق: معاينتان في القاعدة بهذا الوصف).
    // الآن الاعتماد يكتب الاثنين معًا في نفس الـupdate — لا تسلسل يدوي يُنسى،
    // ولا حاجة لتعليم DONE بعد الاعتماد (وهو المحجوب بحارس IN-13 أصلًا).
    // متسق مع D-40: الاعتماد بوابة التسليم النهائية لدورة المعاينة.
    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: auth.userId,
        approvedAt: new Date(),
        status: "DONE",
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_APPROVED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        // IN-50: الأثر يحمل الانتقال التشغيلي المصحوب بالاعتماد — لا اعتماد صامت
        details: `اعتمد المدير معاينة العميل ${inspection.customer.name} — الحالة ${inspection.status} ← DONE`,
      },
    });

    // ── IN-47 (D-IN-13): وجهة الإشعار = صفحة **الطلب** لا صفحة المعاينة ──
    // العيب: `entityType: "InspectionRequest"` كان يُشتق منه `/inspections/{id}`
    // (`notifications-bell.tsx` ENTITY_ROUTES) وهي صفحة حارسها لا يشمل المكتب الفني
    // ⇒ redirect صامت إلى /dashboard. والأسوأ أن الضغطة **تعلّم الإشعار مقروءًا**
    // و`GET /api/notifications` لا يُرجع المقروء ⇒ الإشعار يُحرق بلا أن يُسلَّم.
    // العلاج عند المُرسِل لا في الجرس: الجرس يشتق من entityType وحده ولا يعرف الدور،
    // فتوجيهه بالدور كان سيبني منطق صلاحيات في مكوّن عميل. الطلب هو الكيان الذي
    // يملك المكتب الفني صفحته فعلًا، وهو أيضًا مكان إعادة التسعير المطلوبة.
    const linkedRequest = await prisma.quotationRequest.findFirst({
      where: { inspectionRequestId: parsed.data.id },
      select: { id: true },
    });
    if (!linkedRequest) {
      // بعد D-31 لا تُنشأ معاينة بلا طلب. يُسجَّل تحذيرًا لا يُبتلع.
      console.warn(
        `[approveInspection] INSPECTION_WITHOUT_REQUEST id=${parsed.data.id} — الإشعار بلا وجهة قابلة للفتح`
      );
    }
    await notifyRole("TECHNICAL_OFFICE", {
      title: "notifications.measurementsReadyTitle",
      body: `مقاسات معتمدة للعميل ${inspection.customer.name} — جاهزة لإعادة التسعير`,
      type: "MEASUREMENTS_READY",
      entityId: linkedRequest?.id ?? parsed.data.id,
      entityType: linkedRequest ? "QuotationRequest" : "InspectionRequest",
    });

    // IN-37 + IN-50: هذا الاستدعاء **مُحرِّك حقيقي** الآن — الـupdate أعلاه كتب
    // `status = "DONE"` فأسقط `inspectionActive`، فيسقط معه حجب `INSPECTION` عن
    // `hasQuotation`/`hasContract` (ترتيب الأولوية في status-derivation.ts:54-58)
    // ⇒ مرحلة العميل تتقدّم فعليًا عند الاعتماد.
    // (قبل IN-50 كان مُصحِّحًا فقط، لأن الاعتماد لم يكن يمسّ `status` إطلاقًا.)
    try {
      await recomputeAfterInspection(
        parsed.data.id,
        inspection.customerId,
        auth.userId
      );
    } catch (error) {
      console.error("[approveInspection/recomputeAfterInspection]", error);
    }

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
