import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";

// دفعة أ — بوابة المراجعة قبل التصنيع (PRC-R02/R03/R04):
// PENDING → UNDER_REVIEW → (موافقة INSPECTION_MANAGER + مصنع + expectedAt) → IN_PRODUCTION
//                        → (رفض بسبب إلزامي) → REJECTED → إشعار TEC → إعادة → UNDER_REVIEW
export class MfgReviewError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "MfgReviewError";
  }
}

export async function submitForReview(orderId: string, actorId: string) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "PENDING" && order.status !== "REJECTED")
    throw new MfgReviewError("errors.illegalStatusTransition");

  const updated = await prisma.manufacturingOrder.update({
    where: { id: orderId },
    data: { status: "UNDER_REVIEW", rejectionReason: null },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_SUBMITTED_FOR_REVIEW",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: `أمر التصنيع دخل بوابة المراجعة (من ${order.status})`,
    },
  });

  return updated;
}

/** الموافقة (مدير المعاينات) = إفراج للتصنيع + اختيار مصنع نشط + تاريخ متوقع */
export async function approveOrder(
  orderId: string,
  factoryId: string,
  expectedAt: Date,
  actorId: string
) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "UNDER_REVIEW")
    throw new MfgReviewError("errors.illegalStatusTransition");

  const factory = await prisma.factory.findUnique({ where: { id: factoryId } });
  if (!factory || !factory.isActive) throw new MfgReviewError("errors.factoryInactive");

  const updated = await prisma.manufacturingOrder.update({
    where: { id: orderId },
    data: {
      status: "IN_PRODUCTION",
      factoryId,
      expectedAt,
      rejectionReason: null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_REVIEW_APPROVED",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: `اعتُمد أمر التصنيع وأُرسل لمصنع ${factory.code} — تسليم متوقع ${expectedAt.toISOString().slice(0, 10)}`,
    },
  });

  return updated;
}

/** الرفض — السبب إلزامي + إشعار المكتب الفني (نمط MFG_READY) */
export async function rejectOrder(orderId: string, reason: string, actorId: string) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "UNDER_REVIEW")
    throw new MfgReviewError("errors.illegalStatusTransition");

  const updated = await prisma.manufacturingOrder.update({
    where: { id: orderId },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_REVIEW_REJECTED",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: `رُفض أمر التصنيع في بوابة المراجعة — السبب: ${reason}`,
    },
  });

  await notifyRole("TECHNICAL_OFFICE", {
    title: "notifications.mfgRejectedTitle",
    body: `أمر تصنيع مردود من المراجعة — السبب: ${reason}`,
    type: "MFG_REVIEW_REJECTED",
    entityId: orderId,
    entityType: "ManufacturingOrder",
  });

  return updated;
}
