"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { passwordPolicy } from "@/lib/validation/password";
import {
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  unlockUser,
  getUsers,
  LastAdminGuardError,
} from "@/lib/services/users";

const roleEnum = z.enum([
  "ADMIN", "SALES_MANAGER", "SALES_REP",
  "INSPECTION_MANAGER", "INSPECTION_REP",
  "VIEWER", "REVIEW", "PROCUREMENT",
  "INSTALLATIONS", "ACCOUNTING", "HR",
  "PROJECTS", "TECHNICAL_OFFICE", "TEC_APPROVER",
]);

const departmentEnum = z.enum([
  "EXECUTIVE", "SALES", "INSPECTIONS",
  "TECHNICAL_OFFICE", "PROJECTS",
  "PROCUREMENT", "INSTALLATIONS", "ACCOUNTING", "HR",
]);

// SCR-016: سياسة كلمة المرور موحّدة في @/lib/validation/password (passwordPolicy)

// SCR-016: النطاق المسموح للإنشاء الجديد فقط (forward-looking) — القدامى خارج الفحص
const emailWithDomain = z
  .string()
  .email("errors.emailInvalid")
  .refine(
    (e) => e.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN),
    "errors.emailDomainNotAllowed"
  );

const createSchema = z.object({
  name: z.string().min(1, "errors.required"),
  email: emailWithDomain,
  password: passwordPolicy,
  role: roleEnum,
  department: departmentEnum,
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "errors.required").optional(),
  // النطاق يُفحص فقط إن أُرسل email جديد — تعديل بلا تغيير إيميل يمر (لا يحبس القدامى)
  email: emailWithDomain.optional(),
  password: passwordPolicy.optional(),
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

// SCR-016: فك قفل حساب مقفول تلقائيًا (أدمن فقط)
export async function unlockUserAction(id: string) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) return { success: false as const, error: "errors.notAuthorized" };

  try {
    await unlockUser(id, auth.userId);
    return { success: true as const };
  } catch {
    return { success: false as const, error: "errors.updateFailed" };
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
