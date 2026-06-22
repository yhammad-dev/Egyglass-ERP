import { requireRole } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { getCustomerById } from "@/lib/services/customers";
import { CustomerProfileClient } from "./customer-profile-client";

export default async function CustomerProfilePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await props.params;

  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const customer = await getCustomerById(
    id,
    roleCheck.userId,
    roleCheck.role
  );
  if (!customer) notFound();

  return (
    <CustomerProfileClient customer={customer} currentRole={roleCheck.role} />
  );
}
