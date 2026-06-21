"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { createCustomer, updateCustomer } from "@/lib/services/customers";

const customerTypeEnum = z.enum(["INDIVIDUAL", "ENGINEER", "COMPANY"]);
const customerSourceEnum = z.enum(["AD", "REFERRAL", "WHATSAPP", "EXHIBITION", "VISIT"]);

const createSchema = z.object({
  name: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  altPhone: z.string().optional(),
  type: customerTypeEnum,
  source: customerSourceEnum,
  address: z.string().optional(),
  notes: z.string().optional(),
  isRepeat: z.boolean(),
  ownerId: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "errors.required").optional(),
  phone: z.string().min(1, "errors.required").optional(),
  altPhone: z.string().optional(),
  type: customerTypeEnum.optional(),
  source: customerSourceEnum.optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isRepeat: z.boolean().optional(),
  ownerId: z.string().optional(),
});

const ALLOWED_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];

export async function createCustomerAction(data: unknown) {
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

  if (auth.role === "SALES_REP") {
    parsed.data.ownerId = auth.userId;
  }

  try {
    const customer = await createCustomer(parsed.data, auth.userId);
    return { success: true as const, data: customer };
  } catch {
    return { success: false as const, error: "errors.createFailed" };
  }
}

export async function updateCustomerAction(data: unknown) {
  const auth = await requireRole(ALLOWED_ROLES);
  if (!auth.authorized)
    return { success: false as const, error: "errors.notAuthorized" };

  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, ...input } = parsed.data;

  if (auth.role === "SALES_REP") {
    delete (input as any).ownerId;
  }

  try {
    const customer = await updateCustomer(id, input, auth.userId);
    return { success: true as const, data: customer };
  } catch {
    return { success: false as const, error: "errors.updateFailed" };
  }
}
