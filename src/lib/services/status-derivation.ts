import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

/** يشتق مرحلة العميل من أحداثه — نقي. لا يعالج REJECTED (قرار بشري منفصل). */
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

  // معاينة نشطة = مربوطة ولم تُنجَز (status != DONE)
  const inspectionActive =
    !!req.inspectionRequest && req.inspectionRequest.status !== "DONE";

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
): Promise<PipelineStage | "REJECTED" | null> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true, stage: true },
  });
  if (!customer) return null;

  // REJECTED قرار بشري — لا اشتقاق يدهسه.
  if (customer.stage === "REJECTED") return "REJECTED";

  const [contract, activeInspection, quotation, completedInstallation] =
    await Promise.all([
      tx.contract.findFirst({ where: { customerId }, select: { id: true } }),
      tx.inspectionRequest.findFirst({
        where: { customerId, deletedAt: null, status: { not: "DONE" } },
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
