import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

/**
 * SF-07 (Wave C) — طبقة تجميع داشبورد المبيعات (قراءة فقط، بلا mutation ⇒ بلا ActivityLog).
 *
 * لماذا ملف منفصل لا `lib/executive/actions.ts`؟ ذاك محصور بـ`EXECUTIVE_ROLES=["ADMIN"]`
 * وأرقامه عامة بلا تنطيق بالمستخدم؛ وهذه الطبقة لدورَي المبيعات بتنطيق ملكية مختلف.
 * دمجهما كان سيخلط بوابتَي دور مختلفتين في ملف واحد.
 *
 * التنطيق (قرار Wave C الصريح):
 * - `SALES_MANAGER`: تجميع الفريق كامل — بلا قيد ownership.
 * - `SALES_REP`: مُنطَّق على عملائه عبر `Customer.ownerId` **فقط — بلا `coveredById`**.
 *   ⚠️ الفرق عن `services/customers.ts:46-51` (`OR[ownerId, coveredById]`) **مقصود لا سهو**:
 *   التغطية = صلاحية **وصول** تشغيلية (يرد على عميل زميله وقت غيابه). الملكية = إسناد
 *   **أداء** (مَن يُحتسب له الإنجاز في التارجت). هذا الداشبورد يقيس الإنجاز، فضمّ عملاء
 *   التغطية يُضخّم رقم المندوب بشغل زميله ويفسد غرض الشاشة. نمط customers.ts صحيح في
 *   سياقه — شاشة وصول لا شاشة قياس.
 *
 * قرار العقود (D-44): المعيار **وجود العقد** لا `signedAt IS NOT NULL`. السبب: 6 من 10
 * عقود بلا `signedAt` = بيانات بذرة سابقة لوجود الحقل في `contract-form`، ليست حالة عمل
 * (التطبيق يكتب الحقل دائمًا الآن). الفلترة به اليوم تُسقط عقدًا **منفَّذًا فعليًا** — أي أن
 * بيانات اختبار وسخة تفسد مؤشرًا صحيحًا. بعد تنظيف البذرة يصير التحويل أدق (SF-22).
 *
 * 🔴 صفر أرقام إيرادات/تحصيل مالي في هذه الطبقة (D-11/D-15).
 */

const SALES_DASHBOARD_ROLES = ["SALES_MANAGER", "SALES_REP"];

export type SalesRequestTypeKey = "INDIVIDUAL" | "SOCIAL_MEDIA" | "PROJECTS";

export interface SalesDashboardData {
  /** TEAM = مدير المبيعات (الفريق كامل) · OWN = المندوب (عملاؤه) */
  scope: "TEAM" | "OWN";
  /** D-44: عقود بانتظار التنفيذ مقابل منفَّذة */
  contracts: { awaitingExecution: number; executed: number; total: number };
  quotationsByStatus: Array<{ status: string; count: number }>;
  /** لمدير المبيعات فقط — المندوب يرى عملاءه بطبيعته فلا معنى للمؤشر عنده */
  customersPerOwner: Array<{
    ownerId: string | null;
    ownerName: string | null;
    count: number;
  }> | null;
  /** D-45 بُعد (1): نوع الطلب — مستقل تمامًا عن technicalRoute */
  requestTypes: Record<SalesRequestTypeKey, number>;
  /** D-45 بُعد (2): تاج التوصية — عدّاد منفصل، **لا يُدمج** في تجميع نوع الطلب */
  referralTagged: number;
  /**
   * SF-06: معاينات غير منتهية **مُنطَّقة** بعملاء المندوب/الفريق — تصحيحًا للعدّاد العام
   * غير المُنطَّق في `dashboard/page.tsx` (كان المندوب يرى رقم الشركة كله).
   */
  pendingInspections: number;
}

export async function getSalesDashboard(): Promise<SalesDashboardData | null> {
  const roleCheck = await requireRole(SALES_DASHBOARD_ROLES);
  if (!roleCheck.authorized) return null;

  const isManager = roleCheck.role === "SALES_MANAGER";
  // undefined للمدير = بلا قيد؛ للمندوب = عملاؤه بالملكية
  const customerScope = isManager ? undefined : { ownerId: roleCheck.userId };
  const scopedByCustomer = customerScope ? { customer: customerScope } : {};

  const [
    contractRows,
    quotationRows,
    requestTypeRows,
    referralTagged,
    pendingInspections,
  ] = await Promise.all([
      // D-44: السلسلة الفعلية Contract → Quotation → ManufacturingOrder[] → InstallationOrder?
      // (Contract.quotationId فريد ⇒ 1:1 · ManufacturingOrder.quotationId غير فريد ⇒ قد
      //  يحمل العقد عدة أوامر تصنيع بأوامر تركيب متعددة — أوامر W-06 البديلة).
      prisma.contract.findMany({
        where: scopedByCustomer,
        select: {
          id: true,
          quotation: {
            select: {
              manufacturingOrders: {
                select: { installationOrder: { select: { status: true } } },
              },
            },
          },
        },
      }),
      prisma.quotation.groupBy({
        by: ["status"],
        where: { deletedAt: null, ...scopedByCustomer },
        _count: { _all: true },
      }),
      prisma.quotationRequest.groupBy({
        by: ["salesRequestType"],
        where: { deletedAt: null, ...scopedByCustomer },
        _count: { _all: true },
      }),
      prisma.quotationRequest.count({
        where: { isReferralTag: true, deletedAt: null, ...scopedByCustomer },
      }),
      prisma.inspectionRequest.count({
        where: { deletedAt: null, status: { not: "DONE" }, ...scopedByCustomer },
      }),
    ]);

  // D-44 حرفيًا: "منفَّذ" = **كل** أوامر التركيب المرتبطة COMPLETED (لا أيٌّ منها).
  // 🔴 حارس الفراغ: عقد بلا أي أمر تركيب ليس منفَّذًا — `every` على مصفوفة فارغة ترجع true،
  // فبدون شرط الطول كان العقد الذي لم يبدأ تنفيذه يُحتسب "منفَّذًا" بالفراغ.
  let executed = 0;
  for (const contract of contractRows) {
    const orders = contract.quotation.manufacturingOrders.flatMap((order) =>
      order.installationOrder ? [order.installationOrder] : []
    );
    if (orders.length > 0 && orders.every((o) => o.status === "COMPLETED")) {
      executed += 1;
    }
  }

  const requestTypes: Record<SalesRequestTypeKey, number> = {
    INDIVIDUAL: 0,
    SOCIAL_MEDIA: 0,
    PROJECTS: 0,
  };
  for (const row of requestTypeRows) {
    requestTypes[row.salesRequestType as SalesRequestTypeKey] = row._count._all;
  }

  // عدد عملاء كل موظف — للمدير فقط
  let customersPerOwner: SalesDashboardData["customersPerOwner"] = null;
  if (isManager) {
    const ownerRows = await prisma.customer.groupBy({
      by: ["ownerId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const ownerIds = ownerRows
      .map((row) => row.ownerId)
      .filter((id): id is string => id !== null);
    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(owners.map((user) => [user.id, user.name]));
    customersPerOwner = ownerRows
      .map((row) => ({
        ownerId: row.ownerId,
        ownerName: row.ownerId ? nameById.get(row.ownerId) ?? null : null,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    scope: isManager ? "TEAM" : "OWN",
    contracts: {
      awaitingExecution: contractRows.length - executed,
      executed,
      total: contractRows.length,
    },
    quotationsByStatus: quotationRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    customersPerOwner,
    requestTypes,
    referralTagged,
    pendingInspections,
  };
}
