import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";

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

/**
 * PHASE 2 — REVIEW تكتب ملاحظات الأثر المُجمَّع (evidenceNotes).
 * D-30 (PHASE 3): تُقفل بعد JUDGED — الحُكم استند إليها، تعديلها بعده يُفرغ الأثر من معناه.
 */
export async function saveEvidenceNotes(
  investigationId: string,
  notes: string,
  actorId: string
) {
  const investigation = await prisma.faultInvestigation.findUnique({
    where: { id: investigationId },
    select: { id: true, status: true },
  });
  if (!investigation) throw new FaultInvestigationError("errors.notFound");
  if (investigation.status === "JUDGED")
    throw new FaultInvestigationError("errors.investigationLocked");

  const updated = await prisma.faultInvestigation.update({
    where: { id: investigationId },
    data: { evidenceNotes: notes },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INVESTIGATION_EVIDENCE_SAVED",
      entity: "FaultInvestigation",
      entityId: investigationId,
      details: `حُفظت ملاحظات الأثر — ${notes.length} حرفًا: ${notes.slice(0, 300)}${notes.length > 300 ? "…" : ""}`,
    },
  });

  return updated;
}

/** كل قيم FaultType — الحُكم فئة عطل لا اسم شخص (D-26) */
export const FAULT_TYPES = [
  "BREAKAGE",
  "FACTORY_ERROR",
  "TEC_ERROR",
  "MEASUREMENT_ERROR",
  "CUSTOMER_DELAY",
] as const;

/**
 * PHASE 3 — الحُكم (D-25: ADMIN وحده — الدور يُفرض في الـ action).
 * D-27: claimedFault لا يُمَس أبدًا — الادعاء والحُكم حقلان منفصلان.
 * D-30: بعد JUDGED تُقفل evidenceNotes (في saveEvidenceNotes) ولا حُكم ثانٍ (OPEN فقط).
 * الإشعارات: REVIEW + INSTALLATIONS دائمًا · TECHNICAL_OFFICE لو الحُكم
 * TEC_ERROR/MEASUREMENT_ERROR (D-28: تصحيح الرسمة = المكتب الفني في الحالتين).
 */
export async function judgeFaultInvestigation(
  investigationId: string,
  verdictFault: (typeof FAULT_TYPES)[number],
  verdictNotes: string,
  actorId: string
) {
  const trimmedNotes = verdictNotes.trim();
  if (!trimmedNotes) throw new FaultInvestigationError("errors.verdictNotesRequired");

  const investigation = await prisma.faultInvestigation.findUnique({
    where: { id: investigationId },
    select: {
      id: true,
      status: true,
      claimedFault: true,
      manufacturingOrder: { select: { quotation: { select: { number: true } } } },
    },
  });
  if (!investigation) throw new FaultInvestigationError("errors.notFound");
  if (investigation.status !== "OPEN")
    throw new FaultInvestigationError("errors.illegalStatusTransition");

  // D-27: الادعاء لا يُكتب هنا إطلاقًا — الحُكم في حقوله المنفصلة فقط
  const updated = await prisma.faultInvestigation.update({
    where: { id: investigationId },
    data: {
      verdictFault,
      verdictNotes: trimmedNotes,
      verdictById: actorId,
      verdictAt: new Date(),
      status: "JUDGED",
    },
  });

  const quotationNumber = investigation.manufacturingOrder.quotation.number;
  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INVESTIGATION_JUDGED",
      entity: "FaultInvestigation",
      entityId: investigationId,
      details: `حُكم التحقيق (${quotationNumber}) — الادعاء: ${investigation.claimedFault} · الحُكم: ${verdictFault} · التعليل: ${trimmedNotes.slice(0, 300)}${trimmedNotes.length > 300 ? "…" : ""}`,
    },
  });

  const notifyRoles = ["REVIEW", "INSTALLATIONS"];
  if (verdictFault === "TEC_ERROR" || verdictFault === "MEASUREMENT_ERROR") {
    notifyRoles.push("TECHNICAL_OFFICE");
  }
  for (const role of notifyRoles) {
    await notifyRole(role, {
      title: "notifications.investigationJudgedTitle",
      body: `حُكم تحقيق ${quotationNumber} — الحُكم: ${verdictFault} (الادعاء: ${investigation.claimedFault})`,
      type: "INVESTIGATION_JUDGED",
      entityId: investigationId,
      entityType: "FaultInvestigation",
    });
  }

  return updated;
}
