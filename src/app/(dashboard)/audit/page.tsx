export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getAuditLogs, getAuditFilterOptions } from "../../../../lib/audit/actions";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [initialResult, filterOptions] = await Promise.all([
    getAuditLogs({}, 1),
    getAuditFilterOptions(),
  ]);

  return (
    <AuditClient
      initialResult={initialResult}
      users={filterOptions.users}
      entityTypes={filterOptions.entityTypes}
    />
  );
}
