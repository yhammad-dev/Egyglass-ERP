export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getMaterials,
  getPricingFactors,
  getFactorMinimum,
  getCompanySettings,
  getDiscountSettings,
  getSystemConfig,
} from "../../../../../lib/admin/actions";
import { PricingCatalogClient } from "./pricing-catalog-client";
import { CompanySettingsPanel } from "../../../../components/company-settings-panel";
import { SystemSettingsPanel } from "./system-settings-panel";

export default async function AdminPricingPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [materials, pricingFactors, factorMinimum, companySettings, discountSettings, systemConfig] =
    await Promise.all([
      getMaterials(),
      getPricingFactors(),
      getFactorMinimum(),
      getCompanySettings(),
      getDiscountSettings(),
      getSystemConfig(),
    ]);

  return (
    <div className="space-y-6 p-6">
      <CompanySettingsPanel
        initialName={companySettings.companyName}
        initialLogoUrl={companySettings.companyLogoUrl}
      />
      <PricingCatalogClient
        initialMaterials={materials ?? []}
        initialPricingFactors={pricingFactors ?? []}
        initialFactorMinimum={factorMinimum}
        initialDiscountBasePct={discountSettings.basePct}
        initialDiscountMaxReqPct={discountSettings.maxPct}
      />
      {systemConfig && <SystemSettingsPanel initial={systemConfig} />}
    </div>
  );
}
