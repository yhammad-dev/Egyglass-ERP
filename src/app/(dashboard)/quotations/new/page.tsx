export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPricingFactors, getProductTypes } from "../../../../../lib/pricing/actions";
import { QuotationBuilder } from "./_components/quotation-builder";

export default async function NewQuotationPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const { customerId } = await props.searchParams;

  const [customers, productTypes, pricingFactors] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    getProductTypes(),
    getPricingFactors(),
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
    />
  );
}
