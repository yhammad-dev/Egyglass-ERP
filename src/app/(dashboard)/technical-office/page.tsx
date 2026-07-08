export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getTecJobs, getEngineers } from "@/lib/services/tec";
import { TecClient } from "./tec-client";

export default async function TechnicalOfficePage() {
  const roleCheck = await requireRole(["ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [jobs, engineers] = await Promise.all([
    getTecJobs(roleCheck.userId, roleCheck.role),
    getEngineers(),
  ]);

  return (
    <TecClient
      jobs={jobs}
      engineers={engineers}
      currentRole={roleCheck.role}
    />
  );
}
