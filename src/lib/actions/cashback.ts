"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/config";

const CASHBACK_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];

const linkCashbackSchema = z.object({
  customerId: z.string().min(1),
  quotationId: z.string().min(1),
});

export async function linkCashbackOnContractAction(
  input: unknown
): Promise<{ success: true; cashbackPct: number } | { skipped: true; reason: string } | { error: string }> {
  try {
    const roleCheck = await requireRole(CASHBACK_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = linkCashbackSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { customerId, quotationId } = parsed.data;

    const [customer, settings] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, isRepeat: true, coveredById: true },
      }),
      getSystemSettings(),
    ]);

    if (!customer) return { error: "errors.notFound" };

    // Guard: cashback must be enabled and customer must be repeat
    if (!settings?.cashbackActive) {
      return { skipped: true, reason: "cashback.skipped.inactive" };
    }
    if (!customer.isRepeat) {
      return { skipped: true, reason: "cashback.skipped.notRepeat" };
    }

    // Count completed (APPROVED) quotations for this customer to determine tier
    const priorOrderCount = await prisma.quotation.count({
      where: { customerId, status: "APPROVED", deletedAt: null },
    });
    const referralOrder = priorOrderCount + 1;

    // Find the matching CashbackTier
    const tier = await prisma.cashbackTier.findFirst({
      where: {
        isActive: true,
        orderFrom: { lte: referralOrder },
        OR: [{ orderTo: null }, { orderTo: { gte: referralOrder } }],
      },
      orderBy: { orderFrom: "desc" },
    });

    if (!tier) {
      return { skipped: true, reason: "cashback.skipped.noTier" };
    }

    const cashbackPct = tier.pct.toNumber();
    // referrerId is the customer who introduced this repeat customer
    const referrerId = customer.coveredById ?? customer.id;

    // Find or create the Referral record
    const existingReferral = await prisma.referral.findFirst({
      where: { newCustomerId: customerId, newQuotationId: quotationId },
    });

    if (existingReferral) {
      // Already linked — update pct if tier changed
      await prisma.referral.update({
        where: { id: existingReferral.id },
        data: { cashbackPct, referralOrder },
      });

      await prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "UPDATE",
          entity: "Referral",
          entityId: existingReferral.id,
          details: `تم تحديث نسبة الكاش باك إلى ${cashbackPct}% للعميل ${customer.name} (طلب رقم ${referralOrder})`,
        },
      });
    } else {
      const referral = await prisma.referral.create({
        data: {
          referrerId,
          newCustomerId: customerId,
          newQuotationId: quotationId,
          referralOrder,
          cashbackPct,
          baseAmount: 0,
          cashbackAmount: 0,
          status: "PENDING",
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "CREATE",
          entity: "Referral",
          entityId: referral.id,
          details: `تم ربط كاش باك ${cashbackPct}% للعميل ${customer.name} عند إنشاء العقد (طلب رقم ${referralOrder})`,
        },
      });
    }

    return { success: true, cashbackPct };
  } catch (error) {
    console.error("[linkCashbackOnContractAction]", error);
    return { error: "errors.serverError" };
  }
}
