export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { getPricingFactors, getProductTypes } from "../../../../../lib/pricing/actions";
import { QuotationBuilder } from "./_components/quotation-builder";

export default async function NewQuotationPage(props: {
  searchParams: Promise<{ customerId?: string; requestId?: string }>;
}) {
  // BL-127 (D-03/W-01): الحارس = PRICING_ROLES بالضبط (lib/pricing/actions.ts:17).
  // REVIEW أُزيل — رقابة وجودة لا تسعير، وكل طفرات التسعير تستبعده أصلًا (حارس يتيم).
  // المصفوفة صريحة لأن PRICING_ROLES يستحيل تصديره: الملف "use server" ⇒ لا يُصدَّر إلا async.
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "TECHNICAL_OFFICE", "TEC_APPROVER"]);
  if (!roleCheck.authorized) redirect("/customers");

  const { customerId, requestId } = await props.searchParams;

  const [customers, productTypes, pricingFactors, settings] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    getProductTypes(),
    getPricingFactors(),
    getSystemSettings(),
  ]);

  return (
    <QuotationBuilder
      customers={customers}
      productTypes={productTypes}
      pricingFactors={pricingFactors.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value.toNumber(),
      }))}
      initialCustomerId={customerId}
      quotationRequestId={requestId}
      discountBasePct={settings?.discountBasePct.toNumber() ?? 18}
    />
  );
}
