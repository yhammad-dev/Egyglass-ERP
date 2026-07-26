import { prisma } from "@/lib/prisma";
import type { QuotationStatus, CustomerSource } from "@prisma/client";

// ── Status Bucket ────────────────────────────────────

export type StatusBucket = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "EXPIRED";

export const STATUS_BUCKET_I18N: Record<StatusBucket, string> = {
  NEW: "quotations.statusBucket_NEW",
  IN_PROGRESS: "quotations.statusBucket_IN_PROGRESS",
  ON_HOLD: "quotations.statusBucket_ON_HOLD",
  COMPLETED: "quotations.statusBucket_COMPLETED",
  EXPIRED: "quotations.statusBucket_EXPIRED",
};

/**
 * Pure function — maps QuotationStatus → display bucket.
 * DRAFT → NEW | SENT → IN_PROGRESS | PENDING_APPROVAL → ON_HOLD |
 * APPROVED → COMPLETED | EXPIRED → EXPIRED
 */
export function mapStatusToBucket(status: QuotationStatus): StatusBucket {
  const map: Record<QuotationStatus, StatusBucket> = {
    DRAFT: "NEW",
    SENT: "IN_PROGRESS",
    PENDING_APPROVAL: "ON_HOLD",
    APPROVED: "COMPLETED",
    EXPIRED: "EXPIRED",
  };
  return map[status];
}

// ── Row type ─────────────────────────────────────────

export interface QuotationRow {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  source: CustomerSource;
  statusBucket: StatusBucket;
  total: number;
  createdAt: Date;
  technicalEngineer: string | null;
  salesResponsible: string | null;
  inspectionsResponsible: string | null; // always null — no Quotation→Inspection link exists
  // TO-23: آخر مُعدِّل — الاسم فقط + التاريخ. التفاصيل الكاملة تبقى في ActivityLog.
  // null = لم يُعدَّل بعد إنشائه (أو عُدِّل قبل نزول العمود) — ليس «غير معروف» ولا يُلفَّق.
  lastUpdatedBy: string | null;
  lastUpdatedAt: Date;
}

// ── Fetch ────────────────────────────────────────────

/**
 * TO-23 — نطاق الرؤية بالدور. النمط مأخوذ حرفيًا من فرع `SALES_REP` القائم
 * (فلتر على `where`، لا دالة ثانية ولا تصفية بعد الجلب).
 *
 * | الدور              | ما يراه                                                    |
 * |--------------------|------------------------------------------------------------|
 * | SALES_REP          | كما كان حرفيًا — **لم يُمس** (عروضه + عملاؤه)               |
 * | TECHNICAL_OFFICE   | عروضه هو فقط (`createdById`)                                |
 * | TEC_LEAD           | عروض مساره عبر `QuotationRequest.technicalRoute`            |
 * | ADMIN · TEC_APPROVER · SALES_MANAGER · VIEWER | الكل (بلا فلتر) — كما كان |
 *
 * 🔴 **قرار: العرض غير المرتبط بطلب لا يراه TEC_LEAD** (فلتر العلاقة `quotationRequest`
 * يستبعد من لا طلب له). السبب: مسار العرض **غير معروف** بلا طلب، ولا يوجد في السكيما
 * أي رابط فريق (`User` بلا `teamLeadId`) يسمح بنسبته لتيم ليدر. نسبته لأحدهما تخمين،
 * وإظهاره للاثنين تسريب عمل المسار الآخر ⇒ **فشل مغلق**، نفس مبدأ `leadRoute = null`.
 * ⚠️ أثر معلوم: عرض يُنشأ مباشرة من `/quotations/new` بلا طلب (مثل Q-2026-00028)
 * لا يراه أي تيم ليدر — يراه منشئه (TECHNICAL_OFFICE) وADMIN وTEC_APPROVER. مسجَّل
 * كبند مفتوح في التقرير.
 */
export async function getQuotations(
  userId: string,
  role: string,
): Promise<QuotationRow[]> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (role === "SALES_REP") {
    where.OR = [
      { createdById: userId },
      { customer: { ownerId: userId } },
    ];
  } else if (role === "TECHNICAL_OFFICE") {
    where.createdById = userId;
  } else if (role === "TEC_LEAD") {
    // `leadRoute` ليس في الجلسة (rbac.ts:28-32 يُرجع userId/role فقط) — يُقرأ هنا.
    const lead = await prisma.user.findUnique({
      where: { id: userId },
      select: { leadRoute: true },
    });
    // بلا مسار مُسنَد ⇒ صفر عرض. الرجوع بلا فلتر هنا كان يعني «يرى الكل» — عكس المقصود.
    if (!lead?.leadRoute) return [];
    where.quotationRequest = { technicalRoute: lead.leadRoute };
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      updatedById: true,
      createdBy: { select: { name: true } },
      customer: {
        select: {
          name: true,
          phone: true,
          source: true,
          owner: { select: { name: true } },
        },
      },
    },
  });

  // TO-23: `updatedById` عمود scalar بلا relation (SCR-021 — نفس نمط approvedById).
  // استعلام **واحد** لكل الصفوف، لا استعلام لكل صف.
  const updaterIds = [
    ...new Set(quotations.map((q) => q.updatedById).filter((id): id is string => Boolean(id))),
  ];
  const updaters = updaterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: updaterIds } },
        select: { id: true, name: true },
      })
    : [];
  const updaterNameById = new Map(updaters.map((u) => [u.id, u.name]));

  return quotations.map((q) => ({
    id: q.id,
    number: q.number,
    customerName: q.customer.name,
    customerPhone: q.customer.phone,
    source: q.customer.source as CustomerSource,
    statusBucket: mapStatusToBucket(q.status as QuotationStatus),
    total: Number(q.total),
    createdAt: q.createdAt,
    technicalEngineer: q.createdBy?.name ?? null,
    salesResponsible: q.customer.owner?.name ?? null,
    inspectionsResponsible: null,
    lastUpdatedBy: q.updatedById ? (updaterNameById.get(q.updatedById) ?? null) : null,
    lastUpdatedAt: q.updatedAt,
  }));
}
