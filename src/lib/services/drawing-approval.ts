import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { notifyRole } from "@/lib/notifications/send";

/**
 * ⛔ مُعطَّل بالكامل — PHASE 1 (دفعة هـ · 2026-07-12).
 * بوابتا G2 (verifyDrawing) وG3 (ceoApproveDrawing) كانتا مخترَعتين (D-02/D-05):
 * حسن بهاء بلا بوابة، وعمرو خارج سلسلة الرسومات. لا مستهلِك لهذا الملف بعد الآن
 * (action-ا البوابتين يرفضان بـ errors.gateRemoved). الكود باقٍ ميتًا حتى حذفه
 * في SCR منفصل ليوسف (BL-20 — مصير RELEASED_TO_FACTORY/INS_VERIFIED/CEO_APPROVED).
 * الإفراج للمصنع صار خاصية أمر التصنيع بعد اعتماد REVIEW (PHASE 3)، لا حالة على الرسمة.
 *
 * ── التوثيق التاريخي للسلسلة الملغاة ──
 * دفعة ب — سلسلة اعتماد الرسومات W-05 (آلة الحالة الكاملة):
 *   DRAFT → TEC_APPROVED (G1: TEC_APPROVER)
 *         → INS_VERIFIED (G2: INSPECTION_MANAGER)
 *         → CEO_APPROVED (G3: ADMIN — **مشروط بالعتبة فقط**)
 *         → RELEASED_TO_FACTORY (تلقائي بعد آخر بوابة مطلوبة + إشعار PROCUREMENT)
 *
 * قرارات التخطي كلها في nextGate() وحدها — لا تتناثر:
 * - `ceoDrawingApprovalThreshold` NULL → **G3 يُتخطّى** (قرار يوسف: لا عتبة مضبوطة = لا اعتماد CEO؛
 *   الغياب لا يعطّل السلسلة — عمرو يفعّلها من شاشة الإعدادات متى قرّر).
 * - قيمة القياس = `Contract.totalValue ?? Quotation.total` (العقد سند مجمّد؛ السوشيال بلا عقد → قيمة العرض).
 * - `reviewGatePosition` NULL → دور REVIEW يُتخطّى كليًا (القرار الموثق R-05 — الموضع config لم يُحسم بعد).
 * - منع اعتماد الذات في **كل** بوابة: رافع الرسمة لا يعتمدها/يتحقق منها (ADMIN مستثنى كما G1 القائم).
 */
export class DrawingGateError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "DrawingGateError";
  }
}

type GateResult =
  | { kind: "GATE"; status: "CEO_APPROVED" }
  | { kind: "RELEASE" };

/** يقرر ما بعد INS_VERIFIED: بوابة CEO أم إفراج مباشر — المكان الوحيد لقرار التخطي */
async function nextGateAfterVerify(drawingId: string): Promise<GateResult> {
  const settings = await getSystemSettings();
  const threshold = settings?.ceoDrawingApprovalThreshold ?? null;

  // NULL = لا عتبة مضبوطة → G3 يُتخطّى (موثّق أعلاه)
  if (threshold === null) return { kind: "RELEASE" };

  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    select: {
      quotationRequest: {
        select: {
          quotation: {
            select: { total: true, contract: { select: { totalValue: true } } },
          },
        },
      },
    },
  });
  const q = drawing?.quotationRequest.quotation;
  // قيمة القياس: العقد المجمّد أولًا، وإلا قيمة العرض (قرار ب)
  const value: Prisma.Decimal = q?.contract?.totalValue ?? q?.total ?? new Prisma.Decimal(0);

  return value.gt(threshold) ? { kind: "GATE", status: "CEO_APPROVED" } : { kind: "RELEASE" };
}

async function release(drawingId: string, actorId: string) {
  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: "RELEASED_TO_FACTORY" },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "DRAWING_RELEASED",
      entity: "Drawing",
      entityId: drawingId,
      details: "أُفرج عن الرسمة للتصنيع (اكتملت بوابات الاعتماد المطلوبة)",
    },
  });

  await notifyRole("PROCUREMENT", {
    title: "notifications.drawingReleasedTitle",
    body: "رسمة معتمدة أُفرج عنها للتصنيع",
    type: "DRAWING_RELEASED",
    entityId: drawingId,
    entityType: "Drawing",
  });
}

function assertNotSelf(uploadedById: string, actorId: string, actorRole: string) {
  if (uploadedById === actorId && actorRole !== "ADMIN") {
    throw new DrawingGateError("errors.cannotApproveSelf");
  }
}

/** G2 — تحقق مدير المعاينات: TEC_APPROVED → INS_VERIFIED (ثم إفراج/بوابة CEO حسب العتبة) */
export async function verifyDrawing(drawingId: string, actorId: string, actorRole: string) {
  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    select: { id: true, status: true, uploadedById: true, quotationRequestId: true },
  });
  if (!drawing) throw new DrawingGateError("errors.notFound");
  if (drawing.status !== "TEC_APPROVED")
    throw new DrawingGateError("errors.illegalStatusTransition");
  assertNotSelf(drawing.uploadedById, actorId, actorRole);

  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: "INS_VERIFIED" },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "DRAWING_VERIFIED",
      entity: "Drawing",
      entityId: drawingId,
      details: "تحقق مدير المعاينات من الرسمة (G2)",
    },
  });

  const next = await nextGateAfterVerify(drawingId);
  if (next.kind === "RELEASE") {
    await release(drawingId, actorId);
    return { released: true as const };
  }

  // فوق العتبة → بانتظار اعتماد CEO
  await notifyRole("ADMIN", {
    title: "notifications.drawingAwaitingCeoTitle",
    body: "رسمة تجاوزت عتبة الاعتماد — بانتظار اعتماد الإدارة العليا",
    type: "DRAWING_AWAITING_CEO",
    entityId: drawingId,
    entityType: "Drawing",
  });
  return { released: false as const };
}

/** G3 — اعتماد CEO (مطلوب فقط فوق العتبة): INS_VERIFIED → CEO_APPROVED → إفراج */
export async function ceoApproveDrawing(drawingId: string, actorId: string, actorRole: string) {
  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    select: { id: true, status: true, uploadedById: true },
  });
  if (!drawing) throw new DrawingGateError("errors.notFound");
  if (drawing.status !== "INS_VERIFIED")
    throw new DrawingGateError("errors.illegalStatusTransition");
  assertNotSelf(drawing.uploadedById, actorId, actorRole);

  // حارس العتبة: لو الرسمة تحت العتبة (أو العتبة NULL) فما كان يجب أن تصل هنا — الإفراج مباشرة أولى،
  // لكن اعتماد CEO الصريح لا يضر (أعلى سلطة) — نسجّله ونفرج.
  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: "CEO_APPROVED" },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "DRAWING_CEO_APPROVED",
      entity: "Drawing",
      entityId: drawingId,
      details: "اعتماد الإدارة العليا للرسمة (G3 — فوق العتبة)",
    },
  });

  await release(drawingId, actorId);
  return { released: true as const };
}
