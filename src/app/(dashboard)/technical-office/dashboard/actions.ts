"use server";

import { requireRole } from "@/lib/rbac";
import {
  getTecDashboard,
  TEC_DASHBOARD_ROLES,
  type TecDashboardData,
} from "@/lib/services/tec-dashboard";

/**
 * 🔴 BL-143 — `requireRole` **داخل الأكشن** لا على الصفحة وحدها. أكشن
 * `"use server"` نقطة شبكة قابلة للاستدعاء بـPOST مباشرةً بمعرفة الـaction id،
 * فحارس الصفحة لا يحميه. والنطاق يُشتق من **الجلسة** لا من وسيط يرسله العميل.
 */
export async function getTecDashboardAction(filters?: {
  route?: string;
  days?: number;
}): Promise<TecDashboardData | { error: string }> {
  try {
    const auth = await requireRole([...TEC_DASHBOARD_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" };

    return await getTecDashboard(auth.userId, auth.role, filters);
  } catch (error) {
    console.error("[getTecDashboardAction]", error);
    return { error: "errors.serverError" };
  }
}
