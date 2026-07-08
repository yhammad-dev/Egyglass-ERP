export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) redirect("/dashboard");

  return <ImportClient />;
}
