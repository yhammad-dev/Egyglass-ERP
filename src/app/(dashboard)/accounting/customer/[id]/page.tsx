export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerSheet } from "../../../../../../lib/accounting/actions";
import { t } from "@/lib/server-translations";

// SCR-015 دفعة 2: شيت العميل (أعمدة راندا) — قراءة صرفة، النطاق داخل getCustomerSheet (R-03)
export default async function CustomerSheetPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const sheet = await getCustomerSheet(id);
  if (!sheet) notFound();

  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 }).format(n);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(d);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {t("accounting.sheet.title")} — {sheet.customerName}
        </h1>
        <Link href="/accounting" className="text-sm underline text-muted-foreground">
          {t("accounting.sheet.back")}
        </Link>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-right">
              <th className="p-2">{t("accounting.sheet.number")}</th>
              <th className="p-2">{t("accounting.sheet.date")}</th>
              <th className="p-2">{t("accounting.sheet.description")}</th>
              <th className="p-2">{t("accounting.sheet.totalContract")}</th>
              <th className="p-2">{t("accounting.sheet.paid")}</th>
              <th className="p-2">{t("accounting.sheet.remaining")}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => (
              <tr key={r.quotationId} className="border-t">
                <td className="p-2">
                  <Link href={`/quotations/${r.quotationId}`} className="underline">
                    {r.number}
                  </Link>
                </td>
                <td className="p-2">{fmtDate(r.date)}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.totalContract)}
                </td>
                <td className="p-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.totalPaid)}
                </td>
                <td className="p-2 font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.remaining)}
                </td>
              </tr>
            ))}
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  {t("accounting.sheet.empty")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted font-bold">
              <td className="p-2" colSpan={3}>
                {t("accounting.sheet.totals")}
              </td>
              <td className="p-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(sheet.totals.contract)}
              </td>
              <td className="p-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(sheet.totals.paid)}
              </td>
              <td className="p-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(sheet.totals.remaining)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
