"use server";

import { z } from "zod";
import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/config";
import { calculateRecipe } from "./calculateRecipe";
import { sendNotification } from "../notifications/send";
import {
  recomputeQuotationRequestStatus,
  recomputeCustomerStage,
} from "@/lib/services/status-derivation";

// دفعة هـ (W-01): التسعير للمكتب الفني حصرًا. المندوب يطلب لا يسعّر.
// SALES_MANAGER يبقى (إشراف/حالات مباشرة) — SALES_REP سُحب.
const PRICING_ROLES = ["ADMIN", "SALES_MANAGER", "TECHNICAL_OFFICE", "TEC_APPROVER"];
// RR-2: the low-factor floor is no longer hardcoded. It is read from
// SystemSettings.factorMinimum (SCR-008) and enforced server-side below.
const FACTOR_MINIMUM_FALLBACK = 1.5;

// Pricing-audit fix: all money math below runs in Prisma.Decimal (decimal.js) —
// never JS floats. Client-supplied numbers cross into Decimal via String() so
// no binary float representation ever leaks into the pipeline.
const D = Prisma.Decimal;
const toDec = (n: number) => new D(String(n));

export async function getProductRecipes(productTypeId: string) {
  try {
    return await prisma.productRecipe.findMany({
      where: { productTypeId },
      include: { Material: true },
    });
  } catch (error) {
    console.error("[getProductRecipes]", error);
    return [];
  }
}

export async function getPricingFactors() {
  try {
    return await prisma.pricingFactor.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
    });
  } catch (error) {
    console.error("[getPricingFactors]", error);
    return [];
  }
}

export async function getConfigTypes(productTypeId: string) {
  try {
    return await prisma.configType.findMany({
      where: { productTypeId },
      orderBy: { nameAr: "asc" },
    });
  } catch (error) {
    console.error("[getConfigTypes]", error);
    return [];
  }
}

export async function getConfigTypeOptions(productTypeId: string) {
  try {
    const configTypes = await getConfigTypes(productTypeId);
    return configTypes.map((c) => ({ id: c.id, nameAr: c.nameAr }));
  } catch (error) {
    console.error("[getConfigTypeOptions]", error);
    return [];
  }
}

const QUOTATION_PRODUCT_TYPE_CODES = [
  "SHOWER",
  "HANDR_STRAIGHT",
  "HANDR_INCLINED",
  "CLADDING",
  "LAMINATED",
  "GLASS_CEILING",
  "GLASS_FLOOR",
  "FACADE_MODULAR",
  "FACADE_SPIDER",
];

export async function getProductTypes() {
  try {
    return await prisma.productType.findMany({
      where: { code: { in: QUOTATION_PRODUCT_TYPE_CODES }, isActive: true },
      select: { id: true, code: true, nameAr: true },
      orderBy: { nameAr: "asc" },
    });
  } catch (error) {
    console.error("[getProductTypes]", error);
    return [];
  }
}

const calculateProductPricingSchema = z.object({
  height: z.coerce.number().positive("errors.invalidInput"),
  width: z.coerce.number().positive("errors.invalidInput"),
  configTypeId: z.string().optional(),
  pricingFactorId: z.string().min(1, "errors.invalidInput"),
});

export async function calculateProductPricing(
  productTypeCode: string,
  input: unknown
): Promise<
  | {
      success: true;
      data: {
        lines: {
          materialId: string;
          notes: string | null;
          nameAr: string;
          qty: number;
          unitCost: number;
          lineTotal: number;
          factorMode: string;
        }[];
        subtotalBeforeFixed: number;
        fixedTotal: number;
        grandTotal: number;
      };
      // Retained for backward-compatible typing of the quotation-builder consumer.
      // RR-2: the server no longer returns these — a below-minimum factor is now
      // rejected with { error: "errors.factorRequiresApproval" } instead.
      requiresApproval?: true;
      factor?: number;
    }
  | { error: string }
> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = calculateProductPricingSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { height, width, configTypeId, pricingFactorId } = parsed.data;

    const productType = await prisma.productType.findUnique({
      where: { code: productTypeCode },
    });
    if (!productType) return { error: "errors.notFound" };

    const [configType, pricingFactor, recipes] = await Promise.all([
      configTypeId
        ? prisma.configType.findUnique({ where: { id: configTypeId } })
        : Promise.resolve(null),
      prisma.pricingFactor.findUnique({ where: { id: pricingFactorId } }),
      getProductRecipes(productType.id),
    ]);

    if (configTypeId && !configType) return { error: "errors.notFound" };
    if (!pricingFactor) return { error: "errors.notFound" };

    const factorValue = pricingFactor.value.toNumber();

    // RR-2: enforce the pricing-factor floor server-side (never client-trusted).
    // Threshold comes from SystemSettings.factorMinimum, not a hardcoded constant.
    const settings = await getSystemSettings();
    const factorMinimum = settings?.factorMinimum.toNumber() ?? FACTOR_MINIMUM_FALLBACK;

    if (factorValue < factorMinimum) {
      // Do NOT return a calculation or a client-controllable approval flag.
      // Notify ADMINs that a below-floor factor was attempted, then block.
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      await Promise.all(
        adminUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.lowFactorApprovalTitle",
            body: `محاولة تسعير بعامل منخفض (${factorValue.toFixed(2)}) أقل من الحد الأدنى (${factorMinimum.toFixed(2)})`,
            type: "LOW_FACTOR_APPROVAL_REQUESTED",
          })
        )
      );
      return { error: "errors.factorRequiresApproval" };
    }

    const dimensions = {
      area: height * width,
      length: height + width + width,
      configCount: configType?.anglesCount ?? 0,
    };

    const result = calculateRecipe(recipes, dimensions, factorValue);

    return { success: true, data: result };
  } catch (error) {
    console.error("[calculateProductPricing]", error);
    return { error: "errors.serverError" };
  }
}

const createQuotationItemSchema = z.object({
  description: z.string().min(1, "errors.invalidInput"),
  quantity: z.coerce.number().positive("errors.invalidInput"),
  unitPrice: z.coerce.number().nonnegative("errors.invalidInput"),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1, "errors.invalidInput"),
  title: z.string().min(1, "errors.invalidInput"),
  items: z.array(createQuotationItemSchema).min(1, "errors.invalidInput"),
  needsApproval: z.boolean().optional(),
  pricingFactor: z.coerce.number().positive().optional(),
  discountPct: z.coerce.number().min(0, "errors.invalidInput").max(100, "errors.invalidInput").optional(),
  // دفعة هـ (W-01): ربط العرض بطلب التسعير الذي أنشأه المندوب — يرث المسار
  quotationRequestId: z.string().optional(),
});

export async function createQuotation(
  input: unknown
): Promise<{ success: true; data: { id: string } } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = createQuotationSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { customerId, title, items, needsApproval, pricingFactor, quotationRequestId } =
      parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    // دفعة هـ (W-01+W-02): لو العرض ناشئ عن طلب تسعير —
    // طلب بلا عرض = عرض أولي (INITIAL) · طلب له عرض = إعادة تسعير (FINAL) بسلسلة محفوظة
    let previousQuotationId: string | null = null;
    if (quotationRequestId) {
      const req = await prisma.quotationRequest.findUnique({
        where: { id: quotationRequestId },
        select: { id: true, quotationId: true },
      });
      if (!req) return { error: "errors.notFound" };
      previousQuotationId = req.quotationId; // null للأولي، العرض السابق لإعادة التسعير
    }

    const settings = await getSystemSettings();
    const validDays = settings?.quotationValidDays ?? 3;
    const vatPct = settings?.vatPct ?? new D(14);
    const discountBasePct = settings?.discountBasePct ?? new D(18);
    const discountMaxReqPct = settings?.discountMaxReqPct ?? new D(25);

    // RR-1/STEP-4: totals are ALWAYS re-derived server-side from the line items,
    // the negotiated discount, and the VAT rate in SystemSettings. No client-supplied
    // subtotal/total is accepted (the input schema does not expose those fields).
    // Pricing-audit fix: computed in Decimal end-to-end (zero float).
    const lineTotals = items.map((item) => toDec(item.quantity).mul(toDec(item.unitPrice)));
    const subtotal = lineTotals.reduce((sum, lt) => sum.add(lt), new D(0));
    const discountPct = toDec(parsed.data.discountPct ?? 0);

    // RR-1 STEP-1.4: hard cap — a discount above the configured maximum is rejected outright.
    if (discountPct.gt(discountMaxReqPct)) {
      return { error: "errors.discountExceedsMax" };
    }

    // RR-1 STEP-1.2/1.3: discount → net → VAT on net (NOT on subtotal).
    const discountAmount = subtotal.mul(discountPct).div(100);
    const netAfterDiscount = subtotal.sub(discountAmount);
    const taxAmount = netAfterDiscount.mul(vatPct).div(100);
    const total = netAfterDiscount.add(taxAmount);

    // A discount above the base cap requires management approval.
    const discountNeedsApproval = discountPct.gt(discountBasePct);
    const requiresApproval = (needsApproval ?? false) || discountNeedsApproval;

    // RR-1 STEP-1.5 (cashback): referral cashback is a SEPARATE post-execution
    // disbursement (see docs/quotation-math.md) and cannot be computed correctly at
    // quote time — the Customer model has no referrer linkage to populate
    // Referral.referrerId. cashbackPct is persisted as 0 here; the referral/cashback
    // engine remains a follow-up requiring a schema change (out of this task's scope).
    const cashbackPct = 0;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const count = await prisma.quotation.count();
    const number = `Q-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const quotation = await prisma.quotation.create({
      data: {
        number,
        customerId,
        createdById: roleCheck.userId,
        // W-02: إعادة التسعير = FINAL بسلسلة previousQuotationId (التاريخ محفوظ)
        ...(previousQuotationId
          ? { quotationType: "FINAL" as const, previousQuotationId }
          : {}),
        subtotal,
        discountPct,
        discountAmount,
        cashbackPct,
        taxPct: vatPct,
        taxAmount,
        total,
        validUntil,
        needsApproval: requiresApproval,
        ...(requiresApproval ? { status: "PENDING_APPROVAL" as const } : {}),
        items: {
          create: items.map((item, i) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: lineTotals[i],
          })),
        },
      },
    });

    // دفعة هـ (W-01): الطلب يشير دائمًا للعرض النافذ (الأحدث) — العروض القديمة تبقى بالسلسلة.
    // الحالة تُشتق لا تُكتب يدويًا (Phase 4): نربط العرض فقط ثم نعيد الاشتقاق المركزي.
    if (quotationRequestId) {
      await prisma.quotationRequest.update({
        where: { id: quotationRequestId },
        data: { quotationId: quotation.id },
      });
      await recomputeQuotationRequestStatus(quotationRequestId, roleCheck.userId);
    }
    // مرحلة العميل تُشتق (طلب مسعّر الآن → PRICED)
    await recomputeCustomerStage(customerId, roleCheck.userId);

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "CREATE",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم إنشاء عرض سعر "${title}" للعميل ${customer.name} برقم ${number}${quotationRequestId ? ` (من طلب ${quotationRequestId})` : ""}`,
      },
    });

    if (needsApproval && pricingFactor) {
      await prisma.quotationApproval.create({
        data: {
          quotationId: quotation.id,
          requestedById: roleCheck.userId,
          factor: pricingFactor,
          reason: `فاكتور منخفض (${pricingFactor.toFixed(2)}) يتطلب موافقة المدير`,
        },
      });

      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        adminUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.lowFactorApprovalTitle",
            body: `طلب موافقة على فاكتور منخفض (${pricingFactor.toFixed(2)}) لعرض السعر ${number}`,
            type: "LOW_FACTOR_APPROVAL_REQUESTED",
            entityId: quotation.id,
            entityType: "Quotation",
          })
        )
      );
    }

    // RR-1 STEP-1.4: a discount above the base cap opens a DiscountRequest (PENDING)
    // and notifies ADMINs for a decision.
    if (discountNeedsApproval) {
      await prisma.discountRequest.create({
        data: {
          quotationId: quotation.id,
          requestedById: roleCheck.userId,
          requestedPct: discountPct,
          reason: `خصم ${discountPct}% يتجاوز الحد الأساسي (${discountBasePct}%)`,
        },
      });

      const discountAdmins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        discountAdmins.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.lowFactorApprovalTitle",
            body: `طلب موافقة على خصم ${discountPct}% لعرض السعر ${number}`,
            type: "DISCOUNT_APPROVAL_REQUESTED",
            entityId: quotation.id,
            entityType: "Quotation",
          })
        )
      );
    }

    return { success: true, data: { id: quotation.id } };
  } catch (error) {
    console.error("[createQuotation]", error);
    return { error: "errors.serverError" };
  }
}

const updateQuotationSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  customerId: z.string().min(1, "errors.invalidInput"),
  title: z.string().min(1, "errors.invalidInput"),
  items: z.array(createQuotationItemSchema).min(1, "errors.invalidInput"),
});

export async function updateQuotation(
  input: unknown
): Promise<{ success: true; data: { id: string } } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = updateQuotationSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { id, customerId, title, items } = parsed.data;

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: { contract: { select: { id: true } } },
    });
    if (!existing) return { error: "errors.notFound" };

    // Immutability guard (Amr's rule): a signed contract is a source document —
    // its quotation can never be edited. Any change goes through a contract
    // annex / a new quotation (separate feature). Enforced server-side, before
    // any write; hiding the edit UI alone would not be a boundary.
    if (existing.contract) {
      return { error: "errors.quotationHasContract" };
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    // Pricing-audit fix: Decimal end-to-end (zero float).
    const vatPct = existing.taxPct;
    // Pricing-audit fix (discount drop): re-apply the quotation's EXISTING
    // discount when items change. The old code computed total = subtotal + VAT
    // with no discount — silently inflating the total (+23.46% on a 19% quote)
    // while leaving discountPct/discountAmount stale on the row.
    const discountPct = existing.discountPct;
    const lineTotals = items.map((item) => toDec(item.quantity).mul(toDec(item.unitPrice)));
    const subtotal = lineTotals.reduce((sum, lt) => sum.add(lt), new D(0));
    const discountAmount = subtotal.mul(discountPct).div(100);
    const netAfterDiscount = subtotal.sub(discountAmount);
    const taxAmount = netAfterDiscount.mul(vatPct).div(100);
    const total = netAfterDiscount.add(taxAmount);

    const quotation = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          customerId,
          subtotal,
          discountAmount, // kept in lockstep with total (was left stale before)
          taxAmount,
          total,
          items: {
            create: items.map((item, i) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: lineTotals[i],
            })),
          },
        },
      });
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم تحديث عرض السعر "${title}" رقم ${quotation.number}`,
      },
    });

    return { success: true, data: { id: quotation.id } };
  } catch (error) {
    console.error("[updateQuotation]", error);
    return { error: "errors.serverError" };
  }
}

const updateQuotationStatusSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(QuotationStatus),
});

export async function updateQuotationStatus(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = updateQuotationStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { quotationId, status } = parsed.data;

    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return { error: "errors.notFound" };

    await prisma.quotation.update({
      where: { id: quotationId },
      // approvedById يُكتب فقط عند الانتقال إلى APPROVED؛ مغادرة APPROVED لا تمحوه (أثر تاريخي)
      data: {
        status,
        ...(status === "APPROVED" ? { approvedById: roleCheck.userId } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_STATUS",
        entity: "Quotation",
        entityId: quotationId,
        details: `تم تغيير حالة عرض السعر ${quotation.number} من ${quotation.status} إلى ${status}${status === "APPROVED" ? ` — اعتماد بواسطة ${roleCheck.userId}` : ""}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[updateQuotationStatus]", error);
    return { error: "errors.serverError" };
  }
}

const requestFactorApprovalSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  factor: z.coerce.number().positive("errors.invalidInput"),
});

export async function requestFactorApproval(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = requestFactorApprovalSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { quotationId, factor } = parsed.data;

    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return { error: "errors.notFound" };

    await prisma.quotation.update({
      where: { id: quotationId },
      data: { needsApproval: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "REQUEST_FACTOR_APPROVAL",
        entity: "Quotation",
        entityId: quotationId,
        details: `طلب موافقة على فاكتور منخفض (${factor}) لعرض السعر ${quotation.number}`,
      },
    });

    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    await Promise.all(
      adminUsers.map((user) =>
        sendNotification({
          userId: user.id,
          title: "notifications.lowFactorApprovalTitle",
          body: `طلب موافقة على فاكتور منخفض (${factor}) لعرض السعر ${quotation.number}`,
          type: "LOW_FACTOR_APPROVAL_REQUESTED",
          entityId: quotationId,
          entityType: "Quotation",
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error("[requestFactorApproval]", error);
    return { error: "errors.serverError" };
  }
}
