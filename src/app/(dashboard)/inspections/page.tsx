export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getInspections, getCustomers, getAssignableUsers } from "@/lib/services/inspections";
import { InspectionsClient } from "./inspections-client";

export default async function InspectionsPage() {
  // INSPECTION_REP وظيفته تسجيل المعاينات الميدانية — يفتح الشاشة، والنطاق
  // يُضيَّق داخل getInspections (معايناته المسندة فقط). أزرار الجدولة/الإنشاء
  // تبقى محروسة server-side بـ MANAGER_ROLES في actions.ts.
  const roleCheck = await requireRole(["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [inspections, customers, assignableUsers] = await Promise.all([
    getInspections(roleCheck.userId, roleCheck.role),
    getCustomers(),
    getAssignableUsers(),
  ]);

  return (
    <InspectionsClient
      initialInspections={inspections}
      customers={customers}
      currentRole={roleCheck.role}
      assignableUsers={assignableUsers}
    />
  );
}
