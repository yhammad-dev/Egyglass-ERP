import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const EXECUTIVE_ROLES = ["ADMIN"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export async function getDashboardKPIs() {
  try {
    const roleCheck = await requireRole(EXECUTIVE_ROLES);
    if (!roleCheck.authorized) return null;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const [
      activeCustomers,
      quotationsThisMonth,
      totalQuotationsCount,
      approvedQuotationsCount,
      mfgInProduction,
      installationsScheduledThisWeek,
      approvedRevenue,
      recentQuotations,
      recentMfgOrders,
      newCustomersThisWeek,
      topItems,
    ] = await Promise.all([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.quotation.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.quotation.count(),
      prisma.quotation.count({ where: { reviewStatus: "APPROVED" } }),
      prisma.manufacturingOrder.count({ where: { status: "IN_PRODUCTION" } }),
      prisma.installationOrder.count({
        where: {
          status: "SCHEDULED",
          scheduledAt: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.quotation.aggregate({
        where: { reviewStatus: "APPROVED" },
        _sum: { total: true },
      }),
      prisma.quotation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { name: true } } },
      }),
      prisma.manufacturingOrder.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { quotation: { select: { number: true, customer: { select: { name: true } } } } },
      }),
      prisma.customer.findMany({
        where: { createdAt: { gte: weekStart, lt: weekEnd } },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.quotationItem.groupBy({
        by: ["description"],
        _count: { description: true },
        orderBy: { _count: { description: "desc" } },
        take: 5,
      }),
    ]);

    const conversionRate =
      totalQuotationsCount > 0
        ? (approvedQuotationsCount / totalQuotationsCount) * 100
        : 0;

    // ── دفعة د (CEO-R06): مشاريع + مالية Decimal + مؤشرات تشغيل ──
    // "المشاريع المتأخرة" — التعريف المختار: إشارتان تشغيليتان حقيقيتان بدل اشتقاق ضعيف
    // (Project لا يملك جدولًا زمنيًا مستخدمًا): أوامر تصنيع تجاوزت expectedAt ولم تُسلَّم،
    // وتركيبات مجدولة فات موعدها ولم تكتمل — وعدان زمنيان صريحان في البيانات.
    const [
      activeProjects,
      overdueMfgOrders,
      overdueInstallations,
      mfgUnderReview,
      paymentsSum,
    ] = await Promise.all([
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.manufacturingOrder.count({
        where: {
          expectedAt: { lt: now },
          status: { in: ["IN_PRODUCTION", "UNDER_REVIEW", "PENDING"] },
        },
      }),
      prisma.installationOrder.count({
        where: {
          scheduledAt: { lt: now },
          status: { in: ["PENDING", "SCHEDULED", "IN_PROGRESS"] },
        },
      }),
      prisma.manufacturingOrder.count({ where: { status: "UNDER_REVIEW" } }),
      // TO-03: حُذف عدّاد "رسومات بانتظار اعتماد الإدارة العليا" الذي كان يقرأ
      // DrawingStatus.INS_VERIFIED — حالة **صفر-كاتب**: لا سطر في الكود يكتبها،
      // فبوابتا G2/G3 مُعطَّلتان (verifyDrawingAction/ceoApproveDrawingAction تُرجعان
      // errors.gateRemoved — D-02/D-05)، وكُتّاب Drawing.status الثلاثة الوحيدون يكتبون
      // DRAFT (default) و TEC_APPROVED و SUPERSEDED فقط.
      // 🔴 الضرر الفعلي (مُتحقَّق بالقاعدة الحيّة، لا افتراض): الجدول يحمل صفًا واحدًا
      // بـINS_VERIFIED من بيانات سابقة لإلغاء البوابتين، فكانت البطاقة تعرض "1" **مجمَّدًا
      // إلى الأبد** — أسوأ من صفر: توهم الإدارة بأن رسمة تنتظر اعتمادًا، ولا فعل بشري
      // في النظام كله يمكنه تحريك هذا الرقم صعودًا أو نزولًا.
      // ⚠️ تنظيف قيم enum DrawingStatus الميتة (INS_VERIFIED/CEO_APPROVED/
      // RELEASED_TO_FACTORY) مؤجَّل بقرار المالك لجلسة تنظيف لاحقة (BL-20) — لا يُمس هنا.
      // ملاحظة لذلك التنظيف: 6 صفوف حيّة تحمل قيمًا ميتة (1 INS_VERIFIED + 5
      // RELEASED_TO_FACTORY) ⇒ سيلزم ترحيل بيانات، لا مجرد إسقاط قيم من الـenum.
      prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);

    // المالية Decimal كامل — التحويل لـ number عند حدود الإرجاع فقط
    const D = Prisma.Decimal;
    const approvedTotalDec = approvedRevenue._sum.total ?? new D(0);
    const collectedDec = paymentsSum._sum.amount ?? new D(0);
    const outstandingDec = approvedTotalDec.sub(collectedDec);

    return {
      kpis: {
        activeCustomers,
        quotationsThisMonth,
        conversionRate,
        mfgInProduction,
        installationsScheduledThisWeek,
        approvedRevenue: approvedTotalDec.toNumber(),
        // دفعة د
        activeProjects,
        overdueMfgOrders,
        overdueInstallations,
        mfgUnderReview,
        totalCollected: collectedDec.toNumber(),
        totalOutstanding: outstandingDec.toNumber(),
      },
      recentQuotations: recentQuotations.map((q) => ({
        id: q.id,
        number: q.number,
        customerName: q.customer.name,
        total: q.total.toNumber(),
        createdAt: q.createdAt.toISOString(),
      })),
      recentMfgOrders: recentMfgOrders.map((o) => ({
        id: o.id,
        number: o.quotation.number,
        customerName: o.quotation.customer.name,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      newCustomersThisWeek: newCustomersThisWeek.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
      })),
      topProducts: topItems.map((item) => ({
        description: item.description,
        count: item._count.description,
      })),
    };
  } catch (error) {
    console.error("[getDashboardKPIs]", error);
    return null;
  }
}

// ── SF-03: تقرير مُجمّع لأسباب رفض العملاء (بيانات backend فقط — الواجهة في موجة
// الداشبورد لاحقًا، لا UI هنا). القراءة لإدارة المبيعات + الأدمن: تحليلات الرفض أداة
// إدارة مبيعات. ⚠️ حدّ بياناتي مُوثَّق: القيمة المخزَّنة في rejectReason نصّ مركَّب
// مترجَم (label[: نص حر]) يُبنى في stage-change-dialog.tsx (buildRejectReason) — وليست
// مفتاح enum بنيويًا؛ لذا التجميع أدناه يتفتّت متى أُلحِق نص حر أو اختلفت لغة العرض.
// العدّ الإجمالي (total) دقيق قطعًا؛ التصنيف النظيف حسب الفئة يحتاج عمود مُهيكل
// (rejectReasonCode) = migration ⇒ SCR منفصل (خارج نطاق Wave B). لا caching (يوافق
// نمط الداشبورد force-dynamic).
export async function getRejectedCustomersReport(): Promise<{
  total: number;
  totalCustomers: number;
  rejectionRate: number;
  byReason: Array<{ reason: string | null; count: number }>;
} | null> {
  try {
    const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
    if (!roleCheck.authorized) return null;

    const [total, totalCustomers, grouped] = await Promise.all([
      prisma.customer.count({ where: { stage: "REJECTED", deletedAt: null } }),
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.customer.groupBy({
        by: ["rejectReason"],
        where: { stage: "REJECTED", deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const rejectionRate =
      totalCustomers > 0 ? (total / totalCustomers) * 100 : 0;

    return {
      total,
      totalCustomers,
      rejectionRate,
      byReason: grouped
        .map((g) => ({ reason: g.rejectReason, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error("[getRejectedCustomersReport]", error);
    return null;
  }
}
