"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { createInspection } from "@/lib/services/inspections";

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
