"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  createFactory,
  updateFactory,
  setFactoryActive,
  FactoryError,
} from "@/lib/services/factories";

// دفعة أ: actions المصانع المحروسة — المنطق في services/factories.ts
const FACTORY_ROLES = ["PROCUREMENT", "ADMIN"];

const factorySchema = z.object({
  name: z.string().min(1, "errors.required"),
  code: z.string().min(1, "errors.required"),
  contact: z.string().optional(),
  notes: z.string().optional(),
});

export async function createFactoryAction(input: unknown) {
  try {
    const roleCheck = await requireRole(FACTORY_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = factorySchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const factory = await createFactory(parsed.data, roleCheck.userId);
    return { success: true as const, id: factory.id };
  } catch (e) {
    if (e instanceof FactoryError) return { error: e.message };
    console.error("[createFactoryAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const updateFactorySchema = factorySchema.partial().extend({
  id: z.string().min(1, "errors.invalidInput"),
});

export async function updateFactoryAction(input: unknown) {
  try {
    const roleCheck = await requireRole(FACTORY_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateFactorySchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, ...data } = parsed.data;
    await updateFactory(id, data, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof FactoryError) return { error: e.message };
    console.error("[updateFactoryAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const toggleFactorySchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  isActive: z.boolean(),
});

export async function setFactoryActiveAction(input: unknown) {
  try {
    const roleCheck = await requireRole(FACTORY_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = toggleFactorySchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await setFactoryActive(parsed.data.id, parsed.data.isActive, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    console.error("[setFactoryActiveAction]", e);
    return { error: "errors.serverError" as const };
  }
}
