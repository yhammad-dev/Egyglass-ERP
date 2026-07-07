export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getCustomers, getSalesReps } from "@/lib/services/customers";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [customers, salesReps] = await Promise.all([
    getCustomers(roleCheck.userId, roleCheck.role),
    getSalesReps(),
  ]);

  return (
    <CustomersClient
      initialCustomers={customers}
      salesReps={salesReps}
      currentRole={roleCheck.role}
    />
  );
}
