export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPricingFactors, getProductTypes } from "../../../../../../lib/pricing/actions";
import { QuotationBuilder } from "../../new/_components/quotation-builder";

export default async function EditQuotationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [quotation, customers, productTypes, pricingFactors] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    }),
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    getProductTypes(),
    getPricingFactors(),
  ]);

  if (!quotation) notFound();

  return (
    <QuotationBuilder
      mode="edit"
      quotationId={quotation.id}
      initialCustomerId={quotation.customerId}
      initialTitle={quotation.number}
      initialItems={quotation.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
      }))}
      customers={customers}
      productTypes={productTypes}
      pricingFactors={pricingFactors.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value.toNumber(),
      }))}
    />
  );
}
