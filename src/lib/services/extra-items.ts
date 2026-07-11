import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";

// دفعة أ — W-04: بطاقة الإكسسوار. TEC ينشئ · INS يؤكد · PRC يُدخل التكلفة فقط
const D = Prisma.Decimal;

export class ExtraItemError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "ExtraItemError";
  }
}

export interface AddExtraItemInput {
  manufacturingOrderId: string;
  type: string;
  description?: string;
  qty?: number;
}

/** TEC ينشئ بند بطاقة الإكسسوار — المواصفة (نوع/وصف/كمية) ملك TEC حصريًا */
export async function addExtraItem(input: AddExtraItemInput, actorId: string) {
  const order = await prisma.manufacturingOrder.findUnique({
    where: { id: input.manufacturingOrderId },
    select: { id: true },
  });
  if (!order) throw new ExtraItemError("errors.notFound");

  const item = await prisma.extraItem.create({
    data: {
      manufacturingOrderId: input.manufacturingOrderId,
      type: input.type as never,
      description: input.description ?? null,
      qty: input.qty !== undefined ? new D(String(input.qty)) : null,
      createdById: actorId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "EXTRA_ITEM_ADDED",
      entity: "ExtraItem",
      entityId: item.id,
      details: `بند إكسسوار ${input.type} على أمر ${input.manufacturingOrderId} — كمية ${input.qty ?? "—"}`,
    },
  });

  return item;
}

/** INS يؤكد المقاسات (W-04) — التأكيد يُخطر المشتريات (نمط MFG_READY) */
export async function confirmExtraItem(id: string, actorId: string) {
  const item = await prisma.extraItem.findUnique({
    where: { id },
    select: { id: true, type: true, manufacturingOrderId: true, confirmedByInspection: true },
  });
  if (!item) throw new ExtraItemError("errors.notFound");
  if (item.confirmedByInspection) throw new ExtraItemError("errors.itemAlreadyConfirmed");

  const confirmed = await prisma.extraItem.update({
    where: { id },
    data: { confirmedByInspection: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "EXTRA_ITEM_CONFIRMED",
      entity: "ExtraItem",
      entityId: id,
      details: `تأكيد مقاسات بند ${item.type} على أمر ${item.manufacturingOrderId} (INS)`,
    },
  });

  await notifyRole("PROCUREMENT", {
    title: "notifications.extraItemConfirmedTitle",
    body: `بند إكسسوار مؤكَّد جاهز للتوريد — أمر ${item.manufacturingOrderId}`,
    type: "EXTRA_ITEM_CONFIRMED",
    entityId: item.manufacturingOrderId,
    entityType: "ManufacturingOrder",
  });

  return confirmed;
}

/**
 * PRC يُدخل التكلفة فقط — الفرض server-side مزدوج:
 * 1) هذه الدالة لا تكتب إلا unitCost (المواصفة لا تمر من هنا إطلاقًا).
 * 2) لا تكلفة على بند غير مؤكَّد (قرار: التكلفة على مواصفة غير مؤكدة سابقة لأوانها).
 */
export async function setExtraItemCost(id: string, unitCost: number, actorId: string) {
  const item = await prisma.extraItem.findUnique({
    where: { id },
    select: { id: true, type: true, confirmedByInspection: true },
  });
  if (!item) throw new ExtraItemError("errors.notFound");
  if (!item.confirmedByInspection) throw new ExtraItemError("errors.itemNotConfirmed");

  const cost = new D(String(unitCost));
  const updated = await prisma.extraItem.update({
    where: { id },
    data: { unitCost: cost },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "EXTRA_ITEM_COSTED",
      entity: "ExtraItem",
      entityId: id,
      details: `تكلفة بند ${item.type}: ${cost} (PRC — إدخال يدوي)`,
    },
  });

  return updated;
}

export async function listExtraItems(manufacturingOrderId: string) {
  return prisma.extraItem.findMany({
    where: { manufacturingOrderId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });
}
