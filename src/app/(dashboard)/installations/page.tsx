import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getInstallationOrders,
  getInstallationTeamLeads,
} from "../../../../lib/installations/actions";
import { InstallationsClient } from "./installations-client";

export default async function InstallationsPage() {
  const roleCheck = await requireRole(["ADMIN", "INSTALLATIONS"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [orders, teamLeads] = await Promise.all([
    getInstallationOrders(),
    getInstallationTeamLeads(),
  ]);

  return <InstallationsClient initialOrders={orders} teamLeads={teamLeads} />;
}
