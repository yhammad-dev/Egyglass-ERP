"use server";

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { uploadDirFor, uploadUrl, UPLOAD_IMAGE_EXT } from "@/lib/storage/paths";
import type { AttachmentCategory, Prisma } from "@prisma/client";
import {
  createInspection,
  scheduleInspection,
  // IN-17: اشتقاق التأخير من مصدره الوحيد — لا شرط محلي في هذه الشاشة
  deriveEffectiveStatus,
  InspectionError,
} from "@/lib/services/inspections";
// D-IN-22 (C2-fix-2): النهائيتان لا تُمسّان عند رفع التأجيل — نفس المصدر الوحيد
import { isTerminalInspectionStatus } from "@/lib/services/inspection-status";
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

/**
 * ✅ BL-160 (موجة C2) — **البند مُغلق.** كان `siteReadiness Boolean?` لا يفرّق بين
 * «سُئل العميل فقال لست متأكدًا» و«لم يُسأل أحد»: الاثنان `null`. ولذلك اضطرت B2
 * لحدّ زمني **صلب** (`SITE_READINESS_GATE_FROM`) للتمييز بالتاريخ — وهو ما رصده
 * البند نفسه كعلّة. الآن التمييز **في البيانات**: `UNCONFIRMED` قيمة صريحة.
 *
 * 🔴 **و`null` تبقى قيمة رابعة ذات معنى** (23 صفًّا تاريخيًا): «لم يُسأل أصلًا».
 * لا تُعامَل كـ`UNCONFIRMED` — ذلك ادعاء بسؤال لم يقع، والفرق بينهما هو جوهر البند.
 */
const SITE_READINESS_ENUM = z.enum(["READY", "NOT_READY", "UNCONFIRMED"]);

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
   * IN-48 (D-IN-15): جاهزية الموقع تُعلَن من المبيعات وقت الطلب — **بلا افتراضي**،
   * فالمندوب مُجبَر على القراءة والاختيار.
   *
   * ✅ BL-160 (موجة C2): العمود صار `SiteReadiness` enum بنفس القيم الثلاث، فسقط
   * الجسر `toSiteReadiness` الذي كان يطويها في `boolean | null` — والواجهة كانت
   * ثلاثية أصلًا منذ B2، فالتحويل كان خسارة معلومات لا تمثيلًا.
   */
  siteReadiness: SITE_READINESS_ENUM,
});

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

/**
 * 🔴 IN-45/IN-06 (موجة B3): أفعال الأثر التي تحمل **قيم المقاسات** داخل `details`،
 * فتخضع لنفس حجب `measurementsVisible` — وإلا صار سجل الأحداث بابًا خلفيًا يسلّم
 * المكتب الفني الأرقام التي مُنع منها في باب المقاسات.
 *
 * ⚠️ **القائمة مشتقّة من مصدرين معًا، وأيٌّ منهما وحده كان سيُنتج تسريبًا:**
 *   (١) جرد الكود — كتّاب `MEASUREMENT_ADDED`/`MEASUREMENT_DELETED` القائمون.
 *   (٢) **جرد القاعدة** — `MEASUREMENTS_RECORDED` (المسار النصي القديم): **كاتبه
 *       حُذف في SCR-018 فلا يظهر في أي grep**، لكن صفوفه باقية وتحمل
 *       `{"width":…,"height":…}` حرفيًا (مُتحقَّق: 6 صفوف في القاعدة).
 *
 * 🔴 أي فعل جديد يُدرِج مقاسًا في `details` يُضاف هنا — وإلا تسرّب صامتًا.
 */
const MEASUREMENT_BEARING_ACTIONS = [
  "MEASUREMENT_ADDED", // بيان · عرض · ارتفاع · وحدة · كمية
  "MEASUREMENT_DELETED", // البيان
  "MEASUREMENTS_RECORDED", // تاريخي (قبل SCR-018) — عرض/ارتفاع/ملاحظات
];

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

// IN-10 (موجة B3): `assigneeId` هنا فحص **شكل** فقط. أهلية المُسنَد إليه (موجود ·
// نشط · غير محذوف · دوره ضمن `ASSIGNABLE_ROLES`) تحتاج قاعدة البيانات، فحارسها
// النافذ داخل `scheduleInspection` (`assertAssignable`) ويرفع `errors.invalidAssignee`.
// لا تُكرَّر قائمة الأدوار هنا — مصدر واحد في `services/inspections.ts`.
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
    // BL-160: بلا ترجمة — القيمة تمرّ كما هي من الواجهة إلى العمود (نفس الثلاثية)
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
        // SCR-INS-A: اسم مُعلِن المطابقة — نفس نمط `approvedBy`، بلا استعلام ثانٍ
        matchDeclaredBy: { select: { name: true } },
        // SCR-INS-D/H (C2): أسماء مسجّل الانحراف وطالب إعادة القياس — نفس النمط
        deviationBy: { select: { name: true } },
        remeasureRequestedBy: { select: { name: true } },
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
    const [attachments, measurements, activity] = await Promise.all([
      prisma.attachment.findMany({
        where: { parent: "INSPECTION", parentId: id },
        orderBy: { createdAt: "desc" },
      }),
      // لا تُقرأ من القاعدة أصلًا لمن لا يراها — الحجب عند المصدر لا عند العرض
      measurementsVisible ? listMeasurements(id) : Promise.resolve([]),
      /**
       * ── IN-45 (موجة B3): سجل الأحداث — أول **قراءة** لـActivityLog في الموديول ──
       *
       * كان القسم كله كتابةً بلا قارئ (مُتحقَّق: صفر قراءة في مجلد المعاينات)، وهو
       * يكتب اليوم أحد عشر انتقالًا (إنشاء · جدولة · إعادة جدولة · تغيير حالة ·
       * جاهزية موقع · مرفق · مقاس مضاف/محذوف · تقديم · اعتماد · إرجاع) **لا يراها
       * أحد** — «تم الحفظ» ثم صمت.
       *
       * 🔴 **بلا حارس جديد:** تُقرأ هنا داخل `getInspectionDetail` **بعد** أن مرّت
       * كل فحوص النطاق أعلاه، فترث `DETAIL_READ_ROLES` ونطاق كل دور حرفيًا. قراءتها
       * في دالة مستقلة كانت ستستلزم تكرار تلك الفحوص = مصدر تصريح ثانٍ.
       *
       * 🔴 **BL-81 — أثر لا مصدر حقيقة:** يُعرَض ولا يُشتق منه منطق ولا حالة. لا
       * شيء في هذا الملف ولا في الواجهة يقرأ `activity` ليقرّر شيئًا.
       *
       * 🔴 **قرار IN-25 صريح — السجلات المكتوبة على `entity = "QuotationRequest"`
       * (اشتقاق الحالة) مُستثناة عمدًا.** السبب حدّ الكيان لا الكسل: تلك أحداث
       * **الطلب** ولها شاشته، وضمّها هنا كان (١) ينسب حدث الطلب للمعاينة، و(٢)
       * يفتح سؤال نطاق ثانيًا — مَن يرى المعاينة لا يرى الطلب بالضرورة والعكس —
       * وهو توسيع تصريح يمنعه نصّ البند. يُعاد النظر إن طُلب سجل موحّد عابر للكيانات.
       */
      prisma.activityLog.findMany({
        where: {
          entity: "InspectionRequest",
          entityId: id,
          /**
           * 🔴 **حجب IN-06 يسري على الأثر أيضًا** (رُصد أثناء بناء IN-45 نفسه).
           *
           * `MEASUREMENT_ADDED` يكتب في `details` **المقاس كاملًا** (بيان · عرض ·
           * ارتفاع · وحدة · كمية — `inspection-measurements.ts`)، و`MEASUREMENT_DELETED`
           * يكتب البيان. فسجل أحداث بلا ترشيح كان **يسلّم المكتب الفني نفس الأرقام
           * التي حجبها `measurementsVisible` أعلاه** — باب خلفي لقاعدة قائمة، ومن
           * نفس فئة عيب IN-49/IN-06 الذي أُغلق بالضبط (يُقرأ من باب ما مُنع منه
           * في الباب الآخر).
           *
           * الحجب **عند المصدر لا عند العرض**، تطابقًا مع سطر المقاسات أعلاه: لا
           * تُقرأ من القاعدة أصلًا لمن لا يراها. والشاشة تشرح السبب في جدول المقاسات
           * («لم تُعتمد بعد») فلا يقرأ المستخدم النقص كعطل.
           */
          ...(measurementsVisible
            ? {}
            : { action: { notIn: MEASUREMENT_BEARING_ACTIONS } }),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
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
      /**
       * IN-17 (موجة B3): الحالة المعروضة بعد اشتقاق التأخير — **عرض فقط**.
       * `status` الخام يبقى مُعادًا كما هو لأن قائمة تغيير الحالة تكتبه، و`OVERDUE`
       * قيمة غير قابلة للكتابة (IN-07). كانت هذه الشاشة تعرض الخام وحده بينما
       * القائمة تشتقّ ⇒ نفس المعاينة «متأخرة» هناك و«مجدولة» هنا.
       */
      effectiveStatus: deriveEffectiveStatus(inspection.dueDate, inspection.status),
      type: inspection.type,
      siteReadiness: inspection.siteReadiness ?? null,
      scheduledAt: inspection.scheduledAt ? inspection.scheduledAt.toISOString() : null,
      // SCR-INS-B2: `null` = لم تُجدوَل فلا مهلة. الاستدعاء المباشر كان سيرمي.
      dueDate: inspection.dueDate ? inspection.dueDate.toISOString() : null,
      // SCR-INS-B (IN-33): الطوابع التشغيلية الثلاثة — عرض فقط، `null` = لم يقع بعد
      assignedAt: inspection.assignedAt ? inspection.assignedAt.toISOString() : null,
      submittedAt: inspection.submittedAt ? inspection.submittedAt.toISOString() : null,
      completedAt: inspection.completedAt ? inspection.completedAt.toISOString() : null,
      /**
       * SCR-INS-A (IN-03 · D-IN-8): حكم المطابقة. `null` = **لم يُعلَن بعد** — وهي
       * حالة مختلفة تمامًا عن «مطابق»، والواجهة تفرّق بينهما بنصّها.
       */
      matchResult: inspection.matchResult,
      matchReason: inspection.matchReason,
      matchDeclaredByName: inspection.matchDeclaredBy?.name ?? null,
      matchDeclaredAt: inspection.matchDeclaredAt
        ? inspection.matchDeclaredAt.toISOString()
        : null,
      // SCR-INS-D (C2): الانحراف — `null` في الكل = مسار مستقيم لم ينحرف
      deviationReason: inspection.deviationReason,
      deviationNote: inspection.deviationNote,
      deviationRequestedBy: inspection.deviationRequestedBy,
      deviationAt: inspection.deviationAt ? inspection.deviationAt.toISOString() : null,
      deviationByName: inspection.deviationBy?.name ?? null,
      // SCR-INS-E: التصنيف بجوار النصّ القائم `returnReason`
      returnReasonCode: inspection.returnReasonCode,
      // SCR-INS-H: أثر إعادة القياس — يبقى ظاهرًا بعد إعادة الفتح فيُعرف السبب
      remeasureRequestedAt: inspection.remeasureRequestedAt
        ? inspection.remeasureRequestedAt.toISOString()
        : null,
      remeasureReason: inspection.remeasureReason,
      remeasureRequestedByName: inspection.remeasureRequestedBy?.name ?? null,
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
      // IN-45: الأثر الزمني — أحدث أولًا. `details` يُسلَّم **خامًا** كما كُتب
      // (JSON أحيانًا ونصًّا عربيًا حرًّا أحيانًا) والواجهة تعرضه بلا افتراض شكل.
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        details: a.details,
        actorName: a.user.name,
        createdAt: a.createdAt.toISOString(),
      })),
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
//
// IN-40 (موجة B3): القائمة انتقلت إلى `lib/storage/paths.ts` بلا تغيير قيمة واحدة —
// لأن **خريطة التقديم تُشتق منها**. بقاؤها محليةً هنا هو ما جعل البابين ينحرفان
// (الرفع يقبل webp/gif والتقديم يجهلهما). الاسم المحلي يبقى كما هو لتقليل الضجيج.
const IMAGE_EXT = UPLOAD_IMAGE_EXT;

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

    /**
     * SCR-INS-B (IN-33) — **الكاتب الثاني لـ`completedAt`.**
     *
     * ⚠️ لا يظهر في أي grep على `"DONE"`: الحالة تصل **متغيّرًا** لا حرفًا.
     *
     * 🔴 القاعدة (قرار يوسف، موجة C1): **`completedAt` مليان ⟺ الحالة `DONE`** —
     * ثنائية واحدة قابلة للفحص بسطر SQL. فالتراجع عن `DONE` **يفرّغها**، وإلا بقيت
     * معاينة «غير منتهية» تحمل زمن إنهاء فتُلوَّث K2/K3 بصمت.
     * تُكتب في **نفس الـupdate** الذي يكتب الحالة — لا تسلسل يدوي يُنسى.
     */
    await prisma.inspectionRequest.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        completedAt: parsed.data.status === "DONE" ? new Date() : null,
      },
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
  // BL-160: enum ثلاثي. `null` مقبولة عمدًا = **إعادة الحقل إلى «لم يُسأل»** — وهي
  // حالة مشروعة (تراجع عن إدخال خاطئ) ومغايرة لـ`UNCONFIRMED` (سُئل ولم يؤكّد).
  siteReadiness: SITE_READINESS_ENUM.nullable(),
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

    // BL-160: أربع حالات لا ثلاث — `UNCONFIRMED` (سُئل ولم يؤكّد) مفصولة عن `null`
    // (لم يُسأل). دمجهما في نصّ واحد كان يُفقد الأثرَ التمييزَ الذي أُنشئ البند لأجله.
    const details =
      siteReadiness === "READY"
        ? "الموقع جاهز"
        : siteReadiness === "NOT_READY"
          ? "الموقع غير جاهز"
          : siteReadiness === "UNCONFIRMED"
            ? "العميل لم يؤكّد جاهزية الموقع"
            : "أُعيد الحقل إلى «لم يُسأل»";

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
      data: {
        approvalStatus: "PENDING_APPROVAL",
        /**
         * SCR-INS-B (IN-33): لحظة التقديم — يفتح «زمن التنفيذ الميداني».
         * 🔴 **يُدهس عند كل إعادة تقديم** بعد `RETURNED` — نفس دلالة
         * `Quotation.submittedAt` حرفيًا (`lib/actions/lead-approval.ts:110`:
         * «الدورة الجديدة تُقاس من تقديمها هي لا من الأول»). السابقة لا الاجتهاد.
         */
        submittedAt: new Date(),
      },
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
        /**
         * SCR-INS-B (IN-33) — **الكاتب الأول والأغلب لـ`completedAt`.**
         * هذا المسار يكتب `DONE` منذ IN-50، وهو طريق أغلب المعاينات المنتهية
         * (4 من 7 صفوف `DONE` معتمدة وقت الموجة). إغفاله كان سيُفرغ العمود
         * للأغلبية بينما يبدو ممتلئًا للأقلية — أسوأ من فراغه كله.
         * القاعدة محفوظة: `completedAt` مليان ⟺ `DONE`.
         */
        completedAt: new Date(),
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

/**
 * SCR-INS-E (IN-23 · D-IN-17): أسباب الإرجاع مقنَّنة. القيم معتمدة من يوسف.
 * 🔴 **الكود يُضاف بجوار النصّ لا بدلًا منه:** `returnReason` النصّي يبقى إلزاميًا
 * (مُتحقَّق ميدانيًا: «مع كتابة السبب إجباري») لأن التصنيف يُقاس والنصّ يشرح —
 * وحذفه كان سيُفقد تفاصيل الحالة. نفس علّة SF-18 في المبيعات وبنفس علاجها.
 */
const RETURN_REASON_CODES = [
  "MEASUREMENTS_INCOMPLETE",
  "MEASUREMENTS_UNCLEAR",
  "PHOTOS_MISSING",
  "WRONG_LOCATION",
  "OTHER",
] as const;

const returnInspectionSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().trim().min(1, "errors.returnReasonRequired"),
  // اختياري عمدًا: صفوف الواجهة القديمة (ونداءات قائمة) تبقى تعمل، والكود يُملأ
  // حين تُرسله الشاشة. إلزامه كان سيكسر مسارًا قائمًا بلا مكسب.
  reasonCode: z.enum(RETURN_REASON_CODES).optional(),
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
        // SCR-INS-E: التصنيف بجوار النصّ. `undefined` ⇒ Prisma لا تلمس العمود،
        // فالنداءات القديمة تبقى تعمل ولا تُصفّر كودًا سابقًا.
        returnReasonCode: parsed.data.reasonCode,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_RETURNED",
        entity: "InspectionRequest",
        entityId: parsed.data.id,
        details: `أرجع المدير المعاينة للتصحيح — التصنيف: ${
          parsed.data.reasonCode ?? "—"
        } — السبب: ${parsed.data.reason}`,
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

// ══ SCR-INS-A / IN-03 · D-IN-8 · D-IN-9: إعلان نتيجة المطابقة ═════════════════
//
// 🔴 **حقيقة تصميمية مُلزِمة لأي قارئ لاحق: النظام لا يقارن — النظام يسجّل حكم إنسان.**
// لا يوجد في القاعدة «مقاس مفترض» تُقارَن به مقاسات المعاينة (المبيعات لا تُدخل أبعادًا
// وقت الطلب — `summary` نصّ حر). المقارنة تحدث في رأس مدير المعاينات، وهذا الإجراء
// يوثّق نتيجتها. **أي منطق مقارنة آلي هنا = اختراع بلا مرجع (STD-05).**
//
// ⚠️ التوجيه الشرطي على النتيجة (اختلاف ← إعادة تسعير · تطابق ← تعاقد) **غير مبني
// عمدًا** — يمسّ ثلاثة أقسام ويحتاج قرارًا عن آلية إعادة التسعير. مسجَّل في BL-166.
// اليوم: الحكم يُسجَّل ويُعرض، والمكتب الفني يقرأه ويتصرف يدويًا.

const MATCH_RESULTS = [
  "MATCHED",
  "ACCEPTABLE_DEVIATION",
  "REQUIRES_REPRICING",
] as const;

/**
 * القيمتان اللتان **يلزمهما سبب** (D-IN-8): الاختلاف — مقبولًا كان أو موجبًا لإعادة
 * التسعير — حكم يترتب عليه عمل، فلا يُسجَّل بلا تعليل. `MATCHED` لا يلزمها.
 * مشتقّة من نفس المصفوفة أعلاه لا مكتوبة يدويًا — مصدر واحد.
 */
const MATCH_REASON_REQUIRED: readonly string[] = MATCH_RESULTS.filter(
  (v) => v !== "MATCHED"
);

const declareMatchSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  matchResult: z.enum(MATCH_RESULTS),
  reason: z.string().trim().optional(),
});

export async function declareMatchResult(input: unknown) {
  try {
    // D-IN-1/D-IN-8: المدير هو صاحب الحكم (هو من يعتمد المعاينة أصلًا)
    const auth = await requireRole(MANAGER_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = declareMatchSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, matchResult } = parsed.data;
    const reason = parsed.data.reason?.trim() || null;

    // السبب إلزامي في **طبقة التطبيق** لا في القاعدة (D-IN-8) — العمود يبقى nullable
    // لأن `MATCHED` لا تلزمها، وقيد قاعدة بيانات مشروط بقيمة عمود آخر لا يُعبَّر عنه
    // في Prisma بلا حيلة. الحارس النافذ هنا.
    if (MATCH_REASON_REQUIRED.includes(matchResult) && !reason)
      return { error: "errors.matchReasonRequired" as const };

    const inspection = await prisma.inspectionRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        approvalStatus: true,
        matchResult: true,
        matchReason: true,
        customer: { select: { name: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // 🔴 D-IN-9: الإعلان **بعد الاعتماد حصرًا.** قبل الاعتماد المقاسات غير نهائية
    // (D-37) فالحكم عليها حكم على مسودّة — ولا معنى لتوثيقه.
    if (inspection.approvalStatus !== "APPROVED")
      return { error: "errors.matchRequiresApproval" as const };

    /**
     * 🔴 التصحيح **مسموح** (قرار يوسف، موجة C1) — لا «مرة واحدة».
     * السبب: الإعلان **حكم بشري والبشر يخطئون**، وقفله كان سيُنتج **صفًّا محبوسًا**
     * بإعلان خاطئ لا مخرج منه — سابقتا IN-07 و IN-48 حرفيًا.
     * الضابط ليس المنع بل **الأثر**: نفس الأدوار تصحّح، والانتقال يُسجَّل من←إلى.
     * ⚠️ قيد مستقبلي مسجَّل: عند بناء التوجيه الآلي (BL-166) يُعاد النظر في التصحيح
     * بعد أن يكون المكتب الفني قد تصرّف على النتيجة.
     */
    const isCorrection = inspection.matchResult !== null;

    await prisma.inspectionRequest.update({
      where: { id },
      data: {
        matchResult,
        matchReason: reason,
        matchDeclaredById: auth.userId,
        matchDeclaredAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: isCorrection ? "MATCH_RESULT_CORRECTED" : "MATCH_RESULT_DECLARED",
        entity: "InspectionRequest",
        entityId: id,
        // التصحيح يحمل الانتقال من←إلى (لا القيمة الجديدة وحدها — درس IN-28)،
        // والإعلان الأول يحمل القيمة والسبب.
        details: JSON.stringify({
          matchResult: isCorrection
            ? { from: inspection.matchResult, to: matchResult }
            : { to: matchResult },
          reason: { from: isCorrection ? inspection.matchReason : undefined, to: reason },
          customer: inspection.customer.name,
        }),
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[declareMatchResult]", error);
    return { error: "errors.serverError" as const };
  }
}

// ══ SCR-INS-D (موجة C2): تسجيل انحراف المعاينة ════════════════════════════════
//
// 🔴 **الحقيقة 1 من نصّ حسن:** التأجيل والرفض والإلغاء **مصدرها العميل** لا القسم.
// ولذلك `deviationRequestedBy` ليس حقلًا تجميليًا: بدونه تُحمَّل مؤشرات أداء القسم
// قراراتِ عملاء لا يملكها، فيُقاس شيء غير الأداء.

const DEVIATION_REASONS = [
  "CUSTOMER_POSTPONED",
  "CUSTOMER_REJECTED",
  "CUSTOMER_CANCELLED",
  "UNSUITABLE_TIME",
  "NO_STAFF_AVAILABLE",
  "REMEASURE_REQUIRED",
  "OTHER",
] as const;

type DeviationReason = (typeof DEVIATION_REASONS)[number];

/**
 * الأسباب التي **مصدرها العميل بالتعريف** — يُفرض عليها `CUSTOMER` خادميًا ولا
 * تُترك لاختيار المستخدم (القاعدة 2). مشتقّة من البادئة لا مكتوبة يدويًا: أي سبب
 * `CUSTOMER_*` جديد يرث القاعدة تلقائيًا ولا يحتاج تذكّر تحديث قائمة ثانية.
 */
function isCustomerSourced(reason: DeviationReason): boolean {
  return reason.startsWith("CUSTOMER_");
}

/**
 * الأسباب التي **تُحوّل الحالة إلى `POSTPONED`**. الرفض والإلغاء ليسا تأجيلًا —
 * لكن لا قيمة `CANCELLED`/`REJECTED` في `InspectionStatus`، وإضافتها لم تُطلب في C2.
 * ⇒ **الحالة لا تُلمس لهما**، والسبب المقنَّن يحمل الحقيقة كاملةً. مسجَّل: BL-171.
 */
const POSTPONING_REASONS: readonly string[] = [
  "CUSTOMER_POSTPONED",
  "UNSUITABLE_TIME",
  "NO_STAFF_AVAILABLE",
];

const deviationSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.enum(DEVIATION_REASONS),
  note: z.string().trim().optional(),
  qualityFollowUp: z.boolean().optional(),
});

export async function recordDeviation(input: unknown) {
  try {
    const auth = await requireRole(MANAGER_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = deviationSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, reason } = parsed.data;
    const note = parsed.data.note?.trim() || null;

    // القاعدة 1: `OTHER` بلا ملاحظة = تصنيف بلا معنى (علّة IN-23 حرفيًا)
    if (reason === "OTHER" && !note)
      return { error: "errors.deviationNoteRequired" as const };

    const inspection = await prisma.inspectionRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        approvalStatus: true,
        customerId: true,
        // D-IN-22: لازم لاستعادة الحالة الأصلية عند رفع التأجيل
        scheduledAt: true,
        customer: { select: { name: true, ownerId: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // معاينة معتمدة انتهت دورتها — الانحراف عليها يعني إبطال اعتماد ذهب للمكتب
    // الفني (نفس منطق IN-13). المخرج المشروع بعد الاعتماد هو `requestRemeasure`.
    if (inspection.approvalStatus === "APPROVED")
      return { error: "errors.inspectionApprovedNoChange" as const };

    const becomesPostponed = POSTPONING_REASONS.includes(reason);

    /**
     * 🔴 **D-IN-22 (C2-fix-2) — رفع التأجيل عند انحراف لا يستوجبه.**
     *
     * العيب (مُتحقَّق بالبيانات الحيّة، الصفّ `cmrh79ya9…`): كان الشرط
     * `...(becomesPostponed ? { status: "POSTPONED" } : {})` — فالسبب الجديد الذي لا
     * يستوجب تأجيلًا **لا يمسّ الحالة إطلاقًا**. معاينة كانت `POSTPONED` بسبب
     * `NO_STAFF_AVAILABLE` ثم سُجّل عليها `CUSTOMER_CANCELLED` بقيت **«مؤجَّلة»**:
     * حالة تقول «ستُستأنف» وسبب يقول «لن تُستأنف»، وتظهر للمدير قابلةً لإعادة الجدولة.
     * و`ActivityLog` كان يسجّل `statusChangedTo: null` — فالتناقض غير مرئي حتى في الأثر.
     *
     * القرار (الخيار أ): تعود الحالة إلى **أصلها** — `SCHEDULED` إن كان لها موعد
     * مُلتزَم به، وإلا `REQUESTED`. لا تُخترع حالة ولا تُترك على أثر انحراف سابق.
     *
     * 🔴 **النهائيتان لا تُمسّان** (`DONE`/`CANCELLED`): مصدر واحد
     * (`isTerminalInspectionStatus`) لا شرط رابع. ولولا هذا الحارس لأعاد تسجيلُ
     * انحرافٍ على معاينة ملغاة **بعثَها** إلى `REQUESTED` — نفس ثغرة BL-172 من باب آخر.
     */
    let nextStatus: "POSTPONED" | "SCHEDULED" | "REQUESTED" | null = null;
    if (isTerminalInspectionStatus(inspection.status)) {
      /**
       * 🔴 **قيد 1 — النهائيتان لا تُمسّان، وهذا يسدّ ثقبًا قائمًا لا يمنع جديدًا:**
       * الشرط القديم `becomesPostponed ? { status: "POSTPONED" }` كان **بلا أي فحص
       * للحالة الحالية**، فتسجيل `CUSTOMER_POSTPONED` على معاينة `CANCELLED` كان
       * **يبعثها** إلى «مؤجَّلة» — نفس فئة BL-172 من باب آخر.
       * السبب يُسجَّل (توثيق مشروع)، والحالة النهائية تبقى.
       */
      nextStatus = null;
    } else if (becomesPostponed) {
      nextStatus = "POSTPONED";
    } else if (inspection.status === "POSTPONED") {
      // رفع التأجيل: العودة للأصل — الموعد المُلتزَم به إن وُجد، وإلا «مطلوبة»
      nextStatus = inspection.scheduledAt ? "SCHEDULED" : "REQUESTED";
    }
    const statusChanged = nextStatus !== null && nextStatus !== inspection.status;

    await prisma.inspectionRequest.update({
      where: { id },
      data: {
        deviationReason: reason,
        deviationNote: note,
        // القاعدة 2: المصدر مفروض خادميًا لا مُختارًا
        deviationRequestedBy: isCustomerSourced(reason) ? "CUSTOMER" : "INTERNAL",
        deviationAt: new Date(),
        deviationById: auth.userId,
        /**
         * D-IN-3: **يُكتب ولا يُقرأ.** موديول الجودة غير موجود، والحقل جاهز للربط
         * حين يُبنى. 🔴 لا تقرأه ولا تُفرّع عليه اليوم — صفر مستهلك مقصود، وليس
         * عمودًا منسيًّا. `undefined` ⇒ Prisma تتركه `null` = «لم يُقرَّر».
         */
        qualityFollowUp: parsed.data.qualityFollowUp,
        // D-IN-22: تُكتب الحالة عند التأجيل **وعند رفعه** — لا عند الأول وحده
        ...(nextStatus !== null ? { status: nextStatus } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "INSPECTION_DEVIATION_RECORDED",
        entity: "InspectionRequest",
        entityId: id,
        details: JSON.stringify({
          reason,
          source: isCustomerSourced(reason) ? "CUSTOMER" : "INTERNAL",
          note,
          // D-IN-22 (قيد 2): الانتقال **الحقيقي** من←إلى لا `—` دائمًا. الأثر القديم
          // كان يكتب `null` عند رفع التأجيل، فلم يكن التناقض مرئيًا حتى في السجل.
          statusChangedTo: statusChanged ? nextStatus : null,
          statusChangedFrom: statusChanged ? inspection.status : null,
        }),
      },
    });

    /**
     * القاعدة 3: **إشعار المبيعات إلزامي** — الانحراف حدث يخصّ العميل، ومالكه هو
     * من يتصرّف معه. fallback لـ`SALES_MANAGER` عند عميل بلا مالك (نمط B2:
     * `Customer.ownerId` قابل للـnull، وبلا الفرع كان الطلب ينحرف ولا أحد يعلم).
     */
    try {
      const body = `انحراف على معاينة العميل ${inspection.customer.name} — السبب: ${reason}`;
      if (inspection.customer.ownerId) {
        await sendNotification({
          userId: inspection.customer.ownerId,
          title: "notifications.inspectionDeviationTitle",
          body,
          type: "INSPECTION_DEVIATION",
          entityId: id,
          entityType: "InspectionRequest",
        });
      } else {
        await notifyRole("SALES_MANAGER", {
          title: "notifications.inspectionDeviationTitle",
          body: `${body} (عميل بلا مالك مندوب)`,
          type: "INSPECTION_DEVIATION",
          entityId: id,
          entityType: "InspectionRequest",
        });
      }
    } catch {
      // notification failure must not block the operation
    }

    // الحالة تغيّرت ⇒ يُعاد اشتقاق حالة الطلب ومرحلة العميل (درس IN-37: الكتابة
    // بلا إعادة اشتقاق تترك المرحلة معلّقة للأبد). محوَّطة: فشلها لا يُبطل انحرافًا وقع.
    // D-IN-22: الشرط صار `statusChanged` لا `becomesPostponed` — **رفع** التأجيل
    // تغييرُ حالةٍ أيضًا، وإغفاله كان سيترك الاشتقاق على واقع قديم.
    if (statusChanged) {
      try {
        await recomputeAfterInspection(id, inspection.customerId, auth.userId);
      } catch (error) {
        console.error("[recordDeviation/recomputeAfterInspection]", error);
      }
    }

    return { success: true as const };
  } catch (error) {
    console.error("[recordDeviation]", error);
    return { error: "errors.serverError" as const };
  }
}

// ══ SCR-INS-H (موجة C2): مسار إعادة القياس — يفتح IN-04 جزئيًا ═════════════════
//
// **الطريق المسدود:** معاينة `APPROVED` لا تُعدَّل مقاساتها (IN-13) ولا تُربَط بمعاينة
// ثانية (`quotation_requests.inspectionRequestId @unique`, schema:1103). أي اختلاف
// يُكتشف بعدها بلا مخرج. **قاعدة حسن:** إعادة الجدولة لإعادة رفع المقاسات مشروعة.
//
// 🔴 **فتح مُقنَّن لا إلغاء للقفل:** الإجراء يعيد `approvalStatus` إلى
// `PENDING_APPROVAL` فينفتح القفل **تلقائيًا** — حرّاس IN-13 لم تُمَس ولا حرف.
// 🔴 **`@unique` لم يُلمس:** المعاينة تبقى واحدة وإعادة القياس **دورة داخلها**.

const remeasureSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().trim().min(1, "errors.remeasureReasonRequired"),
});

export async function requestRemeasure(input: unknown) {
  try {
    // الحدّ 2: المدير وADMIN فقط. المبيعات تطلب عبر إشعار ولا تنفّذ.
    const auth = await requireRole(MANAGER_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = remeasureSchema.safeParse(input);
    if (!parsed.success)
      return {
        error:
          parsed.error.flatten().fieldErrors.reason?.[0] ??
          ("errors.invalidInput" as const),
      };

    const { id, reason } = parsed.data;

    const inspection = await prisma.inspectionRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        approvalStatus: true,
        assigneeId: true,
        customerId: true,
        matchResult: true,
        matchReason: true,
        customer: { select: { name: true, ownerId: true } },
      },
    });
    if (!inspection) return { error: "errors.notFound" as const };

    // الحدّ 1: لا معنى للطلب على غير المعتمدة — المسار العادي مفتوح لها أصلًا
    if (inspection.approvalStatus !== "APPROVED")
      return { error: "errors.remeasureRequiresApproved" as const };

    /**
     * 🔴 الحدّ 4 (D-IN-18): **إعادة القياس تُمنع بوجود عقد.** بعد التعاقد قد تتغيّر
     * قيمة العقد، وذلك قرار **تجاري لا تشغيلي** — ومتسق مع L-08 (العقد الموقّع سند
     * لا يُعدَّل؛ التغيير = ملحق + عرض جديد).
     *
     * السلسلة: `InspectionRequest` ← `QuotationRequest.inspectionRequestId` ←
     * `.quotationId` ← `Contract.quotationId` (@unique, schema:952).
     * ⚠️ الرفض بمفتاح **صريح** لا برسالة عامة: المستخدم يجب أن يعرف أن المانع هو
     * العقد لا عطل، وإلا كرّر المحاولة ثم صعّد شكوى عن «زر لا يعمل».
     */
    const linkedRequest = await prisma.quotationRequest.findFirst({
      where: { inspectionRequestId: id },
      select: { quotation: { select: { contract: { select: { id: true } } } } },
    });
    if (linkedRequest?.quotation?.contract)
      return { error: "errors.remeasureBlockedByContract" as const };

    // كل الكتابات في معاملة واحدة: فتح القفل ومسح الحكم وإعادة الحالة لا تتجزّأ —
    // نجاح بعضها يترك معاينة بحكم مطابقة على مقاسات أُبطلت.
    await prisma.$transaction(async (tx) => {
      await tx.inspectionRequest.update({
        where: { id },
        data: {
          // (٢) فتح القفل تلقائيًا بلا لمس حرّاس IN-13
          approvalStatus: "PENDING_APPROVAL",
          // (٣) حقول إعادة القياس
          remeasureRequestedAt: new Date(),
          remeasureRequestedById: auth.userId,
          remeasureReason: reason,
          /**
           * (٤) **مسح الحكم وتوابعه.** `matchResult` بُني على مقاسات ستتغيّر —
           * إبقاؤه يعني حكمًا يشير إلى أرقام لم تعد قائمة، وهو أسوأ من غيابه.
           * القيمة القديمة تُسجَّل في ActivityLog أدناه فلا تضيع.
           */
          matchResult: null,
          matchReason: null,
          matchDeclaredById: null,
          matchDeclaredAt: null,
          // (٥) التزامًا بالقاعدة النافذة: `completedAt` مليان ⟺ الحالة `DONE`
          status: "SCHEDULED",
          completedAt: null,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: auth.userId,
          action: "INSPECTION_REMEASURE_REQUESTED",
          entity: "InspectionRequest",
          entityId: id,
          details: JSON.stringify({
            reason,
            // الحكم المُبطَل يُحفَظ بقيمته القديمة — الأثر لا يفقد ما مسحه الإجراء
            clearedMatchResult: inspection.matchResult,
            clearedMatchReason: inspection.matchReason,
            approvalStatus: { from: "APPROVED", to: "PENDING_APPROVAL" },
          }),
        },
      });
    });

    // (٦) الإخطارات — خارج المعاملة (D-39: نظام الإشعارات بالع، ولا يُبطل عملًا وقع)
    try {
      if (inspection.assigneeId) {
        await sendNotification({
          userId: inspection.assigneeId,
          title: "notifications.remeasureRequestedTitle",
          body: `مطلوب إعادة رفع مقاسات معاينة العميل ${inspection.customer.name} — ${reason}`,
          type: "REMEASURE_REQUESTED",
          entityId: id,
          entityType: "InspectionRequest",
        });
      }
      if (inspection.customer.ownerId) {
        await sendNotification({
          userId: inspection.customer.ownerId,
          title: "notifications.remeasureRequestedTitle",
          body: `أُعيد فتح معاينة العميل ${inspection.customer.name} لإعادة رفع المقاسات`,
          type: "REMEASURE_REQUESTED",
          entityId: id,
          entityType: "InspectionRequest",
        });
      }
      /**
       * 🔴 الحدّ 3: **المكتب الفني كان قد أُخطر بمقاسات معتمدة وقد يكون سعّر عليها.**
       * إغفال إخطاره بإبطالها = IN-37 بالعكس: بيانات تغيّرت ولا أحد يعلم.
       * الوجهة **الطلب** لا المعاينة (D-IN-13/IN-47: صفحة المعاينة حارسها لا يشمله
       * فيُحرق الإشعار على redirect صامت).
       */
      const requestForNotice = await prisma.quotationRequest.findFirst({
        where: { inspectionRequestId: id },
        select: { id: true },
      });
      await notifyRole("TECHNICAL_OFFICE", {
        title: "notifications.measurementsInvalidatedTitle",
        body: `أُبطلت مقاسات العميل ${inspection.customer.name} — أُعيدت المعاينة لرفع مقاسات جديدة`,
        type: "MEASUREMENTS_INVALIDATED",
        entityId: requestForNotice?.id ?? id,
        entityType: requestForNotice ? "QuotationRequest" : "InspectionRequest",
      });
    } catch {
      // notification failure must not block the operation
    }

    // الحالة عادت `SCHEDULED` ⇒ المعاينة نشطة من جديد ⇒ يُعاد اشتقاق مرحلة العميل
    try {
      await recomputeAfterInspection(id, inspection.customerId, auth.userId);
    } catch (error) {
      console.error("[requestRemeasure/recomputeAfterInspection]", error);
    }

    return { success: true as const };
  } catch (error) {
    console.error("[requestRemeasure]", error);
    return { error: "errors.serverError" as const };
  }
}
