"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/config";
import { notifyRole, sendNotification } from "@/lib/notifications/send";

const DISCOUNT_ROLES = ["SALES_REP", "SALES_MANAGER", "ADMIN"];

// Pricing-audit fix: money math in Prisma.Decimal — zero float.
const D = Prisma.Decimal;
type Dec = InstanceType<typeof D>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const s = await getSystemSettings();
  return {
    discountBasePct: s?.discountBasePct ?? new D(18),
    discountMaxReqPct: s?.discountMaxReqPct ?? new D(25),
  };
}

function recomputeTotals(subtotal: Dec, discountPct: Dec, taxPct: Dec) {
  const discountAmount = subtotal.mul(discountPct).div(100);
  const netAfterDiscount = subtotal.sub(discountAmount);
  const taxAmount = netAfterDiscount.mul(taxPct).div(100);
  const total = netAfterDiscount.add(taxAmount);
  return { discountAmount, taxAmount, total };
}

// ─── PHASE 1: Request discount on existing quotation ─────────────────────────

const requestDiscountSchema = z.object({
  quotationId: z.string().min(1),
  requestedPct: z.coerce.number().min(0).max(100),
  reason: z.string().optional(),
});

export async function requestDiscountAction(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(DISCOUNT_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = requestDiscountSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { quotationId, reason } = parsed.data;
    const requestedPct = new D(String(parsed.data.requestedPct));

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        number: true,
        subtotal: true,
        taxPct: true,
        status: true,
      },
    });
    if (!quotation) return { error: "errors.notFound" };

    if (!["DRAFT", "SENT"].includes(quotation.status)) {
      return { error: "errors.invalidInput" };
    }

    const { discountBasePct, discountMaxReqPct } = await getSettings();

    // D-19: أي خصم = طلب — النسبة يجب أن تكون > 0 (لا معنى لطلب خصم 0%)
    if (requestedPct.lte(0)) {
      return { error: "errors.invalidInput" };
    }

    // D-19: السقف الصلب المطلق يُفرض على مسار الطلب أيضًا (لا خصم أعلى منه إطلاقًا)
    if (requestedPct.gt(discountMaxReqPct)) {
      return { error: "errors.discountExceedsMax" };
    }

    // BL-71: طلب خصم معلّق قائم على نفس العرض → لا طلب ثانٍ
    const existingPending = await prisma.discountRequest.findFirst({
      where: { quotationId, status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      return { error: "errors.discountRequestPending" };
    }

    // D-19: **كل خصم = طلب** (لا تطبيق مباشر — أُلغي مسار ≤18). فوق discountBasePct
    // (سقف تفاوض المدير) → "طلب خصم استثنائي". السلسلة ثابتة: مدير المبيعات يمرّر → الإدارة العليا تقرر.
    const isExceptional = requestedPct.gt(discountBasePct);
    const resolvedReason =
      reason?.trim() ||
      (isExceptional
        ? `طلب خصم استثنائي ${requestedPct}% (فوق حد التفاوض ${discountBasePct}%)`
        : `طلب خصم ${requestedPct}%`);

    await prisma.$transaction([
      prisma.quotation.update({
        where: { id: quotationId },
        data: { status: "PENDING_APPROVAL", needsApproval: true },
      }),
      prisma.discountRequest.create({
        data: {
          quotationId,
          requestedById: roleCheck.userId,
          requestedPct,
          reason: resolvedReason,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "CREATE",
          entity: "DiscountRequest",
          entityId: quotationId,
          details: `طلب خصم ${requestedPct}%${isExceptional ? " — استثنائي" : ""} على عرض السعر ${quotation.number} — بانتظار اعتماد مدير المبيعات ثم الإدارة العليا`,
        },
      }),
    ]);

    // السلسلة تبدأ بمدير المبيعات (يعتمد ويمرّر) — الإدارة العليا هي القرار النهائي
    await notifyRole("SALES_MANAGER", {
      title: "discount.approvalRequestedTitle",
      body: `طلب خصم ${requestedPct}%${isExceptional ? " (استثنائي)" : ""} على عرض السعر ${quotation.number}`,
      type: "DISCOUNT_APPROVAL_REQUESTED",
      entityId: quotationId,
      entityType: "Quotation",
    });

    return { success: true };
  } catch (error) {
    console.error("[requestDiscountAction]", error);
    return { error: "errors.serverError" };
  }
}

// ─── PHASE 2a: SALES_MANAGER يعتمد ويمرّر للإدارة العليا (D-19) — لا قرار نهائي ───

const passSchema = z.object({ discountRequestId: z.string().min(1) });

export async function passDiscountAction(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(["SALES_MANAGER"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = passSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const req = await prisma.discountRequest.findUnique({
      where: { id: parsed.data.discountRequestId },
      select: { id: true, quotationId: true, requestedPct: true, status: true, requestedById: true },
    });
    if (!req) return { error: "errors.notFound" };
    if (req.status !== "PENDING") return { error: "errors.invalidInput" };

    // D-20: منع اعتماد الذات — مدير المبيعات لا يمرّر خصمًا طلبه هو
    if (req.requestedById === roleCheck.userId) {
      return { error: "errors.cannotApproveSelf" };
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: req.quotationId },
      select: { number: true },
    });

    // لا تغيير للحالة — يبقى PENDING بانتظار قرار الإدارة العليا. تسجيل التمرير + إشعار ADMIN.
    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "DISCOUNT_MANAGER_PASSED",
        entity: "DiscountRequest",
        entityId: req.id,
        details: `اعتمد مدير المبيعات ومرّر طلب خصم ${req.requestedPct}% على عرض ${quotation?.number ?? req.quotationId} إلى الإدارة العليا`,
      },
    });

    await notifyRole("ADMIN", {
      title: "discount.approvalRequestedTitle",
      body: `طلب خصم ${req.requestedPct}% مرّره مدير المبيعات — بانتظار القرار النهائي`,
      type: "DISCOUNT_APPROVAL_REQUESTED",
      entityId: req.quotationId,
      entityType: "Quotation",
    });

    return { success: true };
  } catch (error) {
    console.error("[passDiscountAction]", error);
    return { error: "errors.serverError" };
  }
}

// ─── PHASE 2b: الإدارة العليا (ADMIN) تقرر النهائي على كل خصم — أي نسبة (D-19) ───

const decideDiscountSchema = z.object({
  discountRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "ADJUSTED", "REJECTED"]),
  approvedPct: z.coerce.number().min(0).max(100).optional(),
  rejectNote: z.string().optional(),
});

export async function decideDiscountAction(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    // D-19: القرار النهائي = الإدارة العليا فقط. مدير المبيعات لا ينهي السلسلة أبدًا.
    const roleCheck = await requireRole(["ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = decideDiscountSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { discountRequestId, decision, approvedPct, rejectNote } = parsed.data;

    const discountRequest = await prisma.discountRequest.findUnique({
      where: { id: discountRequestId },
      select: {
        id: true,
        quotationId: true,
        requestedPct: true,
        status: true,
        requestedById: true,
      },
    });
    if (!discountRequest) return { error: "errors.notFound" };
    if (discountRequest.status !== "PENDING") return { error: "errors.invalidInput" };

    const requestedPct = discountRequest.requestedPct;

    const quotation = await prisma.quotation.findUnique({
      where: { id: discountRequest.quotationId },
      select: { id: true, number: true, subtotal: true, taxPct: true },
    });
    if (!quotation) return { error: "errors.notFound" };

    const now = new Date();

    if (decision === "REJECTED") {
      await prisma.$transaction([
        prisma.discountRequest.update({
          where: { id: discountRequestId },
          data: {
            status: "REJECTED",
            decidedById: roleCheck.userId,
            decidedAt: now,
            reason: rejectNote ?? "تم الرفض بدون ملاحظات",
          },
        }),
        prisma.quotation.update({
          where: { id: discountRequest.quotationId },
          data: { status: "DRAFT", needsApproval: false },
        }),
        prisma.activityLog.create({
          data: {
            userId: roleCheck.userId,
            action: "UPDATE",
            entity: "DiscountRequest",
            entityId: discountRequestId,
            details: `تم رفض طلب خصم ${requestedPct}% على عرض السعر ${quotation.number}${rejectNote ? ` — ${rejectNote}` : ""}`,
          },
        }),
      ]);

      // D-19: إشعار مُقدِّم الطلب بالنتيجة ليبلّغ العميل
      await sendNotification({
        userId: discountRequest.requestedById,
        title: "discount.decisionTitle",
        body: `رُفض طلب خصم ${requestedPct}% على عرض ${quotation.number}${rejectNote ? ` — ${rejectNote}` : ""}`,
        type: "DISCOUNT_DECIDED",
        entityId: quotation.id,
        entityType: "Quotation",
      });

      return { success: true };
    }

    // APPROVED or ADJUSTED
    const finalPct =
      decision === "ADJUSTED"
        ? (approvedPct !== undefined ? new D(String(approvedPct)) : requestedPct)
        : requestedPct;

    const { discountAmount, taxAmount, total } = recomputeTotals(
      quotation.subtotal,
      finalPct,
      quotation.taxPct
    );

    await prisma.$transaction([
      prisma.discountRequest.update({
        where: { id: discountRequestId },
        data: {
          status: decision,
          approvedPct: finalPct,
          decidedById: roleCheck.userId,
          decidedAt: now,
        },
      }),
      prisma.quotation.update({
        where: { id: discountRequest.quotationId },
        data: {
          status: "APPROVED",
          approvedById: roleCheck.userId,
          discountPct: finalPct,
          discountAmount,
          taxAmount,
          total,
          needsApproval: false,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "UPDATE",
          entity: "DiscountRequest",
          entityId: discountRequestId,
          details:
            decision === "ADJUSTED"
              ? `تمت الموافقة بنسبة معدّلة ${finalPct}% (بدلاً من ${requestedPct}%) على عرض السعر ${quotation.number} — اعتماد العرض بواسطة ${roleCheck.userId}`
              : `تمت الموافقة على خصم ${finalPct}% على عرض السعر ${quotation.number} — اعتماد العرض بواسطة ${roleCheck.userId}`,
        },
      }),
    ]);

    // D-19: إشعار مُقدِّم الطلب بالنتيجة (approved/adjusted + النسبة) ليبلّغ العميل
    await sendNotification({
      userId: discountRequest.requestedById,
      title: "discount.decisionTitle",
      body:
        decision === "ADJUSTED"
          ? `اعتُمد خصم معدّل ${finalPct}% (بدل ${requestedPct}%) على عرض ${quotation.number}`
          : `اعتُمد خصم ${finalPct}% على عرض ${quotation.number}`,
      type: "DISCOUNT_DECIDED",
      entityId: quotation.id,
      entityType: "Quotation",
    });

    return { success: true };
  } catch (error) {
    console.error("[decideDiscountAction]", error);
    return { error: "errors.serverError" };
  }
}

// ─── Query: get pending discount request for a quotation ─────────────────────

export async function getDiscountRequestForQuotation(quotationId: string) {
  try {
    return await prisma.discountRequest.findFirst({
      where: { quotationId, status: "PENDING" },
      select: {
        id: true,
        requestedPct: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("[getDiscountRequestForQuotation]", error);
    return null;
  }
}
