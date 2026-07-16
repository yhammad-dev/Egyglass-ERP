import {
  Prisma,
  type MeasurementUnit,
  type InspectionApprovalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import { recomputeQuotationRequestStatus } from "@/lib/services/status-derivation";

// 1ب (BL-81 / SCR-018): المقاسات صفوف مهيكلة في `InspectionMeasurement`.
// المسار النصي القديم (ActivityLog MEASUREMENTS_RECORDED) حُذف — الجدول هو المصدر الوحيد.
// ActivityLog يبقى **أثرًا** (MEASUREMENT_ADDED / MEASUREMENT_DELETED) لا مصدر حقيقة.

/** مفاتيح الخطأ التي ترميها هذه الخدمة — اتحاد صريح، لا `string` يُسكِت المترجم */
export type MeasurementErrorKey = "errors.notFound";

export class MeasurementError extends Error {
  readonly key: MeasurementErrorKey;
  constructor(key: MeasurementErrorKey) {
    super(key);
    this.key = key;
    this.name = "MeasurementError";
  }
}

export interface MeasurementRow {
  id: string;
  description: string;
  width: string;
  height: string;
  unit: MeasurementUnit;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

export interface AddMeasurementInput {
  inspectionRequestId: string;
  description: string;
  width: number;
  height: number;
  unit: MeasurementUnit;
  quantity: number;
  notes?: string;
}

function toRow(m: {
  id: string;
  description: string;
  width: Prisma.Decimal;
  height: Prisma.Decimal;
  unit: MeasurementUnit;
  quantity: number;
  notes: string | null;
  createdAt: Date;
}): MeasurementRow {
  return {
    id: m.id,
    description: m.description,
    width: m.width.toString(),
    height: m.height.toString(),
    unit: m.unit,
    quantity: m.quantity,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function listMeasurements(
  inspectionRequestId: string
): Promise<MeasurementRow[]> {
  const rows = await prisma.inspectionMeasurement.findMany({
    where: { inspectionRequestId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRow);
}

export async function addMeasurement(
  input: AddMeasurementInput,
  actorId: string
): Promise<MeasurementRow> {
  const inspection = await prisma.inspectionRequest.findUnique({
    where: { id: input.inspectionRequestId },
    include: { customer: { select: { name: true, ownerId: true } } },
  });
  if (!inspection) throw new MeasurementError("errors.notFound");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.inspectionMeasurement.create({
      data: {
        inspectionRequestId: input.inspectionRequestId,
        description: input.description,
        width: new Prisma.Decimal(String(input.width)),
        height: new Prisma.Decimal(String(input.height)),
        unit: input.unit,
        quantity: input.quantity,
        notes: input.notes || null,
        createdById: actorId,
      },
    });

    // أثر لا مصدر حقيقة (الحقيقة في الجدول)
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "MEASUREMENT_ADDED",
        entity: "InspectionRequest",
        entityId: input.inspectionRequestId,
        details: JSON.stringify({
          measurementId: row.id,
          description: row.description,
          width: row.width.toString(),
          height: row.height.toString(),
          unit: row.unit,
          quantity: row.quantity,
        }),
      },
    });

    // الأثر الجانبي 3 (الأخطر): اشتقاق حالة الطلب المربوط (ON_HOLD → IN_PROGRESS).
    // 🔴 داخل نفس المعاملة (الدالة تقبل tx) — المقاس والحالة يثبتان معًا أو لا يثبتان.
    await recomputeLinkedRequest(input.inspectionRequestId, actorId, tx);

    return row;
  });

  // D-40/D-37 (BL-109): المكتب الفني **لا يُخطَر عند الحفظ** — يُخطَر حصريًا بعد اعتماد
  // المدير (approveInspection). الحفظ: إشعار المبيعات "للعلم" + تحريك تتبّع الطلب أعلاه.
  // محوَّطة: فشل إشعار لا يمنع صحة حالة الطلب (D-39، نمط services/inspections.ts).
  // الأثر الجانبي (W-02 / SAL-R10): المبيعات تُخطَر دائمًا — مالك العميل، وإلا مدير المبيعات
  try {
    if (inspection.customer.ownerId) {
      await sendNotification({
        userId: inspection.customer.ownerId,
        title: "notifications.measurementsRecordedTitle",
        body: `سُجّلت مقاسات معاينة عميلك ${inspection.customer.name}`,
        type: "MEASUREMENTS_RECORDED_SALES",
        entityId: inspection.id,
        entityType: "InspectionRequest",
      });
    } else {
      await notifyRole("SALES_MANAGER", {
        title: "notifications.measurementsRecordedTitle",
        body: `سُجّلت مقاسات معاينة العميل ${inspection.customer.name} (بلا مالك مندوب)`,
        type: "MEASUREMENTS_RECORDED_SALES",
        entityId: inspection.id,
        entityType: "InspectionRequest",
      });
    }
  } catch {
    // notification failure must not block the operation
  }

  return toRow(created);
}

export async function deleteMeasurement(
  measurementId: string,
  actorId: string
): Promise<void> {
  const row = await prisma.inspectionMeasurement.findUnique({
    where: { id: measurementId },
    select: { id: true, inspectionRequestId: true, description: true },
  });
  if (!row) throw new MeasurementError("errors.notFound");

  // D-38 (يوسف، 2026-07-14): الحذف قبل الاعتماد = تصحيح مشروع — **بلا إشعار**.
  // الإشعار عند التسجيل فقط. (قفل المقاسات بعد APPROVED = المرحلة 2 — BL-110.)
  await prisma.$transaction(async (tx) => {
    await tx.inspectionMeasurement.delete({ where: { id: row.id } });
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "MEASUREMENT_DELETED",
        entity: "InspectionRequest",
        entityId: row.inspectionRequestId,
        details: JSON.stringify({
          measurementId: row.id,
          description: row.description,
        }),
      },
    });

    // الحذف يغيّر واقعة "وصلت مقاسات؟" → نفس الاشتقاق داخل المعاملة (لا حالة كاذبة)
    await recomputeLinkedRequest(row.inspectionRequestId, actorId, tx);
  });
}

/** الطلب المربوط بهذه المعاينة — إن وُجد — تُعاد اشتقاق حالته داخل نفس المعاملة */
async function recomputeLinkedRequest(
  inspectionRequestId: string,
  actorId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const linkedRequest = await tx.quotationRequest.findFirst({
    where: { inspectionRequestId },
    select: { id: true },
  });
  if (linkedRequest) {
    await recomputeQuotationRequestStatus(linkedRequest.id, actorId, tx);
  }
}

/** مالك المعاينة — لحارس BL-105 على الكتابة (REP يكتب على معايناته فقط) */
export async function getMeasurementAssignee(
  measurementId: string
): Promise<{
  inspectionRequestId: string;
  assigneeId: string | null;
  approvalStatus: InspectionApprovalStatus;
} | null> {
  const row = await prisma.inspectionMeasurement.findUnique({
    where: { id: measurementId },
    select: {
      inspectionRequestId: true,
      inspectionRequest: { select: { assigneeId: true, approvalStatus: true } },
    },
  });
  if (!row) return null;
  return {
    inspectionRequestId: row.inspectionRequestId,
    assigneeId: row.inspectionRequest.assigneeId,
    approvalStatus: row.inspectionRequest.approvalStatus,
  };
}
