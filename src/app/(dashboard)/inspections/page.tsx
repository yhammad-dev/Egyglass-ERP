export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { Unauthorized } from "@/components/unauthorized";
import { getInspections, getAssignableUsers } from "@/lib/services/inspections";
import { InspectionsClient } from "./inspections-client";

export default async function InspectionsPage() {
  // INSPECTION_REP وظيفته تسجيل المعاينات الميدانية — يفتح الشاشة، والنطاق
  // يُضيَّق داخل getInspections (معايناته المسندة فقط). أزرار الجدولة/الإنشاء
  // تبقى محروسة server-side بـ MANAGER_ROLES في actions.ts.
  const roleCheck = await requireRole(["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"]);
  if (!roleCheck.authorized) return <Unauthorized />;

  // BL-104: لا إنشاء من هذه الشاشة (المدخل = شاشة العميل، D-31) → لا حاجة لقائمة العملاء
  const [inspections, assignableUsers] = await Promise.all([
    getInspections(roleCheck.userId, roleCheck.role),
    getAssignableUsers(),
  ]);

  return (
    <InspectionsClient
      initialInspections={inspections}
      currentRole={roleCheck.role}
      assignableUsers={assignableUsers}
    />
  );
}
