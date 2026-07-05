import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { QuotationDetail } from "./_components/quotation-detail";

export default async function QuotationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  if (!quotation) notFound();

  return (
    <QuotationDetail
      quotation={{
        id: quotation.id,
        number: quotation.number,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        validUntil: quotation.validUntil.toISOString(),
        subtotal: quotation.subtotal.toNumber(),
        taxPct: quotation.taxPct.toNumber(),
        taxAmount: quotation.taxAmount.toNumber(),
        total: quotation.total.toNumber(),
        customer: quotation.customer,
        createdBy: quotation.createdBy,
        items: quotation.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          lineTotal: item.lineTotal.toNumber(),
        })),
      }}
      currentRole={roleCheck.role}
    />
  );
}
