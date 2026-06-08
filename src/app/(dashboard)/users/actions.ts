"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  getUsers,
  LastAdminGuardError,
} from "@/lib/services/users";

const roleEnum = z.enum([
  "ADMIN",
  "SALES_MANAGER",
  "SALES_REP",
  "INSPECTION_MANAGER",
  "VIEWER",
]);

const departmentEnum = z.enum([
  "EXECUTIVE",
  "SALES",
  "INSPECTIONS",
  "TECHNICAL_OFFICE",
  "PROJECTS",
]);

const createSchema = z.object({
  name: z.string().min(1, "errors.required"),
  email: z.string().email("errors.emailInvalid"),
  password: z.string().min(6, "errors.passwordMinLength"),
  role: roleEnum,
  department: departmentEnum,
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "errors.required").optional(),
  email: z.string().email("errors.emailInvalid").optional(),
  password: z
    .string()
    .min(6, "errors.passwordMinLength")
    .optional(),
  role: roleEnum.optional(),
  department: departmentEnum.optional(),
  isActive: z.boolean().optional(),
});

export async function listUsersAction() {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) throw new Error("errors.notAuthorized");

  return getUsers();
}

export async function createUserAction(data: unknown) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) return { success: false as const, error: "errors.notAuthorized" };

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await createUser(parsed.data, auth.userId);
    return { success: true as const, data: user };
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        success: false as const,
        error: { email: ["errors.emailAlreadyUsed"] },
      };
    }
    return { success: false as const, error: "errors.createFailed" };
  }
}

export async function updateUserAction(data: unknown) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) return { success: false as const, error: "errors.notAuthorized" };

  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, ...input } = parsed.data;

  try {
    const user = await updateUser(id, input, auth.userId);
    return { success: true as const, data: user };
  } catch (e: any) {
    if (e instanceof LastAdminGuardError) {
      return { success: false as const, error: e.message };
    }
    if (e?.code === "P2002") {
      return {
        success: false as const,
        error: { email: ["errors.emailAlreadyUsed"] },
      };
    }
    return { success: false as const, error: "errors.updateFailed" };
  }
}

export async function deleteUserAction(id: string) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) return { success: false as const, error: "errors.notAuthorized" };

  try {
    await deleteUser(id, auth.userId);
    return { success: true as const };
  } catch (e: any) {
    if (e instanceof LastAdminGuardError) {
      return { success: false as const, error: e.message };
    }
    return { success: false as const, error: "errors.deleteFailed" };
  }
}

export async function reactivateUserAction(id: string) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) return { success: false as const, error: "errors.notAuthorized" };

  try {
    await reactivateUser(id, auth.userId);
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      error: "errors.reactivateFailed",
    };
  }
}
