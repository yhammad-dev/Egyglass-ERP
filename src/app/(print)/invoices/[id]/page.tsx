export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { t } from "@/lib/server-translations";
import { PrintButton } from "../../quotations/[id]/print/_components/print-button";

// SCR-015 دفعة 2: طباعة الفاتورة — مبالغ الفاتورة من snapshot المجمّد حصريًا
// (المدفوع من Payments — هي الحقيقة الحية للسداد، ليست جزءًا من الـ snapshot)
export default async function InvoicePrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ACCOUNTING", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [inv, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        issuedBy: { select: { name: true } },
        quotation: {
          select: { number: true, payments: { select: { amount: true } } },
        },
        statement: { select: { documentNumber: true } },
      },
    }),
    getSystemSettings().catch(() => null),
  ]);

  if (!inv) notFound();

  const companyName = settings?.companyName || "EgyGlass";
  const logoUrl = settings?.companyLogoUrl ?? null;

  const D = Prisma.Decimal;
  const paid = (inv.quotation?.payments ?? []).reduce(
    (sum, p) => sum.add(p.amount),
    new D(0)
  );
  const due = inv.totalAmount.sub(paid);

  // نِسب مشتقّة من الـ snapshot المجمّد حصريًا (لا قراءة config لايف — الرقم يطابق المعروض):
  // نسبة الضريبة = القيمة ÷ الصافي بعد الخصم — نفس أساس احتساب vatAmount (net·taxPct/100، §5)
  const vatBase = inv.subtotal.sub(inv.discountAmount);
  const vatPct = vatBase.gt(0) ? inv.vatAmount.div(vatBase).mul(100) : null;
  // نسبة السداد = المدفوع ÷ الإجمالي
  const paidPct = inv.totalAmount.gt(0) ? paid.div(inv.totalAmount).mul(100) : null;

  const fmt = (n: Prisma.Decimal) =>
    new Intl.NumberFormat("ar-EG-u-nu-latn", { minimumFractionDigits: 2 }).format(
      n.toNumber()
    );
  // نسبة مئوية بأرقام لاتينية (مطابِقة لباقي القوالب) — تقريب لخانتين وإسقاط الأصفار
  const fmtPct = (n: Prisma.Decimal) =>
    new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 2 }).format(
      n.toNumber()
    );
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long" }).format(d);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page { size: A4; margin: 15mm; }
        .print-doc {
          font-family: var(--font-cairo), "Cairo", "Segoe UI", Tahoma, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>

      <div className="no-print fixed top-4 left-4 z-50 flex gap-2">
        <PrintButton />
      </div>

      <div className="print-doc max-w-[794px] mx-auto p-6 bg-white text-[#1a1a1a]">
        {/* ── الترويسة ── */}
        <header className="border-b-4 border-double border-gray-800 pb-3 mb-4">
          <div className="flex items-center justify-between gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="h-20 w-auto object-contain" />
            ) : (
              <div className="h-20 w-20 flex items-center justify-center border border-gray-400 text-2xl font-bold">
                {companyName.charAt(0)}
              </div>
            )}
            <div className="text-center flex-1">
              <p className="text-2xl font-bold tracking-wide">{companyName}</p>
            </div>
            <div className="text-center border-2 border-gray-800 px-5 py-2">
              <p className="text-sm font-semibold" dir="ltr">
                {t("invoices.print.titleEn")}
              </p>
              <p className="text-xl font-bold">{t("invoices.print.title")}</p>
            </div>
          </div>
        </header>

        {/* ── سجل المستند ── */}
        <section className="grid grid-cols-4 gap-0 border border-gray-400 text-sm mb-4">
          {[
            [
              t("invoices.print.docNumber"),
              inv.documentNumber ?? t("statements.print.draftNoNumber"),
            ],
            [t("invoices.print.issuedBy"), inv.issuedBy?.name ?? t("quotations.dash")],
            [
              t("invoices.print.issueDate"),
              inv.issuedAt ? fmtDate(inv.issuedAt) : t("quotations.dash"),
            ],
            [t("invoices.print.status"), t(`invoices.status_${inv.status}`)],
          ].map(([label, value]) => (
            <div key={label} className="border-e last:border-e-0 border-gray-400">
              <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
                {label}
              </p>
              <p className="px-2 py-1" dir="ltr">
                {value}
              </p>
            </div>
          ))}
        </section>

        {/* ── العميل والمراجع ── */}
        <section className="border border-gray-400 text-sm mb-4">
          <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
            {t("invoices.print.customer")}
          </p>
          <div className="grid grid-cols-3">
            <p className="px-2 py-1.5 font-bold">{inv.customer.name}</p>
            <p className="px-2 py-1.5">
              {t("quotations.print.phone")}: {inv.customer.phone ?? t("quotations.dash")}
            </p>
            <p className="px-2 py-1.5">
              {t("quotations.print.address")}: {inv.customer.address ?? t("quotations.dash")}
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-gray-300">
            <p className="px-2 py-1.5">
              <span className="font-semibold">{t("invoices.print.quotationRef")}:</span>{" "}
              {inv.quotation?.number ?? t("quotations.dash")}
            </p>
            <p className="px-2 py-1.5">
              <span className="font-semibold">{t("invoices.print.statementRef")}:</span>{" "}
              {inv.statement?.documentNumber ?? t("quotations.dash")}
            </p>
          </div>
        </section>

        {/* ── المبالغ (snapshot مجمّد) + المدفوع/المستحق ── */}
        <div className="w-96 ms-auto text-sm border border-gray-500 mb-6">
          <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
            <span>{t("invoices.print.subtotal")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(inv.subtotal)}</span>
          </div>
          {inv.discountAmount.gt(0) && (
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
              <span>{t("invoices.print.discount")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(inv.discountAmount)}-
              </span>
            </div>
          )}
          <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
            <span>
              {t("invoices.print.vat")}{" "}
              {vatPct !== null && (
                <span className="text-gray-500" dir="ltr">
                  ({fmtPct(vatPct)}%)
                </span>
              )}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(inv.vatAmount)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 bg-gray-800 text-white font-bold border-b border-gray-300">
            <span>{t("invoices.print.total")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmt(inv.totalAmount)} {t("quotations.print.currency")}
            </span>
          </div>
          <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
            <span>{t("invoices.print.paid")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmt(paid)}{" "}
              {paidPct !== null && (
                <span className="text-gray-500" dir="ltr">
                  ({fmtPct(paidPct)}%)
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between px-3 py-1.5 font-semibold">
            <span>{t("invoices.print.due")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(due)}</span>
          </div>
        </div>

        {/* ── البيان ── */}
        {inv.notes && (
          <section className="border border-gray-400 text-sm mb-6">
            <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
              {t("invoices.print.notes")}
            </p>
            <p className="px-3 py-2 whitespace-pre-line">{inv.notes}</p>
          </section>
        )}
      </div>
    </>
  );
}
