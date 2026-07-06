import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getMaterials,
  getPricingFactors,
  getFactorMinimum,
} from "../../../../../lib/admin/actions";
import { PricingCatalogClient } from "./pricing-catalog-client";

export default async function AdminPricingPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [materials, pricingFactors, factorMinimum] = await Promise.all([
    getMaterials(),
    getPricingFactors(),
    getFactorMinimum(),
  ]);

  const safeMaterials = materials ?? [];
  const safePricingFactors = pricingFactors ?? [];

  return (
    <PricingCatalogClient
      initialMaterials={safeMaterials}
      initialPricingFactors={safePricingFactors}
      initialFactorMinimum={factorMinimum}
    />
  );
}
