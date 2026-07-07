export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ContractForm } from "./_components/contract-form";

export default async function ContractPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      contract: true,
    },
  });

  if (!quotation) notFound();

  if (quotation.reviewStatus !== "APPROVED") redirect(`/quotations/${id}`);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">إنشاء عقد</h1>
        <p className="text-sm text-muted-foreground mt-1">
          عرض السعر: {quotation.number} — {quotation.customer.name}
        </p>
      </div>
      <ContractForm
        quotationId={id}
        customerId={quotation.customer.id}
        existingContract={
          quotation.contract
            ? {
                signedAt: quotation.contract.signedAt?.toISOString() ?? null,
                notes: quotation.contract.notes ?? "",
              }
            : null
        }
      />
    </div>
  );
}
