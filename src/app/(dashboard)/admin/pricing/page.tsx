import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getMaterials, getPricingFactors } from "../../../../../lib/admin/actions";
import { PricingCatalogClient } from "./pricing-catalog-client";

export default async function AdminPricingPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [materials, pricingFactors] = await Promise.all([
    getMaterials(),
    getPricingFactors(),
  ]);

  return (
    <PricingCatalogClient
      initialMaterials={materials}
      initialPricingFactors={pricingFactors}
    />
  );
}
