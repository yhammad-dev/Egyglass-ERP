export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getTecJobs, getEngineers } from "@/lib/services/tec";
import { TecClient } from "./tec-client";

export default async function TechnicalOfficePage() {
  // TO-25: التيم ليدر يوزّع ⇒ يحتاج الشاشة. النطاق (طلبات مساره فقط) في getTecJobs.
  const roleCheck = await requireRole([
    "ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER", "TEC_LEAD",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [jobs, engineers] = await Promise.all([
    getTecJobs(roleCheck.userId, roleCheck.role),
    // TO-25: قائمة الإسناد مُنطَّقة بالدور — التيم ليدر يرى مهندسيه فقط،
    // والمدير يرى الكل كما كان. القيد النافذ في assignEngineerAction لا هنا.
    getEngineers(roleCheck.userId, roleCheck.role),
  ]);

  return (
    <TecClient
      jobs={jobs}
      engineers={engineers}
      currentRole={roleCheck.role}
    />
  );
}
