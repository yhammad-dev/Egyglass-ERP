export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { t } from "@/lib/server-translations";
import { PrintButton } from "../../quotations/[id]/print/_components/print-button";

// SCR-015 دفعة 1: طباعة المستخلص — يقرأ snapshot المجمّد حصريًا (documentNumber/progressPct/statementValue/issuedAt)
export default async function StatementPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ACCOUNTING", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [s, settings] = await Promise.all([
    prisma.progressStatement.findUnique({
      where: { id },
      include: {
        issuedBy: { select: { name: true } },
        contract: {
          select: {
            customer: { select: { name: true } },
            quotation: { select: { number: true } },
          },
        },
      },
    }),
    getSystemSettings().catch(() => null),
  ]);

  if (!s) notFound();

  const companyName = settings?.companyName || "EgyGlass";
  const logoUrl = settings?.companyLogoUrl ?? null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 }).format(n);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(d);

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
                {t("statements.print.titleEn")}
              </p>
              <p className="text-xl font-bold">{t("statements.print.title")}</p>
            </div>
          </div>
        </header>

        {/* ── سجل المستند: رقم · المُصدِر · تاريخ الإصدار · الحالة ── */}
        <section className="grid grid-cols-4 gap-0 border border-gray-400 text-sm mb-4">
          {[
            [
              t("statements.print.docNumber"),
              s.documentNumber ?? t("statements.print.draftNoNumber"),
            ],
            [t("statements.print.issuedBy"), s.issuedBy?.name ?? t("quotations.dash")],
            [
              t("statements.print.issueDate"),
              s.issuedAt ? fmtDate(s.issuedAt) : t("quotations.dash"),
            ],
            [t("statements.print.status"), t(`statements.status_${s.status}`)],
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

        {/* ── العميل والعقد ── */}
        <section className="border border-gray-400 text-sm mb-4">
          <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
            {t("statements.print.contractInfo")}
          </p>
          <div className="grid grid-cols-2">
            <p className="px-2 py-1.5">
              <span className="font-semibold">{t("statements.print.customer")}:</span>{" "}
              {s.contract.customer.name}
            </p>
            <p className="px-2 py-1.5">
              <span className="font-semibold">{t("statements.print.quotationRef")}:</span>{" "}
              {s.contract.quotation.number}
            </p>
          </div>
        </section>

        {/* ── جوهر المستخلص: نسبة الإنجاز + القيمة المجمّدة ── */}
        <section className="border border-gray-500 text-sm mb-4">
          <div className="flex justify-between px-3 py-2 border-b border-gray-300">
            <span className="font-semibold">{t("statements.print.progressPct")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.progressPct.toNumber()}%
            </span>
          </div>
          <div className="flex justify-between px-3 py-2.5 bg-gray-800 text-white font-bold">
            <span>{t("statements.print.statementValue")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmt(s.statementValue.toNumber())} {t("quotations.print.currency")}
            </span>
          </div>
        </section>

        {/* ── البيان ── */}
        {s.notes && (
          <section className="border border-gray-400 text-sm mb-6">
            <p className="bg-gray-100 px-2 py-1 font-semibold border-b border-gray-400">
              {t("statements.print.notes")}
            </p>
            <p className="px-3 py-2 whitespace-pre-line">{s.notes}</p>
          </section>
        )}
      </div>
    </>
  );
}
