import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getInspectionDetail } from "../actions";
import { InspectionDetailClient } from "./inspection-detail-client";

export default async function InspectionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "INSPECTION_MANAGER"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const inspection = await getInspectionDetail(id);
  if (!inspection) notFound();

  return <InspectionDetailClient inspection={inspection} />;
}
