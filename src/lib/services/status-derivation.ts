import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
// SCR-INS-I (C2-fix): المصدر الوحيد للحالات النهائية — لا نسخة محلية من الشرط
import {
  TERMINAL_INSPECTION_STATUSES,
  isTerminalInspectionStatus,
} from "@/lib/services/inspection-status";

/**
 * دفعة هـ · Phase 4 — الحالة المشتقّة (Single Source of Truth للحالة).
 *
 * المبدأ: الحالة **نتيجة أحداث لا زر يدوي**. لا يكتب أحد `Customer.stage` أو
 * `QuotationRequest.status` مباشرةً بعد اليوم — الأحداث (إنشاء طلب / عرض /
 * معاينة / مقاسات / عقد) تستدعي هذه الدوال، وهي وحدها تقرّر القيمة وتكتب
 * ActivityLog بالانتقال. أي منطق حالة جديد يعيش هنا حصرًا.
 *
 * REJECTED استثناء بشري مشروع (العميل رفض) — قرار لا حدث — يبقى يدويًا (ADMIN)
 * وهذه الدوال لا تدهسه.
 */

// ── الدوال النقية (قابلة للاختبار بلا DB) ──────────────────────────────

export type TecJobStatus = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "DONE";

export interface TecStatusFacts {
  hasContract: boolean; // العرض المرتبط له عقد
  inspectionActive: boolean; // معاينة مربوطة لم تُنجَز بعد
  measurementsArrived: boolean; // سُجّلت مقاسات للمعاينة المربوطة
  hasQuotation: boolean; // المكتب الفني أنشأ العرض وربطه
}

/** يشتق حالة طلب التسعير من أحداثه المرتبطة — نقي، بلا side-effects. */
export function deriveTecJobStatus(f: TecStatusFacts): TecJobStatus {
  if (f.hasContract) return "DONE";
  // معاينة قيد التنفيذ بلا مقاسات بعد → معلّق بانتظار المقاسات
  if (f.inspectionActive && !f.measurementsArrived) return "ON_HOLD";
  // وصلت مقاسات أو أُنشئ عرض → العمل جارٍ
  if (f.measurementsArrived || f.hasQuotation) return "IN_PROGRESS";
  return "NEW";
}

export type PipelineStage =
  | "NEW"
  | "PRICED"
  | "INSPECTION"
  | "CONTRACT"
  | "EXECUTION";

export interface StageFacts {
  installationCompleted: boolean; // اكتمل تركيب لعقد العميل (COMPLETED)
  hasContract: boolean;
  inspectionActive: boolean; // معاينة نشطة (لم تُنجَز) للعميل
  hasQuotation: boolean; // للعميل عرض سعر واحد على الأقل
}

/**
 * IN-37 — المراحل التي **لا يستطيع الاشتقاق إنتاجها**، فلا يجوز له دهسها.
 *
 * `enum PipelineStage` في القاعدة ثماني قيم (`prisma/schema.prisma:696-705`)
 * و`deriveCustomerStage` أدناه تُنتج خمسًا فقط. الثلاث الباقية بلا حدث مشتِق
 * وتُضبط بيد `ADMIN` حصرًا — وهذا مُقرَّر في CLAUDE.md صراحةً: «FOLLOW_UP /
 * RE_INSPECTION_FOLLOWUP: بلا حدث مشتِق … تبقيان عبر ADMIN override حتى تعريف
 * الحدث». فحماية `REJECTED` وحدها كانت **ناقصة لا مكتملة**.
 *
 * 🔴 لماذا الآن: البند IN-37 يضيف ثلاث نقاط استدعاء جديدة للاشتقاق، وبلا هذه
 * الحماية كان أول حدث معاينة على عميل في `FOLLOW_UP` سيمحو قرارًا بشريًا بصمت.
 * مُتحقَّق على القاعدة الحالية: عميل واحد في `FOLLOW_UP` كان سيصير `INSPECTION`.
 * (توسيع مقصود خارج نصّ البند — كتلة واحدة، تُحذف بلا أثر على باقي الملحق.)
 */
const HUMAN_OWNED_STAGES = [
  "REJECTED",
  "FOLLOW_UP",
  "RE_INSPECTION_FOLLOWUP",
] as const;

export type HumanOwnedStage = (typeof HUMAN_OWNED_STAGES)[number];

function isHumanOwnedStage(stage: string): stage is HumanOwnedStage {
  return (HUMAN_OWNED_STAGES as readonly string[]).includes(stage);
}

/** يشتق مرحلة العميل من أحداثه — نقي. لا يعالج المراحل البشرية (انظر أعلاه). */
export function deriveCustomerStage(f: StageFacts): PipelineStage {
  // إتمام التركيب أقوى من مجرد وجود العقد — العميل في التنفيذ/ما بعده
  if (f.installationCompleted) return "EXECUTION";
  if (f.hasContract) return "CONTRACT";
  if (f.inspectionActive) return "INSPECTION";
  if (f.hasQuotation) return "PRICED";
  return "NEW";
}

// ── دوال القراءة+الاشتقاق+الحفظ (تعيد قراءة الحقائق من DB ثم تثبّت) ──────

/**
 * تعيد حساب حالة طلب تسعير من أحداثه وتحفظها إن تغيّرت.
 * تُستدعى بعد كل حدث يمسّ الطلب (عرض/معاينة/مقاسات/عقد).
 */
export async function recomputeQuotationRequestStatus(
  requestId: string,
  actorId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<TecJobStatus | null> {
  const req = await tx.quotationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      quotationId: true,
      inspectionRequestId: true,
      inspectionRequest: { select: { id: true, status: true } },
    },
  });
  if (!req) return null;

  // هل للعرض المرتبط عقد؟
  const hasContract = req.quotationId
    ? (await tx.contract.findUnique({
        where: { quotationId: req.quotationId },
        select: { id: true },
      })) !== null
    : false;

  /**
   * معاينة نشطة = مربوطة ولم تخرج من دورة العمل.
   *
   * 🔴 SCR-INS-I (C2-fix): الشرط كان `!== "DONE"` وحده ⇒ معاينة ألغاها العميل تبقى
   * «نشطة» فيبقى الطلب `ON_HOLD` **للأبد** — وهو جوهر العيب الذي تغلقه هذه الموجة.
   * `POSTPONED` تبقى نشطة عمدًا: التأجيل توقّف يُستأنف لا خروج من الصفقة.
   */
  const inspectionActive =
    !!req.inspectionRequest &&
    !isTerminalInspectionStatus(req.inspectionRequest.status);

  // وصلت مقاسات؟ 1ب (BL-81): المصدر الوحيد = صفوف `InspectionMeasurement`.
  // (المسار النصي القديم ActivityLog/MEASUREMENTS_RECORDED حُذف — لم يعد مصدر حقيقة.)
  const measurementsArrived = req.inspectionRequestId
    ? (await tx.inspectionMeasurement.findFirst({
        where: { inspectionRequestId: req.inspectionRequestId },
        select: { id: true },
      })) !== null
    : false;

  const next = deriveTecJobStatus({
    hasContract,
    inspectionActive,
    measurementsArrived,
    hasQuotation: !!req.quotationId,
  });

  if (next !== req.status) {
    await tx.quotationRequest.update({
      where: { id: req.id },
      data: { status: next },
    });
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "TEC_STATUS_DERIVED",
        entity: "QuotationRequest",
        entityId: req.id,
        details: JSON.stringify({ from: req.status, to: next, derived: true }),
      },
    });
  }
  return next;
}

/**
 * تعيد حساب مرحلة العميل من أحداثه وتحفظها إن تغيّرت.
 * REJECTED (قرار بشري) لا يُدهس أبدًا.
 */
export async function recomputeCustomerStage(
  customerId: string,
  actorId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PipelineStage | HumanOwnedStage | null> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true, stage: true },
  });
  if (!customer) return null;

  // قرار بشري — لا اشتقاق يدهسه.
  if (isHumanOwnedStage(customer.stage)) return customer.stage;

  const [contract, activeInspection, quotation, completedInstallation] =
    await Promise.all([
      tx.contract.findFirst({ where: { customerId }, select: { id: true } }),
      tx.inspectionRequest.findFirst({
        // SCR-INS-I (C2-fix): نفس قاعدة النشاط أعلاه — بدونها يبقى العميل المرفوض
        // في مرحلة «معاينة» بعد إغلاق معايناته تتاليًا.
        where: {
          customerId,
          deletedAt: null,
          status: { notIn: [...TERMINAL_INSPECTION_STATUSES] },
        },
        select: { id: true },
      }),
      tx.quotation.findFirst({ where: { customerId }, select: { id: true } }),
      // مسار الملكية: InstallationOrder → ManufacturingOrder → Quotation.customerId
      tx.installationOrder.findFirst({
        where: {
          status: "COMPLETED",
          manufacturingOrder: { quotation: { customerId } },
        },
        select: { id: true },
      }),
    ]);

  const next = deriveCustomerStage({
    installationCompleted: !!completedInstallation,
    hasContract: !!contract,
    inspectionActive: !!activeInspection,
    hasQuotation: !!quotation,
  });

  if (next !== customer.stage) {
    await tx.customer.update({
      where: { id: customerId },
      data: { stage: next },
    });
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "STAGE_DERIVED",
        entity: "Customer",
        entityId: customerId,
        details: JSON.stringify({ from: customer.stage, to: next, derived: true }),
      },
    });
  }
  return next;
}

/**
 * IN-37 — أي حدث يمسّ المعاينة يحرّك **البُعدين معًا**: حالة الطلب ومرحلة العميل.
 *
 * 🔴 الجذر الذي يعالجه هذا الملحق: منطق الاشتقاق كان سليمًا تمامًا
 * (`deriveCustomerStage` يعيد `INSPECTION` وهي معاينة نشطة، ويسقطها بمجرد أن تصير
 * `status = DONE`) — لكن **لا أحد كان يستدعيه لحظة انتهاء المعاينة**. فكانت
 * `Customer.stage` تُكتب `INSPECTION` عند الإنشاء وتبقى هناك للأبد، لأن
 * `inspectionActive` يسبق `hasQuotation`/`hasContract` في ترتيب الأولوية
 * (سطور 54-58) فيحجبهما ما دام لم يُعَد الاشتقاق.
 *
 * ولماذا دالة واحدة لا استدعاءان في كل موضع: كان في المستودع نسخة خاصة من نصف
 * هذه القاعدة (`recomputeLinkedRequest` في `inspection-measurements.ts`) تُحرّك
 * الطلب وحده وتنسى العميل. نسختان من قاعدة واحدة = انحراف مؤجَّل (نفس علّة IN-12).
 * هذه هي القاعدة الوحيدة، وموضعها هنا التزامًا بتعليق أعلى الملف: **أي منطق حالة
 * جديد يعيش هنا حصرًا**.
 *
 * `customerId` يُمرَّر ولا يُقرأ من المعاينة: المنادي قرأ الصف بالفعل، فقراءة ثانية
 * داخل معاملة تُطيل القفل بلا فائدة.
 */
export async function recomputeAfterInspection(
  inspectionRequestId: string,
  customerId: string,
  actorId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const linkedRequest = await tx.quotationRequest.findFirst({
    where: { inspectionRequestId },
    select: { id: true },
  });
  if (linkedRequest) {
    await recomputeQuotationRequestStatus(linkedRequest.id, actorId, tx);
  }
  await recomputeCustomerStage(customerId, actorId, tx);
}
