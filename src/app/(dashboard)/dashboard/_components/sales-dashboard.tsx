import type { ReactNode } from "react";
import { t } from "@/lib/server-translations";
import type { SalesDashboardData } from "@/lib/services/sales-dashboard";

/**
 * SF-06 (Wave C) — داشبورد المبيعات Role-aware (SALES_REP / SALES_MANAGER فقط).
 *
 * قالب البطاقة مُعاد استخدامه من `executive/page.tsx:76-89` (بلا تصميم جديد).
 * المفاتيح المُعاد استخدامها: `dashboard.title` · `dashboard.pendingInspections` ·
 * `quotations.statuses.*` · `quotationRequest.salesType_*` · `quotationRequest.referralTag` ·
 * `customers.owner` · `customers.title` — لا مفاتيح مكررة.
 *
 * 🔴 صفر أرقام إيرادات/تحصيل (D-11/D-15). كل الأرقام اللاتينية بـdir="ltr" داخل RTL،
 * والمسافات منطقية (`ms-`) لا فيزيائية.
 */

const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXPIRED",
] as const;

const REQUEST_TYPES = ["INDIVIDUAL", "SOCIAL_MEDIA", "PROJECTS"] as const;

function KpiCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border p-4 space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{children}</p>
    </div>
  );
}

export function SalesDashboard({
  data,
  userName,
}: {
  data: SalesDashboardData;
  userName?: string | null;
}) {
  const statusCount = new Map(
    data.quotationsByStatus.map((row) => [row.status, row.count])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {userName} —{" "}
          {t(data.scope === "TEAM" ? "dashboard.scopeTeam" : "dashboard.scopeOwn")}
        </p>
      </div>

      {/* D-44: العقود · SF-06: المعاينات مُنطَّقة (لا العدّاد العام القديم) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label={t("dashboard.contractsAwaiting")}>
          <span dir="ltr">{data.contracts.awaitingExecution}</span>
        </KpiCard>
        <KpiCard label={t("dashboard.contractsExecuted")}>
          <span dir="ltr">{data.contracts.executed}</span>
        </KpiCard>
        <KpiCard label={t("dashboard.pendingInspections")}>
          <span dir="ltr">{data.pendingInspections}</span>
        </KpiCard>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("dashboard.quotationsByStatus")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {QUOTATION_STATUSES.map((status) => (
            <KpiCard key={status} label={t(`quotations.statuses.${status}`)}>
              <span dir="ltr">{statusCount.get(status) ?? 0}</span>
            </KpiCard>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("dashboard.requestTypes")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {REQUEST_TYPES.map((type) => (
            <KpiCard key={type} label={t(`quotationRequest.salesType_${type}`)}>
              <span dir="ltr">{data.requestTypes[type]}</span>
              {/* D-45: تاج التوصية = علامة بصرية صغيرة جنب "مشروعات" تحديدًا — لا بطاقة مستقلة */}
              {type === "PROJECTS" && (
                <span
                  className="ms-2 align-middle rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium"
                  title={t("quotationRequest.referralTag")}
                >
                  {t("dashboard.referralTagged")}{" "}
                  <span dir="ltr">{data.referralTagged}</span>
                </span>
              )}
            </KpiCard>
          ))}
        </div>
      </section>

      {/* عدد العملاء لكل موظف — مدير المبيعات فقط (المندوب يرى عملاءه بطبيعته) */}
      {data.customersPerOwner && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("dashboard.customersPerOwner")}</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-3 font-medium">{t("customers.owner")}</th>
                  <th className="text-start p-3 font-medium">{t("customers.title")}</th>
                </tr>
              </thead>
              <tbody>
                {data.customersPerOwner.map((row) => (
                  <tr key={row.ownerId ?? "unassigned"} className="border-b last:border-0">
                    <td className="p-3">{row.ownerName ?? t("dashboard.noOwner")}</td>
                    <td className="p-3" dir="ltr">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
