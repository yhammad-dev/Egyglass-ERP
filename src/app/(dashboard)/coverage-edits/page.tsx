export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getCoverageEdits } from "../../../../lib/coverage-edits/actions";
import { CoverageEditsClient } from "./coverage-edits-client";

export default async function CoverageEditsPage() {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const rows = await getCoverageEdits();

  return <CoverageEditsClient initialRows={rows} />;
}
