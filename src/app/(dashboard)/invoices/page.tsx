export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { InvoicesClient } from "./invoices-client";

// دفعة هـ (سد انقطاع #2): شاشة إدارة الفواتير — نمط شاشة المستخلصات،
// القراءة هنا، الـ mutations عبر lib/finance/invoices.ts (SCR-015 دفعة 2 الجاهزة).
export default async function InvoicesPage() {
  const roleCheck = await requireRole(["ACCOUNTING", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [invoices, quotations, statements] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        quotation: { select: { number: true } },
        statement: { select: { documentNumber: true } },
      },
    }),
    // مصدر الفاتورة = عرض السعر: مشروعات (له عقد → يُربط تلقائيًا) أو سوشيال (بلا عقد → مباشرة)
    prisma.quotation.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        number: true,
        total: true,
        customer: { select: { name: true } },
        contract: { select: { id: true } },
        quotationRequest: { select: { technicalRoute: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // مستخلصات صادرة قابلة للربط (اختياري، للمشروعات)
    prisma.progressStatement.findMany({
      where: { status: "ISSUED" },
      select: {
        id: true,
        documentNumber: true,
        contractId: true,
        contract: {
          select: { quotation: { select: { id: true, number: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <InvoicesClient
      initialInvoices={invoices.map((i) => ({
        id: i.id,
        documentNumber: i.documentNumber,
        customerName: i.customer.name,
        quotationNumber: i.quotation?.number ?? null,
        statementNumber: i.statement?.documentNumber ?? null,
        totalAmount: i.totalAmount.toNumber(),
        status: i.status,
        issuedAt: i.issuedAt?.toISOString() ?? null,
      }))}
      quotations={quotations.map((q) => ({
        id: q.id,
        label: `${q.customer.name} — ${q.number} (${q.total})`,
        contractId: q.contract?.id ?? null,
        route: q.quotationRequest?.technicalRoute ?? null,
      }))}
      statements={statements.map((s) => ({
        id: s.id,
        label: s.documentNumber ?? s.id,
        quotationId: s.contract.quotation.id,
      }))}
    />
  );
}
