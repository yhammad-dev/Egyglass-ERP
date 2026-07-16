export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getMfgOrders } from "../../../../lib/manufacturing/actions";
import { ManufacturingClient } from "./manufacturing-client";

export default async function ManufacturingPage() {
  // D-41 (BL-113): REVIEW يدخل القائمة (getMfgOrders يفلترها على UNDER_REVIEW).
  const roleCheck = await requireRole(["ADMIN", "PROCUREMENT", "REVIEW"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const orders = await getMfgOrders();

  // BL-124: الدور خادمي (requireRole أعلاه) — الواجهة تُخفي أداة تغيير الحالة عن REVIEW
  return <ManufacturingClient initialOrders={orders} userRole={roleCheck.role} />;
}
