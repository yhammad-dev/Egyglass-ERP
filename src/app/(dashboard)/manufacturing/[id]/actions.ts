"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  addExtraItem,
  confirmExtraItem,
  setExtraItemCost,
  ExtraItemError,
} from "@/lib/services/extra-items";
import {
  submitForReview,
  approveOrder,
  rejectOrder,
  MfgReviewError,
} from "@/lib/services/mfg-review";

// دفعة أ — W-04: الحراسة لكل ضلع من الدورة الثلاثية بدوره الصحيح
const EXTRA_ITEM_TYPES = [
  "CHAMFER",
  "WELDING",
  "EXTRA_ACCESSORY",
  "OUT_OF_CAIRO_TRANSPORT",
  "SANDING",
] as const;

const addSchema = z.object({
  manufacturingOrderId: z.string().min(1, "errors.invalidInput"),
  type: z.enum(EXTRA_ITEM_TYPES),
  description: z.string().max(500).optional(),
  qty: z.coerce.number().positive("errors.invalidInput").optional(),
});

/** TEC ينشئ — المواصفة ملك المكتب الفني حصريًا (PRC ليس ضمن الأدوار عمدًا) */
export async function addExtraItemAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["TECHNICAL_OFFICE", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = addSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const item = await addExtraItem(parsed.data, roleCheck.userId);
    return { success: true as const, id: item.id };
  } catch (e) {
    if (e instanceof ExtraItemError) return { error: e.message };
    console.error("[addExtraItemAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const confirmSchema = z.object({ id: z.string().min(1, "errors.invalidInput") });

/** INS يؤكد المقاسات */
export async function confirmExtraItemAction(input: unknown) {
  try {
    const roleCheck = await requireRole([
      "INSPECTION_MANAGER",
      "INSPECTION_REP",
      "ADMIN",
    ]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = confirmSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await confirmExtraItem(parsed.data.id, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof ExtraItemError) return { error: e.message };
    console.error("[confirmExtraItemAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const costSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  unitCost: z.coerce.number().nonnegative("errors.invalidInput"),
});

// ── بوابة المراجعة (PRC-R02/R03/R04) ──

const orderIdSchema = z.object({ id: z.string().min(1, "errors.invalidInput") });

/** PRC/TEC يقدّمان للمراجعة (من PENDING أو REJECTED بعد التصحيح) */
export async function submitForReviewAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["PROCUREMENT", "TECHNICAL_OFFICE", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = orderIdSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await submitForReview(parsed.data.id, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof MfgReviewError) return { error: e.message };
    console.error("[submitForReviewAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const approveSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  factoryId: z.string().min(1, "errors.invalidInput"),
  expectedAt: z.coerce.date(),
});

/** الموافقة = مدير المعاينات (إجابة شكري BRD-11) — مع مصنع نشط وتاريخ متوقع */
export async function approveOrderAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["INSPECTION_MANAGER", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await approveOrder(
      parsed.data.id,
      parsed.data.factoryId,
      parsed.data.expectedAt,
      roleCheck.userId
    );
    return { success: true as const };
  } catch (e) {
    if (e instanceof MfgReviewError) return { error: e.message };
    console.error("[approveOrderAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const rejectSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().min(1, "errors.rejectReasonRequired"),
});

export async function rejectOrderAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["INSPECTION_MANAGER", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.rejectReasonRequired" as const };

    await rejectOrder(parsed.data.id, parsed.data.reason, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof MfgReviewError) return { error: e.message };
    console.error("[rejectOrderAction]", e);
    return { error: "errors.serverError" as const };
  }
}

/** PRC يُدخل التكلفة فقط — الـ schema لا يقبل نوعًا/وصفًا/كمية أصلًا (W-04) */
export async function setExtraItemCostAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["PROCUREMENT", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = costSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await setExtraItemCost(parsed.data.id, parsed.data.unitCost, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof ExtraItemError) return { error: e.message };
    console.error("[setExtraItemCostAction]", e);
    return { error: "errors.serverError" as const };
  }
}
