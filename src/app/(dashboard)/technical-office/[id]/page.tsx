export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getTecJobDetail } from "@/lib/services/tec";
import { TecDetailClient } from "./tec-detail-client";

export default async function TecDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // IN-24: كان هنا تعليق يعلّل دخول INSPECTION_MANAGER ببوابة **G2** — وG2 مُلغاة
  // (BL-03/D-05) فالتعليل ساقط، وحُذف كي لا يُبنى عليه لاحقًا. السبب النافذ الآن:
  // القسم يحتاج رسومات المشروع الذي يعاينه، والنطاق (طلبات لها معاينة مرتبطة)
  // يفرضه buildWhere داخل getTecJobDetail.
  // TO-25: TEC_LEAD مضاف — النطاق (طلبات مساره) يفرضه buildWhere كذلك.
  // في الحالتين: طلب خارج النطاق يعود null ⇒ notFound. الوصول ليس الرؤية (TO-23).
  const roleCheck = await requireRole([
    "ADMIN",
    "TECHNICAL_OFFICE",
    "TEC_APPROVER",
    "INSPECTION_MANAGER",
    "TEC_LEAD",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const job = await getTecJobDetail(id, roleCheck.userId, roleCheck.role);
  if (!job) notFound();

  return (
    <TecDetailClient
      job={job}
      currentRole={roleCheck.role}
      currentUserId={roleCheck.userId}
    />
  );
}
