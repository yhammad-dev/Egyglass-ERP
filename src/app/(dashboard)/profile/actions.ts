"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { passwordPolicy } from "@/lib/validation/password";
import {
  updateOwnProfile,
  changeOwnPassword,
  InvalidCurrentPasswordError,
  SamePasswordError,
} from "@/lib/services/users";

const profileSchema = z.object({
  name: z.string().min(1, "errors.required"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "errors.required"),
    newPassword: passwordPolicy,
    confirmPassword: z.string().min(1, "errors.required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "errors.passwordMismatch",
    path: ["confirmPassword"],
  });

// BL-136: تحديث الملف الشخصي للمستخدم الحالي. الهدف = معرّف الجلسة حصريًا،
// لا يُقبل أي id من العميل. zod يجرّد أي مفتاح غير name (لا تسرّب role/department).
export async function updateMyProfileAction(data: unknown) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return { success: false as const, error: "errors.notAuthorized" };
  }

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateOwnProfile(auth.userId, { name: parsed.data.name });
    return { success: true as const };
  } catch {
    return { success: false as const, error: "errors.updateFailed" };
  }
}

// BL-136: تغيير كلمة المرور للمستخدم الحالي. يتحقق من الحالية خادميًا قبل التعيين.
// الهدف = معرّف الجلسة حصريًا.
export async function changeMyPasswordAction(data: unknown) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return { success: false as const, error: "errors.notAuthorized" };
  }

  const parsed = passwordSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await changeOwnPassword(
      auth.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    return { success: true as const };
  } catch (e: unknown) {
    if (e instanceof InvalidCurrentPasswordError) {
      return {
        success: false as const,
        error: { currentPassword: ["errors.incorrectPassword"] },
      };
    }
    if (e instanceof SamePasswordError) {
      return {
        success: false as const,
        error: { newPassword: ["errors.passwordSameAsOld"] },
      };
    }
    return { success: false as const, error: "errors.updateFailed" };
  }
}
