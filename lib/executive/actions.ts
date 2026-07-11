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
      drawingsAwaitingCeo,
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
      prisma.drawing.count({ where: { status: "INS_VERIFIED" } }),
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
        drawingsAwaitingCeo,
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
