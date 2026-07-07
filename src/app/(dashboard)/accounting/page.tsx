export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getAccountingDashboard } from "../../../../lib/accounting/actions";
import { AccountingClient } from "./accounting-client";

export default async function AccountingPage() {
  const roleCheck = await requireRole(["ADMIN", "ACCOUNTING"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const rows = await getAccountingDashboard();

  return <AccountingClient initialRows={rows} />;
}
