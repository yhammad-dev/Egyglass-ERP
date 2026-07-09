export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/server-translations";
import { PrintButton } from "./_components/print-button";

const SOCIAL_NOTE_KEYS = Array.from(
  { length: 11 },
  (_, i) => `quotations.print.socialNote${i + 1}`
);

export default async function QuotationPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "TECHNICAL_OFFICE",
    "TEC_APPROVER",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [q, settings] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        createdBy: { select: { name: true } },
        items: true,
        quotationRequest: {
          select: {
            code: true,
            technicalRoute: true,
            engineer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.systemSettings
      .findUnique({
        where: { id: "singleton" },
        select: {
          companyName: true,
          companyLogoUrl: true,
          warrantyTextSocialMedia: true,
          warrantySocialOnQuotation: true,
        },
      })
      .catch(() => null),
  ]);

  if (!q) notFound();

  const isSocial = q.quotationRequest?.technicalRoute === "SOCIAL_MEDIA";
  const issuerName = q.quotationRequest?.engineer?.name ?? q.createdBy.name;

  const companyName = settings?.companyName || "EgyGlass";
  const logoUrl = settings?.companyLogoUrl ?? null;
  const showWarranty =
    isSocial &&
    (settings?.warrantySocialOnQuotation ?? true) &&
    !!settings?.warrantyTextSocialMedia;

  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 }).format(n);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(d);

  const subtotal = q.subtotal.toNumber();
  const discountPct = q.discountPct.toNumber();
  const discountAmount = q.discountAmount.toNumber();
  const netAfterDiscount = subtotal - discountAmount;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <div className="no-print fixed top-4 left-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href={`/quotations/${id}`}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
        >
          {t("quotations.print.back")}
        </a>
      </div>

      <div className="max-w-[794px] mx-auto p-6 bg-white text-[#1a1a1a]">
        {/* ── الترويسة: لوجو + سطر الشركة ثنائي اللغة + عنوان المستند ── */}
        <header className="border-b-4 border-double border-gray-800 pb-3 mb-4">
          <div className="flex items-center justify-between gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName}
                className="h-20 w-auto object-contain"
              />
            ) : (
              <div className="h-20 w-20 flex items-center justify-center border border-gray-400 text-2xl font-bold">
                {companyName.charAt(0)}
              </div>
            )}
            <div className="text-center flex-1">
              <p className="text-2xl font-bold tracking-wide">{companyName}</p>
              <p className="text-sm text-gray-700" dir="ltr">
                {t("quotations.print.companyTagline")}
              </p>
            </div>
            <div className="text-center border-2 border-gray-800 px-5 py-2">
              <p className="text-xl font-bold">{t("quotations.print.title")}</p>
            </div>
          </div>
        </header>

        {/* ── سجل المستند (auditability): مرجع · مُصدِر · تواريخ · حالة ── */}
        <section className="grid grid-cols-4 gap-0 border border-gray-400 text-sm mb-4">
          {[
            [t("quotations.print.quotationNumber"), q.number],
            [t("quotations.print.issuedBy"), issuerName],
            [t("quotations.print.issueDate"), fmtDate(q.createdAt)],
            [
              t("quotations.print.status"),
              t(`quotations.detail.status_${q.status}`),
            ],
          ].map(([label, value]) => (
            <div key={label} className="border-e last:border-e-0 border-gray-400">
              <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
                {label}
              </p>
              <p className="px-2 py-1">{value}</p>
            </div>
          ))}
        </section>

        {/* ── بيانات العميل ── */}
        <section className="border border-gray-400 text-sm mb-4">
          <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
            {t("quotations.print.customer")}
          </p>
          <div className="grid grid-cols-3">
            <p className="px-2 py-1.5 font-bold">{q.customer.name}</p>
            <p className="px-2 py-1.5">
              {t("quotations.print.phone")}: {q.customer.phone ?? t("quotations.dash")}
            </p>
            <p className="px-2 py-1.5">
              {t("quotations.print.address")}: {q.customer.address ?? t("quotations.dash")}
            </p>
          </div>
        </section>

        {/* ── جدول البنود ── */}
        <table
          className="w-full text-sm mb-4 border border-gray-500"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-2 px-2 border border-gray-500 w-8">#</th>
              <th className="py-2 px-2 border border-gray-500 text-right">
                {t("quotations.print.item")}
              </th>
              <th className="py-2 px-2 border border-gray-500 w-20">
                {t("quotations.print.qty")}
              </th>
              <th className="py-2 px-2 border border-gray-500 w-28">
                {t("quotations.print.unitPrice")}
              </th>
              <th className="py-2 px-2 border border-gray-500 w-28">
                {t("quotations.print.lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={item.id}>
                <td className="py-1.5 px-2 border border-gray-400 text-center">
                  {i + 1}
                </td>
                <td className="py-1.5 px-2 border border-gray-400">
                  {item.description}
                </td>
                <td
                  className="py-1.5 px-2 border border-gray-400 text-center"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {item.quantity.toNumber()}
                </td>
                <td
                  className="py-1.5 px-2 border border-gray-400 text-left"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(item.unitPrice.toNumber())}
                </td>
                <td
                  className="py-1.5 px-2 border border-gray-400 text-left font-medium"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(item.lineTotal.toNumber())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-4 mb-4 items-start">
          {/* ── جهة تصنيع الزجاج (سوشيال — خانات تُعلَّم يدويًا؛ التخزين feature لاحق) ── */}
          {isSocial && (
            <section className="flex-1 border border-gray-400 text-sm">
              <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
                {t("quotations.print.glassManufacturer")}
              </p>
              <div className="flex gap-6 px-3 py-2">
                {[
                  t("quotations.print.manufacturerGereesh"),
                  t("quotations.print.manufacturerDecorative"),
                  t("quotations.print.manufacturerOther"),
                ].map((label) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 border border-gray-700" />
                    {label}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── الإجماليات: خصم صريح قبل/بعد ثم الضريبة ثم النهائي ── */}
          <div className="w-80 ms-auto text-sm border border-gray-500">
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
              <span>{t("quotations.print.subtotalBeforeDiscount")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(subtotal)}
              </span>
            </div>
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
              <span>
                {t("quotations.print.discount")} ({discountPct}%)
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(discountAmount)}-
              </span>
            </div>
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-300 font-semibold">
              <span>{t("quotations.print.netAfterDiscount")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(netAfterDiscount)}
              </span>
            </div>
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-300">
              <span>
                {t("quotations.print.vat")} ({q.taxPct.toNumber()}%)
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(q.taxAmount.toNumber())}
              </span>
            </div>
            <div className="flex justify-between px-3 py-2 bg-gray-800 text-white font-bold">
              <span>{t("quotations.print.grandTotal")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(q.total.toNumber())} {t("quotations.print.currency")}
              </span>
            </div>
          </div>
        </div>

        {/* ── صلاحية العرض ── */}
        <p className="text-sm mb-4">
          <span className="font-semibold">{t("quotations.print.validUntil")}:</span>{" "}
          {fmtDate(q.validUntil)}
        </p>

        {/* ── الملاحظات العامة (11 — شروط السوشيال) ── */}
        {isSocial && (
          <section className="border border-gray-400 text-xs mb-4">
            <p className="bg-gray-100 px-2 py-1 font-semibold text-sm border-b border-gray-400">
              {t("quotations.print.generalNotes")}
            </p>
            <ol className="list-decimal ps-7 pe-3 py-2 space-y-1">
              {SOCIAL_NOTE_KEYS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ol>
          </section>
        )}

        {/* ── الضمان (config: warrantyTextSocialMedia + warrantySocialOnQuotation) ── */}
        {showWarranty && (
          <section className="border border-gray-400 text-xs mb-6">
            <p className="bg-gray-100 px-2 py-1 font-semibold text-sm border-b border-gray-400">
              {t("quotations.print.warrantyTitle")}
            </p>
            <p className="px-3 py-2 whitespace-pre-line">
              {settings?.warrantyTextSocialMedia}
            </p>
          </section>
        )}

        {/* ── توقيع واحد: موافقة العميل ── */}
        <footer className="flex justify-start pt-4">
          <div className="text-center text-sm">
            <p className="font-semibold mb-10">
              {t("quotations.print.customerApproval")}
            </p>
            <div className="border-b border-gray-700 w-52" />
            <p className="text-xs text-gray-500 mt-1">
              {t("quotations.print.signature")}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
