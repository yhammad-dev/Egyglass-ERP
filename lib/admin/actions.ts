"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

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

export async function getFactorMinimum(): Promise<number> {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return 1.5;

    const settings = await prisma.systemSettings.findUnique({
      where: { id: "singleton" },
    });
    return settings?.factorMinimum.toNumber() ?? 1.5;
  } catch (error) {
    console.error("[getFactorMinimum]", error);
    return 1.5;
  }
}

const updateFactorMinimumSchema = z.object({
  value: z.coerce.number().positive("errors.invalidInput"),
});

export async function updateFactorMinimum(input: unknown) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateFactorMinimumSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const existing = await prisma.systemSettings.findUnique({
      where: { id: "singleton" },
    });

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: { factorMinimum: parsed.data.value, updatedById: roleCheck.userId },
      create: { id: "singleton", factorMinimum: parsed.data.value, updatedById: roleCheck.userId },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_FACTOR_MINIMUM",
        entity: "SystemSettings",
        entityId: "singleton",
        details: `تم تغيير الحد الأدنى لعامل التسعير من ${
          existing?.factorMinimum ?? "1.50"
        } إلى ${parsed.data.value}`,
      },
    });

    return { success: true as const, value: parsed.data.value };
  } catch (error) {
    console.error("[updateFactorMinimum]", error);
    return { error: "errors.serverError" as const };
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

// Public read — no role check needed (used on print pages)
export async function getCompanySettings() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "singleton" },
      select: { companyName: true, companyLogoUrl: true },
    });
    return {
      companyName: settings?.companyName ?? "EgyGlass",
      companyLogoUrl: settings?.companyLogoUrl ?? null,
    };
  } catch {
    return { companyName: "EgyGlass", companyLogoUrl: null };
  }
}

export async function updateCompanyName(input: unknown) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: { companyName: parsed.data.name, updatedById: roleCheck.userId },
      create: { id: "singleton", companyName: parsed.data.name, updatedById: roleCheck.userId },
    });

    return { success: true as const };
  } catch {
    return { error: "errors.serverError" as const };
  }
}

export async function uploadCompanyLogo(formData: FormData) {
  try {
    const roleCheck = await requireRole(ADMIN_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const file = formData.get("logo") as File;
    if (!file || file.size === 0) return { error: "errors.invalidInput" as const };
    if (file.size > 2 * 1024 * 1024) return { error: "الملف يتجاوز 2 ميغابايت" as const };
    if (!file.type.startsWith("image/")) return { error: "يجب أن يكون الملف صورة" as const };

    const uploadDir = join(process.cwd(), "public", "uploads", "company");
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() ?? "png";
    const filename = `logo-${randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));

    const url = `/uploads/company/${filename}`;

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: { companyLogoUrl: url, updatedById: roleCheck.userId },
      create: { id: "singleton", companyLogoUrl: url, updatedById: roleCheck.userId },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_LOGO",
        entity: "SystemSettings",
        entityId: "singleton",
        details: "تم تحديث لوجو الشركة",
      },
    });

    return { success: true as const, url };
  } catch (error) {
    console.error("[uploadCompanyLogo]", error);
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
