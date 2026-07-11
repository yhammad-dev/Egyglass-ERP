import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";

// دفعة ج — IMT-R05/R06: بنود وصور التركيب. الصلاحية: قائد الفريق على هذا الأمر
// حصريًا (R-04: القائد فقط)، وADMIN override — لا فنيين آخرين (إجابة إسلام BRD-5)
const D = Prisma.Decimal;

export class InstallationExtrasError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "InstallationExtrasError";
  }
}

/** حارس القيادة: INSTALLATIONS يجب أن يكون قائد الفريق على الأمر نفسه — ADMIN يتجاوز */
async function assertTeamLead(installationOrderId: string, actorId: string, actorRole: string) {
  const order = await prisma.installationOrder.findUnique({
    where: { id: installationOrderId },
    select: { id: true, teamLeadId: true },
  });
  if (!order) throw new InstallationExtrasError("errors.notFound");
  if (actorRole !== "ADMIN" && order.teamLeadId !== actorId) {
    throw new InstallationExtrasError("errors.notTeamLead");
  }
  return order;
}

export interface AddInstallationItemInput {
  installationOrderId: string;
  type: string;
  description?: string;
  quantity?: number;
  cost?: number;
}

/**
 * W-06 — خريطة يوسف المعتمدة: نوع بند التركيب → faultType الأمر البديل → وجهة الإشعار.
 * CLIENT_DELAY / OTHER ليسا خطأ تصنيعيًا → لا أمر بديل (غير موجودين في الخريطة عمدًا).
 */
const REPLACEMENT_MAP: Record<
  string,
  { faultType: "BREAKAGE" | "FACTORY_ERROR" | "TEC_ERROR" | "MEASUREMENT_ERROR"; notify: string }
> = {
  BREAKAGE_REPLACEMENT: { faultType: "BREAKAGE", notify: "PROCUREMENT" }, // تشغيل لا اتهام
  MFG_ERROR: { faultType: "FACTORY_ERROR", notify: "PROCUREMENT" },
  TEC_ERROR: { faultType: "TEC_ERROR", notify: "TECHNICAL_OFFICE" },
  MEASUREMENT_ERROR: { faultType: "MEASUREMENT_ERROR", notify: "INSPECTION_MANAGER" },
};

export async function addInstallationItem(
  input: AddInstallationItemInput,
  actorId: string,
  actorRole: string
) {
  await assertTeamLead(input.installationOrderId, actorId, actorRole);

  const item = await prisma.installationItem.create({
    data: {
      installationOrderId: input.installationOrderId,
      type: input.type as never,
      description: input.description ?? null,
      quantity: input.quantity !== undefined ? new D(String(input.quantity)) : null,
      cost: input.cost !== undefined ? new D(String(input.cost)) : null,
      createdById: actorId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INSTALLATION_ITEM_ADDED",
      entity: "InstallationItem",
      entityId: item.id,
      details: `بند تركيب ${input.type} على أمر ${input.installationOrderId} — ${input.description ?? "بلا وصف"}`,
    },
  });

  // ── W-06: أنواع الخطأ/الكسر تولّد أمر تصنيع بديلًا تلقائيًا ──
  const mapping = REPLACEMENT_MAP[input.type];
  let replacementOrderId: string | null = null;
  if (mapping) {
    const replacement = await createReplacementOrder(
      input.installationOrderId,
      mapping,
      input.description ?? input.type,
      actorId
    );
    replacementOrderId = replacement.id;
  }

  return { item, replacementOrderId };
}

/**
 * W-06 — الأمر البديل: يرث العرض/المصنع من الأصلي · parentOrderId + faultType ·
 * Fast-track: يدخل IN_PRODUCTION مباشرة (الرسمة معتمدة سلفًا — يتخطّى UNDER_REVIEW).
 */
async function createReplacementOrder(
  installationOrderId: string,
  mapping: { faultType: string; notify: string },
  reason: string,
  actorId: string
) {
  const installation = await prisma.installationOrder.findUnique({
    where: { id: installationOrderId },
    select: {
      manufacturingOrder: {
        select: {
          id: true,
          quotationId: true,
          factoryId: true,
          quotation: { select: { number: true, customer: { select: { name: true } } } },
        },
      },
    },
  });
  if (!installation) throw new InstallationExtrasError("errors.notFound");
  const original = installation.manufacturingOrder;

  const replacement = await prisma.manufacturingOrder.create({
    data: {
      quotationId: original.quotationId, // يرث العرض (ومعه العميل/الطلب)
      factoryId: original.factoryId, // يرث المصنع إن وُجد
      parentOrderId: original.id,
      faultType: mapping.faultType as never,
      status: "IN_PRODUCTION", // Fast-track — بلا بوابة مراجعة
      notes: `أمر بديل (W-06) عن ${original.id} — السبب: ${reason}`,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "REPLACEMENT_ORDER_CREATED",
      entity: "ManufacturingOrder",
      entityId: replacement.id,
      details: `أمر تصنيع بديل عن ${original.id} (عرض ${original.quotation.number}) — النوع: ${mapping.faultType} — السبب: ${reason}`,
    },
  });

  await notifyRole(mapping.notify, {
    title: "notifications.replacementOrderTitle",
    body: `أمر تصنيع بديل (${mapping.faultType}) للعميل ${original.quotation.customer.name} — السبب: ${reason}`,
    type: "REPLACEMENT_ORDER_CREATED",
    entityId: replacement.id,
    entityType: "ManufacturingOrder",
  });

  return replacement;
}

export async function addInstallationPhoto(
  input: { installationOrderId: string; url: string; caption?: string },
  actorId: string,
  actorRole: string
) {
  await assertTeamLead(input.installationOrderId, actorId, actorRole);

  const photo = await prisma.installationPhoto.create({
    data: {
      installationOrderId: input.installationOrderId,
      url: input.url,
      caption: input.caption ?? null,
      uploadedById: actorId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INSTALLATION_PHOTO_ADDED",
      entity: "InstallationPhoto",
      entityId: photo.id,
      details: `صورة تركيب على أمر ${input.installationOrderId}${input.caption ? ` — ${input.caption}` : ""}`,
    },
  });

  return photo;
}
