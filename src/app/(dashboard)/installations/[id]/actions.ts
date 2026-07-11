"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  addInstallationItem,
  addInstallationPhoto,
  InstallationExtrasError,
} from "@/lib/services/installation-extras";

// دفعة ج — الحراسة: الدور هنا، وقيادة الفريق على الأمر تُفرض في الـ service
const ITEM_TYPES = [
  "BREAKAGE_REPLACEMENT",
  "MFG_ERROR",
  "TEC_ERROR",
  "MEASUREMENT_ERROR",
  "CLIENT_DELAY",
  "OTHER",
] as const;

const addItemSchema = z.object({
  installationOrderId: z.string().min(1, "errors.invalidInput"),
  type: z.enum(ITEM_TYPES),
  description: z.string().max(500).optional(),
  quantity: z.coerce.number().positive("errors.invalidInput").optional(),
  cost: z.coerce.number().nonnegative("errors.invalidInput").optional(),
});

export async function addInstallationItemAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["INSTALLATIONS", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = addItemSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { item, replacementOrderId } = await addInstallationItem(
      parsed.data,
      roleCheck.userId,
      roleCheck.role
    );
    return { success: true as const, id: item.id, replacementOrderId };
  } catch (e) {
    if (e instanceof InstallationExtrasError) return { error: e.message };
    console.error("[addInstallationItemAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const addPhotoSchema = z.object({
  installationOrderId: z.string().min(1, "errors.invalidInput"),
  url: z.string().min(1, "errors.invalidInput"),
  caption: z.string().max(300).optional(),
});

export async function addInstallationPhotoAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["INSTALLATIONS", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = addPhotoSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const photo = await addInstallationPhoto(parsed.data, roleCheck.userId, roleCheck.role);
    return { success: true as const, id: photo.id };
  } catch (e) {
    if (e instanceof InstallationExtrasError) return { error: e.message };
    console.error("[addInstallationPhotoAction]", e);
    return { error: "errors.serverError" as const };
  }
}
