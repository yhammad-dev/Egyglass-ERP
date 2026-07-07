export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "../../../../../../lib/admin/actions";
import { PrintButton } from "./_components/print-button";

export default async function QuotationPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP", "VIEWER"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [q, company] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        createdBy: { select: { name: true } },
        items: true,
      },
    }),
    getCompanySettings(),
  ]);

  if (!q) notFound();

  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 }).format(n);

  const validDate = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(q.validUntil);
  const createdDate = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(q.createdAt);

  const companyName = company.companyName || "EgyGlass";
  const logoUrl = company.companyLogoUrl;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a1a; }
      `}</style>

      <div className="no-print fixed top-4 left-4 z-50 flex gap-2">
        <PrintButton />
        <a href={`/quotations/${id}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
          رجوع
        </a>
      </div>

      <div className="max-w-[794px] mx-auto p-8 bg-white min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-blue-700 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="h-16 w-auto object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-blue-700 flex items-center justify-center text-white text-2xl font-bold">
                {companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-blue-700">{companyName}</h1>
              <p className="text-sm text-gray-500 mt-1">للزجاج والألومنيوم</p>
            </div>
          </div>
          <div className="text-left text-sm text-gray-600 space-y-1">
            <p className="font-bold text-lg text-gray-800">عرض سعر</p>
            <p>رقم: <span className="font-mono font-bold">{q.number}</span></p>
            <p>تاريخ الإصدار: {createdDate}</p>
            <p>صالح حتى: {validDate}</p>
          </div>
        </div>

        {/* Customer & Issued By */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">مقدم إلى</p>
            <p className="font-bold text-gray-800 text-lg">{q.customer.name}</p>
            {q.customer.phone && <p className="text-sm text-gray-600 mt-1">📞 {q.customer.phone}</p>}
            {q.customer.address && <p className="text-sm text-gray-600">📍 {q.customer.address}</p>}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">أعده</p>
            <p className="font-bold text-gray-800">{q.createdBy.name}</p>
            <p className="text-sm text-gray-600 mt-1">{companyName} للزجاج والألومنيوم</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm mb-8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-blue-700 text-white">
              <th className="py-2.5 px-3 text-right font-semibold w-8">#</th>
              <th className="py-2.5 px-3 text-right font-semibold">البيان</th>
              <th className="py-2.5 px-3 text-center font-semibold w-20">الكمية</th>
              <th className="py-2.5 px-3 text-left font-semibold w-28">سعر الوحدة</th>
              <th className="py-2.5 px-3 text-left font-semibold w-28">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
                <td className="py-2 px-3 text-gray-500 text-center">{i + 1}</td>
                <td className="py-2 px-3 text-gray-800">{item.description}</td>
                <td className="py-2 px-3 text-center text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {item.quantity.toNumber()}
                </td>
                <td className="py-2 px-3 text-left text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(item.unitPrice.toNumber())}
                </td>
                <td className="py-2 px-3 text-left font-medium text-gray-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(item.lineTotal.toNumber())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm text-gray-600 py-1 border-b border-gray-200">
              <span>المجموع قبل الضريبة</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(q.subtotal.toNumber())}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 py-1 border-b border-gray-200">
              <span>ضريبة القيمة المضافة ({q.taxPct.toNumber()}%)</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(q.taxAmount.toNumber())}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-blue-700 py-2 border-t-2 border-blue-700">
              <span>الإجمالي الكلي</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(q.total.toNumber())} جنيه</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 grid grid-cols-2 gap-8 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-700 mb-1">شروط وأحكام</p>
            <ul className="space-y-1 text-xs text-gray-500">
              <li>• العرض ساري حتى تاريخ انتهاء الصلاحية المذكور</li>
              <li>• الأسعار شاملة ضريبة القيمة المضافة</li>
              <li>• يُشترط دفع دفعة مقدمة عند التعاقد</li>
            </ul>
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-700 mb-8">التوقيع والختم</p>
            <div className="border-b border-gray-400 w-40 mr-auto"></div>
            <p className="text-xs text-gray-400 mt-1">توقيع العميل</p>
          </div>
        </div>
      </div>
    </>
  );
}
