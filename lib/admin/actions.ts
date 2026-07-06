"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const ADMIN_ROLES = ["ADMIN"];

export async function getMaterials() {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return [];

    const materials = await prisma.material.findMany({
      orderBy: { code: "asc" },
    });

    return materials.map((m) => ({
      id: m.id,
      code: m.code,
      nameAr: m.nameAr,
      category: m.category,
      unit: m.unit,
      cost: m.cost.toNumber(),
      isActive: m.isActive,
    }));
  } catch (error) {
    console.error("[getMaterials]", error);
    return [];
  }
}

export async function getPricingFactors() {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return [];

    const factors = await prisma.pricingFactor.findMany({
      orderBy: { label: "asc" },
    });

    return factors.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value.toNumber(),
      isActive: f.isActive,
    }));
  } catch (error) {
    console.error("[getPricingFactors]", error);
    return [];
  }
}

const updateMaterialCostSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  cost: z.coerce.number().nonnegative("errors.invalidInput"),
});

export async function updateMaterialCost(input: unknown) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateMaterialCostSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const material = await prisma.material.findUnique({
      where: { id: parsed.data.id },
    });
    if (!material) return { error: "errors.notFound" as const };

    await prisma.material.update({
      where: { id: parsed.data.id },
      data: { cost: parsed.data.cost },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_COST",
        entity: "Material",
        entityId: material.id,
        details: `تم تغيير تكلفة الخامة ${material.nameAr} من ${material.cost} إلى ${parsed.data.cost}`,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[updateMaterialCost]", error);
    return { error: "errors.serverError" as const };
  }
}

const idSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
});

export async function toggleMaterialActive(input: unknown) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const material = await prisma.material.findUnique({
      where: { id: parsed.data.id },
    });
    if (!material) return { error: "errors.notFound" as const };

    const updated = await prisma.material.update({
      where: { id: parsed.data.id },
      data: { isActive: !material.isActive },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "TOGGLE_ACTIVE",
        entity: "Material",
        entityId: material.id,
        details: `تم تغيير حالة تفعيل الخامة ${material.nameAr} إلى ${updated.isActive ? "مفعل" : "غير مفعل"}`,
      },
    });

    return { success: true as const, isActive: updated.isActive };
  } catch (error) {
    console.error("[toggleMaterialActive]", error);
    return { error: "errors.serverError" as const };
  }
}

export async function togglePricingFactorActive(input: unknown) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const factor = await prisma.pricingFactor.findUnique({
      where: { id: parsed.data.id },
    });
    if (!factor) return { error: "errors.notFound" as const };

    const updated = await prisma.pricingFactor.update({
      where: { id: parsed.data.id },
      data: { isActive: !factor.isActive },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "TOGGLE_ACTIVE",
        entity: "PricingFactor",
        entityId: factor.id,
        details: `تم تغيير حالة تفعيل عامل التسعير ${factor.label} إلى ${updated.isActive ? "مفعل" : "غير مفعل"}`,
      },
    });

    return { success: true as const, isActive: updated.isActive };
  } catch (error) {
    console.error("[togglePricingFactorActive]", error);
    return { error: "errors.serverError" as const };
  }
}
