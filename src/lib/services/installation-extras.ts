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

  // ── D-18 / BL-60: الباب مقفول — لا أمر تصنيع بديل تلقائي (كان يتخطّى الدور
  // والعقد والدفعة والرسمة وبوابة REVIEW). أنواع الخطأ/الكسر تُبلَّغ فقط:
  // INSTALLATIONS (المدير) + REVIEW، وموديول التحقيق (BL-63) يتولّى المتابعة
  // قبل أي تصنيع بديل. لا `createManufacturingOrder`، لا كتابة مباشرة. ──
  const mapping = REPLACEMENT_MAP[input.type];
  if (mapping) {
    await prisma.activityLog.create({
      data: {
        userId: actorId,
        action: "REPLACEMENT_REQUESTED",
        entity: "InstallationItem",
        entityId: item.id,
        details: `طلب بديل (${mapping.faultType}) على أمر ${input.installationOrderId} — السبب: ${input.description ?? input.type}`,
      },
    });
    for (const role of ["INSTALLATIONS", "REVIEW"] as const) {
      await notifyRole(role, {
        title: "notifications.replacementRequestedTitle",
        body: `طلب بديل (${mapping.faultType}) — السبب: ${input.description ?? input.type}`,
        type: "REPLACEMENT_REQUESTED",
        entityId: item.id,
        entityType: "InstallationItem",
      });
    }
  }

  // replacementOrderId يبقى null دائمًا — لا أمر تلقائي بعد الآن (يحفظ توقيع المُستدعي)
  return { item, replacementOrderId: null as string | null };
}

// D-18/BL-60: createReplacementOrder (الإنشاء التلقائي المباشر IN_PRODUCTION) حُذف.
// البديل لا يُصنَّع إلا بعد تحقيق REVIEW (BL-63) وطلب PROCUREMENT صريح.

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
