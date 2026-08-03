import { prisma } from "@/lib/prisma";
import type { QuotationStatus, CustomerSource } from "@prisma/client";
// P0 (4.1): المصدر الواحد لنطاق الرؤية بالدور — تستهلكه القائمة والتفصيل والطباعة.
import { buildQuotationRoleScope } from "@/lib/services/quotation-scope";

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
  // TO-24: حالة الاعتماد المبدئي — المبيعات كانت لا تملك أي تمييز للجاهز عن غيره
  // (مُثبَت في TO-24-DIAG). `isGatedByLead=false` ⇒ عرض بلا طلب، خارج البوابة.
  isGatedByLead: boolean;
  leadApprovalStatus: string;
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
  /**
   * ── P0 (بند 4.1): القاعدة **انتقلت** إلى `lib/services/quotation-scope.ts` ──
   *
   * لم تُكتب هناك من جديد: `BL-196` استخرجها من هنا حرفيًا (شرطًا بشرط) لأن حارس
   * المستندات احتاجها، وملفات P0 كانت محظورة وقتها. فبقيت القاعدة في موضعين مؤقتًا.
   * هذا السطر يُنهي الازدواج: **القائمة والتفصيل والطباعة تقرأ الآن من مصدر واحد.**
   *
   * 🔴 **صفر تغيير سلوك (قيد P0 الأول).** الفروع الثلاثة بقيمها كما كانت، و`null`
   * هو تمثيل حالة «TEC_LEAD بلا مسار» التي كانت `return []` هنا — تُترجم أدناه
   * إلى نفس `[]` بالضبط.
   *
   * ⚠️ `deletedAt: null` يبقى **خارج** الدالة المشتركة عمدًا: هو بُعد ثانٍ (ماذا
   * يبقى مقروءًا) لا يخصّ النطاق (مَن يرى). بعد قرار `BL-197` صار المستدعون
   * الثلاثة يضمّونه كلٌّ في موضعه — والفصل هو ما يسمح لأحد البُعدين أن يتغيّر وحده.
   */
  const scope = await buildQuotationRoleScope(userId, role);
  if (scope === null) return [];
  const where: Record<string, unknown> = { deletedAt: null, ...scope };

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
      leadApprovalStatus: true,
      // TO-24: وجود الطلب فقط — بلا حقول إضافية، استعلام واحد كما هو.
      quotationRequest: { select: { id: true } },
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
    isGatedByLead: Boolean(q.quotationRequest),
    leadApprovalStatus: q.leadApprovalStatus,
  }));
}
