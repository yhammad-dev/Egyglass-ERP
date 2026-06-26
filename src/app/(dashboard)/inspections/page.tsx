import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getInspections, getCustomers, getAssignableUsers } from "@/lib/services/inspections";
import { InspectionsClient } from "./inspections-client";

export default async function InspectionsPage() {
  const roleCheck = await requireRole(["ADMIN", "INSPECTION_MANAGER"]);
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
