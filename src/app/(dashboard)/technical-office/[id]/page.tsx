export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getTecJobDetail } from "@/lib/services/tec";
import { TecDetailClient } from "./tec-detail-client";

export default async function TecDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // دفعة ب: INSPECTION_MANAGER يدخل لبوابة G2 (تحقق الرسومات)
  // TO-25: TEC_LEAD مضاف — النطاق (طلبات مساره) يفرضه buildWhere داخل getTecJobDetail،
  // فطلب خارج مساره يعود null ⇒ notFound. الوصول ليس الرؤية (نفس نمط TO-23).
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
