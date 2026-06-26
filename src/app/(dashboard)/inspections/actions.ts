"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { createInspection, scheduleInspection } from "@/lib/services/inspections";

const locationEnum = z.enum(["INSIDE_CAIRO", "OUTSIDE_CAIRO"]);
const typeEnum = z.enum(["PRICING", "EXECUTION"]);

const createSchema = z.object({
  customerId: z.string().min(1, "errors.required"),
  location: locationEnum,
  address: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  type: typeEnum,
  notes: z.string().optional(),
});

const ALLOWED_ROLES = ["ADMIN", "INSPECTION_MANAGER"];

const scheduleSchema = z.object({
  id: z.string().min(1, "errors.required"),
  scheduledAt: z.string().min(1, "errors.required"),
  assigneeId: z.string().min(1, "errors.required"),
});

export async function scheduleInspectionAction(data: unknown) {
  const auth = await requireRole(ALLOWED_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = scheduleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const inspection = await scheduleInspection(
      parsed.data.id,
      new Date(parsed.data.scheduledAt),
      parsed.data.assigneeId,
      auth.userId
    );
    return { success: true as const, data: inspection };
  } catch {
    return { success: false as const, error: "errors.updateFailed" };
  }
}

export async function createInspectionAction(data: unknown) {
  const auth = await requireRole(ALLOWED_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const inspection = await createInspection(parsed.data, auth.userId);
    return { success: true as const, data: inspection };
  } catch {
    return { success: false as const, error: "errors.createFailed" };
  }
}
