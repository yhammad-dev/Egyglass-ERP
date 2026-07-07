export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/server-translations";
import { getDashboardKPIs } from "../../../../lib/executive/actions";

export default async function DashboardPage() {
  const session = await auth();
  const dashboardData = await getDashboardKPIs();
  const pendingInspections = await prisma.inspectionRequest.count({
    where: { status: { not: "DONE" } },
  });

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("dashboard.title")}</h1>
      <p className="text-gray-500 mb-6">
        مرحباً {session?.user?.name} — {t("dashboard.title")}
      </p>

      {dashboardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.activeCustomers")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {dashboardData.kpis.activeCustomers}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.quotationsThisMonth")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {dashboardData.kpis.quotationsThisMonth}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.conversionRate")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {dashboardData.kpis.conversionRate.toFixed(1)}%
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.pendingInspections")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {pendingInspections}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.mfgInProduction")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {dashboardData.kpis.mfgInProduction}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.totalRevenue")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {numberFormat.format(dashboardData.kpis.approvedRevenue)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.pendingInspections")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {pendingInspections}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
