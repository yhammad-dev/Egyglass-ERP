export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getInspectionDetail } from "../actions";
import { InspectionDetailClient } from "./inspection-detail-client";

export default async function InspectionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  // تضييق الملكية لـ INSPECTION_REP مفروض داخل getInspectionDetail (assigneeId
  // !== userId → null) — معاينة ليست له تصير 404 لا صفحة.
  const inspection = await getInspectionDetail(id);
  if (!inspection) notFound();

  return <InspectionDetailClient inspection={inspection} currentRole={roleCheck.role} />;
}
