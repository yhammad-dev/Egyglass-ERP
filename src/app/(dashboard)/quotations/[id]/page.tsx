export const dynamic = "force-dynamic";
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

  const [quotation, discountRequest, settings] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.discountRequest.findFirst({
      where: { quotationId: id, status: "PENDING" },
      select: { id: true, requestedPct: true, reason: true, createdAt: true },
    }),
    prisma.systemSettings.findUnique({
      where: { id: "singleton" },
      select: { discountMaxReqPct: true },
    }),
  ]);

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
      discountRequest={
        discountRequest
          ? {
              id: discountRequest.id,
              requestedPct: discountRequest.requestedPct.toNumber(),
              reason: discountRequest.reason,
              createdAt: discountRequest.createdAt.toISOString(),
            }
          : null
      }
      discountMaxReqPct={settings?.discountMaxReqPct.toNumber() ?? 25}
    />
  );
}
