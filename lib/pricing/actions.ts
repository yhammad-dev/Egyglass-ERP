"use server";

import { z } from "zod";
import { QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { calculateRecipe } from "./calculateRecipe";
import { sendNotification } from "../notifications/send";

const PRICING_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];
// RR-2: the low-factor floor is no longer hardcoded. It is read from
// SystemSettings.factorMinimum (SCR-008) and enforced server-side below.
const FACTOR_MINIMUM_FALLBACK = 1.5;

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
    const settings = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
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
});

export async function createQuotation(
  input: unknown
): Promise<{ success: true; data: { id: string } } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = createQuotationSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { customerId, title, items, needsApproval, pricingFactor } = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    const settings = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
    const validDays = settings?.quotationValidDays ?? 3;
    const vatPct = settings?.vatPct.toNumber() ?? 14;

    // RR-2/STEP-4: totals are ALWAYS re-derived server-side from the line items and
    // the VAT rate in SystemSettings. No client-supplied subtotal/total is accepted
    // (the input schema does not expose those fields).
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = (subtotal * vatPct) / 100;
    const total = subtotal + taxAmount;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const count = await prisma.quotation.count();
    const number = `Q-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const quotation = await prisma.quotation.create({
      data: {
        number,
        customerId,
        createdById: roleCheck.userId,
        subtotal,
        taxPct: vatPct,
        taxAmount,
        total,
        validUntil,
        needsApproval: needsApproval ?? false,
        ...(needsApproval ? { status: "PENDING_APPROVAL" as const } : {}),
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "CREATE",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم إنشاء عرض سعر "${title}" للعميل ${customer.name} برقم ${number}`,
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

    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) return { error: "errors.notFound" };

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    const vatPct = existing.taxPct.toNumber();
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = (subtotal * vatPct) / 100;
    const total = subtotal + taxAmount;

    const quotation = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          customerId,
          subtotal,
          taxAmount,
          total,
          items: {
            create: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
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
      data: { status },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_STATUS",
        entity: "Quotation",
        entityId: quotationId,
        details: `تم تغيير حالة عرض السعر ${quotation.number} من ${quotation.status} إلى ${status}`,
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
