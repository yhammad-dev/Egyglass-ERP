export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ApprovalsClient } from "./approvals-client";

// BL-74 (PHASE E): شاشة "بانتظار اعتمادك" لـ ADMIN — **مدخل واحد يجمع**، لا مصدر
// حقيقة ثانٍ. تعرض ما ينتظر قرار ADMIN وتستدعي نفس الأكشنات القائمة
// (decideDiscountAction · issueInvoiceAction) بنفس حرّاسها. لا منطق اعتماد جديد.
export default async function ApprovalsPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [pendingDiscounts, passedLogs, draftInvoices] = await Promise.all([
    // طلبات الخصم المعلّقة (DiscountRequest بلا علاقة quotation — نجلب العروض منفصلة)
    prisma.discountRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        quotationId: true,
        requestedPct: true,
        reason: true,
        createdAt: true,
      },
    }),
    // D-19: يظهر لـ ADMIN ما مرّره مدير المبيعات فقط
    prisma.activityLog.findMany({
      where: { entity: "DiscountRequest", action: "DISCOUNT_MANAGER_PASSED" },
      select: { entityId: true },
    }),
    // الفواتير المسودة بانتظار الإصدار (D-21)
    prisma.invoice.findMany({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        documentNumber: true,
        totalAmount: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const passedIds = new Set(passedLogs.map((l) => l.entityId));
  const passedDiscounts = pendingDiscounts.filter((d) => passedIds.has(d.id));

  // جلب أرقام العروض/العملاء للطلبات المُمرَّرة (علاقة غير معرّفة على DiscountRequest)
  const quotationMap = new Map(
    (
      await prisma.quotation.findMany({
        where: { id: { in: passedDiscounts.map((d) => d.quotationId) } },
        select: { id: true, number: true, customer: { select: { name: true } } },
      })
    ).map((q) => [q.id, q])
  );

  const discounts = passedDiscounts.map((d) => ({
    id: d.id,
    requestedPct: d.requestedPct.toNumber(),
    reason: d.reason,
    quotationNumber: quotationMap.get(d.quotationId)?.number ?? "—",
    customerName: quotationMap.get(d.quotationId)?.customer?.name ?? "—",
    createdAt: d.createdAt.toISOString(),
  }));

  const invoices = draftInvoices.map((i) => ({
    id: i.id,
    documentNumber: i.documentNumber,
    totalAmount: i.totalAmount.toNumber(),
    customerName: i.customer.name,
    createdAt: i.createdAt.toISOString(),
  }));

  return <ApprovalsClient discounts={discounts} invoices={invoices} />;
}
