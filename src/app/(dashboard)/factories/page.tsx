export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { listFactories } from "@/lib/services/factories";
import { FactoriesClient } from "./factories-client";

// دفعة أ: شاشة إدارة المصانع (PRC-R04)
export default async function FactoriesPage() {
  const roleCheck = await requireRole(["PROCUREMENT", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const factories = await listFactories();

  return (
    <FactoriesClient
      initialFactories={factories.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        contact: f.contact,
        notes: f.notes,
        isActive: f.isActive,
      }))}
    />
  );
}
