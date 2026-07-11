export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { t } from "@/lib/server-translations";
import { getDashboardKPIs } from "../../../../lib/executive/actions";

const numberFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default async function ExecutivePage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const data = await getDashboardKPIs();
  if (!data) redirect("/dashboard");

  const { kpis, recentQuotations, recentMfgOrders, newCustomersThisWeek, topProducts } = data;

  const cards = [
    { label: t("executive.kpi.activeCustomers"), value: kpis.activeCustomers },
    { label: t("executive.kpi.quotationsThisMonth"), value: kpis.quotationsThisMonth },
    {
      label: t("executive.kpi.conversionRate"),
      value: <span dir="ltr">{percentFormat.format(kpis.conversionRate)}%</span>,
    },
    { label: t("executive.kpi.mfgInProduction"), value: kpis.mfgInProduction },
    {
      label: t("executive.kpi.installationsScheduledThisWeek"),
      value: kpis.installationsScheduledThisWeek,
    },
    {
      label: t("executive.kpi.approvedRevenue"),
      value: <span dir="ltr">{numberFormat.format(kpis.approvedRevenue)}</span>,
    },
    // ── دفعة د (CEO-R06) ──
    { label: t("executive.kpi.activeProjects"), value: kpis.activeProjects },
    {
      label: t("executive.kpi.overdueMfgOrders"),
      value: kpis.overdueMfgOrders,
      alert: kpis.overdueMfgOrders > 0,
    },
    {
      label: t("executive.kpi.overdueInstallations"),
      value: kpis.overdueInstallations,
      alert: kpis.overdueInstallations > 0,
    },
    { label: t("executive.kpi.mfgUnderReview"), value: kpis.mfgUnderReview },
    { label: t("executive.kpi.drawingsAwaitingCeo"), value: kpis.drawingsAwaitingCeo },
    {
      label: t("executive.kpi.totalCollected"),
      value: <span dir="ltr">{numberFormat.format(kpis.totalCollected)}</span>,
    },
    {
      label: t("executive.kpi.totalOutstanding"),
      value: <span dir="ltr">{numberFormat.format(kpis.totalOutstanding)}</span>,
      alert: kpis.totalOutstanding > 0,
    },
  ] as { label: string; value: React.ReactNode; alert?: boolean }[];

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">{t("executive.title")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`rounded-md border p-4 space-y-2 ${
              card.alert ? "bg-red-50 border-red-200" : "bg-white"
            }`}
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-bold ${card.alert ? "text-red-700" : ""}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("executive.recentQuotations")}</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">{t("executive.table.number")}</th>
                  <th className="text-right p-2">{t("executive.table.customer")}</th>
                  <th className="text-right p-2">{t("executive.table.total")}</th>
                  <th className="text-right p-2">{t("executive.table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotations.length ? (
                  recentQuotations.map((q) => (
                    <tr key={q.id} className="border-b last:border-0">
                      <td className="p-2">
                        <span dir="ltr">{q.number}</span>
                      </td>
                      <td className="p-2">{q.customerName}</td>
                      <td className="p-2">
                        <span dir="ltr">{numberFormat.format(q.total)}</span>
                      </td>
                      <td className="p-2">{dateFormat.format(new Date(q.createdAt))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-6">
                      {t("app.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("executive.recentMfgOrders")}</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">{t("executive.table.number")}</th>
                  <th className="text-right p-2">{t("executive.table.customer")}</th>
                  <th className="text-right p-2">{t("executive.table.status")}</th>
                  <th className="text-right p-2">{t("executive.table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {recentMfgOrders.length ? (
                  recentMfgOrders.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="p-2">
                        <span dir="ltr">{o.number}</span>
                      </td>
                      <td className="p-2">{o.customerName}</td>
                      <td className="p-2">{t(`manufacturing.status_${o.status}`)}</td>
                      <td className="p-2">{dateFormat.format(new Date(o.createdAt))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-6">
                      {t("app.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("executive.newCustomersThisWeek")}</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">{t("executive.table.name")}</th>
                  <th className="text-right p-2">{t("executive.table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {newCustomersThisWeek.length ? (
                  newCustomersThisWeek.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{dateFormat.format(new Date(c.createdAt))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center text-muted-foreground py-6">
                      {t("app.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("executive.topProducts")}</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">{t("executive.table.product")}</th>
                  <th className="text-right p-2">{t("executive.table.count")}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length ? (
                  topProducts.map((item, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="p-2">{item.description}</td>
                      <td className="p-2">
                        <span dir="ltr">{item.count}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center text-muted-foreground py-6">
                      {t("app.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
