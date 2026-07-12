export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { getPricingFactors, getProductTypes } from "../../../../../lib/pricing/actions";
import { QuotationBuilder } from "./_components/quotation-builder";

export default async function NewQuotationPage(props: {
  searchParams: Promise<{ customerId?: string; requestId?: string }>;
}) {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "TECHNICAL_OFFICE", "TEC_APPROVER", "REVIEW"]);
  if (!roleCheck.authorized) redirect("/customers");

  const { customerId, requestId } = await props.searchParams;

  const customerWhere: Prisma.CustomerWhereInput = { deletedAt: null };
  if (roleCheck.role === "SALES_REP") {
    customerWhere.OR = [
      { ownerId: roleCheck.userId },
      { coveredById: roleCheck.userId },
    ];
  }

  const [customers, productTypes, pricingFactors, settings] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
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
