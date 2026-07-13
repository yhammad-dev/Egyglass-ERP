import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// SCR-017 (BL-63، D-25..29) — موديول التحقيق في البديل:
// INSTALLATIONS تدّعي (نوع البند) · REVIEW تفتح التحقيق وتجمّع الأثر · ADMIN يحكم.
// D-27: الادعاء (claimedFault) والحُكم (verdictFault) حقلان منفصلان — الادعاء لا يُمَس.
export class FaultInvestigationError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "FaultInvestigationError";
  }
}

/**
 * BL-79 — خريطة يدوية بين enumين متوازيين لنفس المفهوم (توحيدهما SCR منفصل).
 * CLIENT_DELAY / OTHER خارج الخريطة عمدًا: ليسا خطأ تصنيعيًا، لا يولّدان بديلًا،
 * فلا تحقيق فيهما (نفس منطق REPLACEMENT_MAP في installation-extras.ts).
 */
export const CLAIM_MAP: Record<
  string,
  "BREAKAGE" | "FACTORY_ERROR" | "TEC_ERROR" | "MEASUREMENT_ERROR"
> = {
  BREAKAGE_REPLACEMENT: "BREAKAGE",
  MFG_ERROR: "FACTORY_ERROR",
  TEC_ERROR: "TEC_ERROR",
  MEASUREMENT_ERROR: "MEASUREMENT_ERROR",
};

export const INVESTIGABLE_ITEM_TYPES = Object.keys(CLAIM_MAP);

/**
 * REVIEW تفتح تحقيقًا على بند كسر/عيب مسجَّل من INSTALLATIONS.
 * الأمر الأصلي يُشتق ولا يُسأل (الدرس 4): InstallationItem → InstallationOrder →
 * ManufacturingOrder (1:1 — BL-80: granularity الأمر لا القطعة، مقبول بقرار يوسف).
 * تحقيق واحد لكل بند: @unique على installationItemId (السباق يُلتقط كـ P2002).
 */
export async function openFaultInvestigation(installationItemId: string, actorId: string) {
  const item = await prisma.installationItem.findUnique({
    where: { id: installationItemId },
    select: {
      id: true,
      type: true,
      description: true,
      installationOrder: { select: { manufacturingOrderId: true } },
      faultInvestigation: { select: { id: true } },
    },
  });
  if (!item) throw new FaultInvestigationError("errors.notFound");

  const claimedFault = CLAIM_MAP[item.type];
  if (!claimedFault) throw new FaultInvestigationError("errors.itemNotInvestigable");
  if (item.faultInvestigation) throw new FaultInvestigationError("errors.investigationExists");

  let investigation;
  try {
    investigation = await prisma.faultInvestigation.create({
      data: {
        manufacturingOrderId: item.installationOrder.manufacturingOrderId,
        installationItemId: item.id,
        claimedFault,
        openedById: actorId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new FaultInvestigationError("errors.investigationExists");
    }
    throw e;
  }

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INVESTIGATION_OPENED",
      entity: "FaultInvestigation",
      entityId: investigation.id,
      details: `فُتح تحقيق (ادعاء ${claimedFault}) على أمر التصنيع ${item.installationOrder.manufacturingOrderId} — بند التركيب ${item.id}${item.description ? ` (${item.description})` : ""}`,
    },
  });

  return investigation;
}
