export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getTecDashboard, TEC_DASHBOARD_ROLES } from "@/lib/services/tec-dashboard";
import { TecDashboardClient } from "./dashboard-client";

export default async function TecDashboardPage() {
  // الحارس هنا **وداخل الأكشن معًا** (BL-143) — هذا يمنع فتح الصفحة، وذاك يمنع
  // استدعاء الأكشن مباشرةً بتجاوزها.
  const roleCheck = await requireRole([...TEC_DASHBOARD_ROLES]);
  if (!roleCheck.authorized) redirect("/dashboard");

  // التحميل الأول server-side (بلا وميض شاشة فارغة)؛ الفلاتر بعده تمرّ بالأكشن.
  const data = await getTecDashboard(roleCheck.userId, roleCheck.role);

  return (
    <TecDashboardClient
      initialData={data}
      currentRole={roleCheck.role}
    />
  );
}
