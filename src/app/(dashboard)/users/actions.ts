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
  isValidTeamLead,
  LastAdminGuardError,
} from "@/lib/services/users";

const roleEnum = z.enum([
  "ADMIN", "SALES_MANAGER", "SALES_REP",
  "INSPECTION_MANAGER", "INSPECTION_REP",
  "VIEWER", "REVIEW", "PROCUREMENT",
  "INSTALLATIONS", "ACCOUNTING", "HR",
  "PROJECTS", "TECHNICAL_OFFICE", "TEC_APPROVER",
  "TEC_LEAD",
]);

// TO-23-B: قيم `enum TechnicalRoute` (prisma/schema.prisma:1182-1185) — لا قيم مخترعة.
// `errorMap` عمدًا: رسالة zod الافتراضية نص إنجليزي خام ("Invalid enum value…")،
// والواجهة تمرّر رسالة الخطأ إلى `t()` ⇒ نص غير قابل للترجمة يظهر للمستخدم.
// (نفس العيب قائم في roleEnum/departmentEnum — سابق لهذه الموجة ولم أمسّهما.)
const leadRouteEnum = z.enum(["PROJECTS", "SOCIAL_MEDIA"], {
  errorMap: () => ({ message: "errors.leadRouteRequired" }),
});

/**
 * TO-23-B — تحقق مشترك: `TEC_LEAD` بلا مسار = حساب **معطوب بنيويًا**، يُنشأ بنجاح
 * ثم لا يرى أي عرض إطلاقًا (فشل TO-23 المغلق المقصود في `getQuotations`).
 * الرفض هنا أصدق من إنشاء صامت لمستخدم لا يعمل.
 * ملاحظة: في التعديل قد يكون `role` غير مُرسَل ⇒ لا حكم (لا نفترض دورًا لم يُطلب تغييره).
 */
function refineLeadRoute(
  value: { role?: string; leadRoute?: string | null },
  ctx: z.RefinementCtx
) {
  if (value.role === "TEC_LEAD" && !value.leadRoute) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leadRoute"],
      message: "errors.leadRouteRequired",
    });
  }
}

/**
 * التطبيع: المسار يُحفظ **فقط** مع TEC_LEAD. أي دور آخر ⇒ `null` صريحة تمسح أي
 * قيمة قديمة. `undefined` (دور لم يُرسَل في التعديل) ⇒ لا نلمس العمود أصلًا.
 */
function normalizeLeadRoute(
  role: string | undefined,
  leadRoute: string | null | undefined
): string | null | undefined {
  if (role === undefined) return leadRoute;
  return role === "TEC_LEAD" ? (leadRoute ?? null) : null;
}

/**
 * TO-25 — نفس القاعدة لارتباط التيم ليدر: يُحفظ **فقط** مع TECHNICAL_OFFICE.
 * ⚠️ خلافًا لـ`leadRoute`، هذا الحقل **اختياري** حتى للمهندس: مهندس بلا تيم ليدر
 * حالة صالحة (يظل مرئيًا للمدير الذي يرى كل المهندسين) ⇒ لا تحقق إلزامي عليه.
 */
function normalizeTeamLeadId(
  role: string | undefined,
  teamLeadId: string | null | undefined
): string | null | undefined {
  if (role === undefined) return teamLeadId;
  return role === "TECHNICAL_OFFICE" ? (teamLeadId ?? null) : null;
}

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

const createSchema = z
  .object({
    name: z.string().min(1, "errors.required"),
    email: emailWithDomain,
    password: passwordPolicy,
    role: roleEnum,
    department: departmentEnum,
    leadRoute: leadRouteEnum.nullish(),
    // TO-25: معرّف التيم ليدر — وجوده الفعلي ودوره يُفحصان في `assertTeamLeadValid`
    // (فحص قاعدة، لا يُنجزه zod).
    teamLeadId: z.string().min(1).nullish(),
  })
  .superRefine(refineLeadRoute);

const updateSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, "errors.required").optional(),
    // النطاق يُفحص فقط إن أُرسل email جديد — تعديل بلا تغيير إيميل يمر (لا يحبس القدامى)
    email: emailWithDomain.optional(),
    password: passwordPolicy.optional(),
    role: roleEnum.optional(),
    department: departmentEnum.optional(),
    isActive: z.boolean().optional(),
    leadRoute: leadRouteEnum.nullish(),
    // TO-25: معرّف التيم ليدر — وجوده الفعلي ودوره يُفحصان في `assertTeamLeadValid`
    // (فحص قاعدة، لا يُنجزه zod).
    teamLeadId: z.string().min(1).nullish(),
  })
  .superRefine(refineLeadRoute);

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

  // TO-25: فحص واقع التيم ليدر (لا شكله) — بعد التطبيع كي لا نفحص قيمة ستُمسح.
  const teamLeadId = normalizeTeamLeadId(parsed.data.role, parsed.data.teamLeadId);
  if (!(await isValidTeamLead(teamLeadId))) {
    return { success: false as const, error: { teamLeadId: ["errors.invalidTeamLead"] } };
  }

  try {
    const user = await createUser(
      // TO-23-B: التطبيع server-side — لا نثق بما ترسله الواجهة عن ارتباط الدور بالمسار.
      {
        ...parsed.data,
        leadRoute: normalizeLeadRoute(parsed.data.role, parsed.data.leadRoute),
        teamLeadId,
      },
      auth.userId
    );
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

  // TO-25: نفس فحص الإنشاء. + منع الارتباط الذاتي (مستخدم تيم ليدر نفسه) الذي
  // ينتج حلقة بلا معنى في شجرة الفريق.
  const teamLeadId = normalizeTeamLeadId(input.role, input.teamLeadId);
  if (teamLeadId === id) {
    return { success: false as const, error: { teamLeadId: ["errors.invalidTeamLead"] } };
  }
  if (!(await isValidTeamLead(teamLeadId))) {
    return { success: false as const, error: { teamLeadId: ["errors.invalidTeamLead"] } };
  }

  try {
    const user = await updateUser(
      id,
      // TO-23-B: مغادرة دور TEC_LEAD تمسح المسار (null صريحة) — لا قيمة يتيمة تبقى.
      { ...input, leadRoute: normalizeLeadRoute(input.role, input.leadRoute), teamLeadId },
      auth.userId
    );
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
