export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getQuotations } from "@/lib/services/quotations";
import { QuotationsClient } from "./quotations-client";

export default async function QuotationsPage() {
  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotations = await getQuotations(roleCheck.userId, roleCheck.role);

  return (
    <QuotationsClient
      initialQuotations={quotations}
      currentRole={roleCheck.role}
    />
  );
}
