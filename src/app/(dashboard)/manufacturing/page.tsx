export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getMfgOrders } from "../../../../lib/manufacturing/actions";
import { ManufacturingClient } from "./manufacturing-client";

export default async function ManufacturingPage() {
  const roleCheck = await requireRole(["ADMIN", "PROCUREMENT"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const orders = await getMfgOrders();

  return <ManufacturingClient initialOrders={orders} />;
}
