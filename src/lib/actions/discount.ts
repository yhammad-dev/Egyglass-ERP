"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { notifyRole } from "@/lib/notifications/send";

const DISCOUNT_ROLES = ["SALES_REP", "SALES_MANAGER", "ADMIN"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const s = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
  return {
    discountBasePct: s?.discountBasePct.toNumber() ?? 18,
    discountMaxReqPct: s?.discountMaxReqPct.toNumber() ?? 25,
  };
}

function recomputeTotals(subtotal: number, discountPct: number, taxPct: number) {
  const discountAmount = (subtotal * discountPct) / 100;
  const netAfterDiscount = subtotal - discountAmount;
  const taxAmount = (netAfterDiscount * taxPct) / 100;
  const total = netAfterDiscount + taxAmount;
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

    const { quotationId, requestedPct, reason } = parsed.data;

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

    const subtotal = quotation.subtotal.toNumber();
    const taxPct = quotation.taxPct.toNumber();
    const { discountAmount, taxAmount, total } = recomputeTotals(subtotal, requestedPct, taxPct);

    if (requestedPct <= discountBasePct) {
      // Within base threshold — apply directly, no approval needed
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { discountPct: requestedPct, discountAmount, taxAmount, total },
      });

      await prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: quotationId,
          details: `تم تطبيق خصم ${requestedPct}% مباشرة على عرض السعر ${quotation.number} (ضمن الحد الأساسي ${discountBasePct}%)`,
        },
      });

      return { success: true };
    }

    // Above base threshold — requires approval
    const approverRole = requestedPct > discountMaxReqPct ? "ADMIN" : "SALES_MANAGER";
    const resolvedReason =
      reason?.trim() ||
      `خصم ${requestedPct}% يتجاوز الحد الأساسي (${discountBasePct}%)`;

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
          details: `طلب خصم ${requestedPct}% على عرض السعر ${quotation.number} — في انتظار موافقة ${approverRole === "ADMIN" ? "الإدارة العليا" : "مدير المبيعات"}`,
        },
      }),
    ]);

    await notifyRole(approverRole, {
      title: "discount.approvalRequestedTitle",
      body: `طلب خصم ${requestedPct}% على عرض السعر ${quotation.number}`,
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

// ─── PHASE 2: Decide on a pending discount request ───────────────────────────

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
    const roleCheck = await requireRole(["SALES_MANAGER", "ADMIN"]);
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
      },
    });
    if (!discountRequest) return { error: "errors.notFound" };
    if (discountRequest.status !== "PENDING") return { error: "errors.invalidInput" };

    const { discountMaxReqPct } = await getSettings();
    const requestedPct = discountRequest.requestedPct.toNumber();

    // SALES_MANAGER cannot decide requests that exceed discountMaxReqPct
    if (roleCheck.role === "SALES_MANAGER" && requestedPct > discountMaxReqPct) {
      return { error: "errors.notAuthorized" };
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: discountRequest.quotationId },
      select: { id: true, number: true, subtotal: true, taxPct: true },
    });
    if (!quotation) return { error: "errors.notFound" };

    const subtotal = quotation.subtotal.toNumber();
    const taxPct = quotation.taxPct.toNumber();
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

      return { success: true };
    }

    // APPROVED or ADJUSTED
    const finalPct =
      decision === "ADJUSTED"
        ? (approvedPct ?? requestedPct)
        : requestedPct;

    const { discountAmount, taxAmount, total } = recomputeTotals(subtotal, finalPct, taxPct);

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
              ? `تمت الموافقة بنسبة معدّلة ${finalPct}% (بدلاً من ${requestedPct}%) على عرض السعر ${quotation.number}`
              : `تمت الموافقة على خصم ${finalPct}% على عرض السعر ${quotation.number}`,
        },
      }),
    ]);

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
