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

// PHASE 3 (D-09): المطابقة الثلاثية اليدوية — النظام يعرض ويُلزِم ويسجّل، لا يقارن.
// التأكيدات تُخزَّن كـ ActivityLog (append-only، بلا تغيير schema) وتُحسب منذ آخر
// دخول للمراجعة (MFG_SUBMITTED_FOR_REVIEW) لتُعاد الحالة الصفرية عند كل إعادة تقديم.
export const MATCH_ITEMS = ["CUSTOMER_REQUEST", "INSPECTION", "ENGINEERING"] as const;
export type MatchItem = (typeof MATCH_ITEMS)[number];

/** يعيد قائمة العناصر المؤكَّدة منذ آخر دخول لبوابة المراجعة (distinct) */
export async function getConfirmedMatchItems(orderId: string): Promise<MatchItem[]> {
  const lastSubmit = await prisma.activityLog.findFirst({
    where: {
      entity: "ManufacturingOrder",
      entityId: orderId,
      action: "MFG_SUBMITTED_FOR_REVIEW",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastSubmit) return [];

  const confirms = await prisma.activityLog.findMany({
    where: {
      entity: "ManufacturingOrder",
      entityId: orderId,
      action: "MFG_MATCH_CONFIRMED",
      createdAt: { gte: lastSubmit.createdAt },
    },
    select: { details: true },
  });

  const set = new Set<MatchItem>();
  for (const c of confirms) {
    try {
      const item = JSON.parse(c.details ?? "{}").item as MatchItem;
      if ((MATCH_ITEMS as readonly string[]).includes(item)) set.add(item);
    } catch {
      /* سجل قديم بصيغة غير JSON — يُتجاهل */
    }
  }
  return [...set];
}

/** REVIEW يؤكّد مطابقة عنصر واحد من الثلاثة (الأمر قيد المراجعة فقط) */
export async function confirmMatchItem(
  orderId: string,
  item: MatchItem,
  actorId: string
) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "UNDER_REVIEW")
    throw new MfgReviewError("errors.illegalStatusTransition");

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_MATCH_CONFIRMED",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: JSON.stringify({ item }),
    },
  });
  return getConfirmedMatchItems(orderId);
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

/**
 * الاعتماد (REVIEW = محمد حسام) = المطابقة الثلاثية فقط (D-09).
 * D-12: **لا يختار مصنعًا ولا تاريخًا** — ذلك دور PROCUREMENT (شكري) لاحقًا (assignFactory).
 * IN_PRODUCTION تُكتب بـ factoryId=null · expectedAt=null، دلالتها: "معتمد ومسلَّم
 * لـ PROCUREMENT للتنفيذ". إلزامية المصنع تُفرض عند بوابة READY لا هنا (قرار ب).
 */
export async function approveOrder(orderId: string, actorId: string) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "UNDER_REVIEW")
    throw new MfgReviewError("errors.illegalStatusTransition");

  // PHASE 3 (D-09): حجب server-side — لا اعتماد قبل تأكيد المطابقات الثلاث كلها
  const confirmed = await getConfirmedMatchItems(orderId);
  if (confirmed.length < MATCH_ITEMS.length)
    throw new MfgReviewError("errors.matchIncomplete");

  const updated = await prisma.manufacturingOrder.update({
    where: { id: orderId },
    data: {
      status: "IN_PRODUCTION",
      rejectionReason: null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_REVIEW_APPROVED",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: `اعتُمد أمر التصنيع (مطابقة ثلاثية) — بانتظار توجيه PROCUREMENT للمصنع`,
    },
  });

  return updated;
}

/**
 * D-12: PROCUREMENT (شكري) يعيّن المصنع النشط + التاريخ المتوقع على أمر IN_PRODUCTION.
 * منفصل عن اعتماد REVIEW — لا جمود (REVIEW يعتمد مستقلًا، شكري يوجّه بعده).
 */
export async function assignFactory(
  orderId: string,
  factoryId: string,
  expectedAt: Date,
  actorId: string
) {
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new MfgReviewError("errors.notFound");
  if (order.status !== "IN_PRODUCTION")
    throw new MfgReviewError("errors.illegalStatusTransition");

  const factory = await prisma.factory.findUnique({ where: { id: factoryId } });
  if (!factory || !factory.isActive) throw new MfgReviewError("errors.factoryInactive");

  const updated = await prisma.manufacturingOrder.update({
    where: { id: orderId },
    data: { factoryId, expectedAt },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "MFG_FACTORY_ASSIGNED",
      entity: "ManufacturingOrder",
      entityId: orderId,
      details: `عيّن PROCUREMENT المصنع ${factory.code} — تسليم متوقع ${expectedAt.toISOString().slice(0, 10)}`,
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

  // PHASE 3: الرفض يرجع للمكتب الهندسي — إشعار المدير التنفيذي (مُصدِر الأمر) TEC_APPROVER
  await notifyRole("TEC_APPROVER", {
    title: "notifications.mfgRejectedTitle",
    body: `أمر تصنيع مردود من المراجعة — السبب: ${reason}`,
    type: "MFG_REVIEW_REJECTED",
    entityId: orderId,
    entityType: "ManufacturingOrder",
  });

  return updated;
}
