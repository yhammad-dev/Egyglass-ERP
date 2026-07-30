export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getInspectionDetail } from "../actions";
import { InspectionDetailClient } from "./inspection-detail-client";

export default async function InspectionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // IN-49 (D-IN-12): المبيعات والمكتب الفني يقرأان — **قراءة فقط**. الحارس هنا
  // للوصول، والنطاق لكل دور (ملكية العميل للمبيعات · نطاق buildWhere للمكتب الفني ·
  // الإسناد للمندوب) مفروض داخل getInspectionDetail: خارج النطاق ⇒ null ⇒ 404.
  // صلاحية الكتابة تصل من الخادم في `inspection.canWrite` لا من هذه القائمة.
  const roleCheck = await requireRole([
    "ADMIN",
    "INSPECTION_MANAGER",
    "INSPECTION_REP",
    "SALES_REP",
    "SALES_MANAGER",
    "TECHNICAL_OFFICE",
    "TEC_LEAD",
    "TEC_APPROVER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const inspection = await getInspectionDetail(id);
  if (!inspection) notFound();

  return <InspectionDetailClient inspection={inspection} currentRole={roleCheck.role} />;
}
