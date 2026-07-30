export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { t } from "@/lib/server-translations";
import { getDashboardKPIs } from "../../../../lib/executive/actions";
import { getSalesDashboard } from "@/lib/services/sales-dashboard";
import { getPendingInspectionsCount } from "@/lib/services/inspections";
import { SalesDashboard } from "./_components/sales-dashboard";

export default async function DashboardPage() {
  const session = await auth();

  // SF-06 (Wave C): فرع المبيعات وحده. أي دور آخر (ADMIN/TEC/REVIEW/…) يتخطّى هذه الكتلة
  // ويصل للسلوك القائم أدناه حرفيًا بلا أي تغيير. الحارس داخل getSalesDashboard (L-05).
  if (session?.user?.role === "SALES_REP" || session?.user?.role === "SALES_MANAGER") {
    const salesData = await getSalesDashboard();
    if (salesData) {
      return <SalesDashboard data={salesData} userName={session.user.name} />;
    }
  }

  const dashboardData = await getDashboardKPIs();
  // IN-12: العدّاد كان استعلامًا خامًا هنا بلا حارس ولا نطاق ولا `deletedAt` ولا
  // تفريع بالدور ⇒ كل دور مُصادَق يقرأ إجمالي معاينات الشركة (بما فيها المحذوف
  // منطقيًا)، ومندوب المعاينة يرى 20 والقائمة أمامه 2. الحارس والنطاق صارا داخل
  // الخدمة (نفس عقد getDashboardKPIs/getSalesDashboard) و`null` = لا يرى العدّاد.
  const pendingInspections = await getPendingInspectionsCount();

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

          {pendingInspections !== null && (
            <div className="rounded-md border p-4">
              <p className="text-sm text-gray-500">{t("dashboard.pendingInspections")}</p>
              <p className="text-2xl font-bold" dir="ltr">
                {pendingInspections}
              </p>
            </div>
          )}

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
      ) : pendingInspections !== null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">{t("dashboard.pendingInspections")}</p>
            <p className="text-2xl font-bold" dir="ltr">
              {pendingInspections}
            </p>
          </div>
        </div>
      ) : (
        // IN-12: الأدوار غير المعنية (ACCOUNTING · VIEWER · PROCUREMENT · HR ·
        // PROJECTS …) لم تعد ترى عدّاد المعاينات — وقبل هذه الرسالة كانت الصفحة
        // تخرج **فارغة تمامًا** (ترويسة وترحيب بلا أي شيء). صفحة فارغة تُقرأ كعطل،
        // فتُصرَّح الحالة بدل تركها للتخمين.
        <p className="text-sm text-gray-500">{t("dashboard.noWidgetsForRole")}</p>
      )}
    </div>
  );
}
