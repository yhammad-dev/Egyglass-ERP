import { prisma } from "@/lib/prisma";
import type { TecJobStatus, TechnicalRoute, ReviewStatus } from "@prisma/client";

export interface DrawingRow {
  id: string;
  category: string;
  fileType: string;
  filename: string;
  originalName: string;
  url: string;
  sizeBytes: number;
  label: string | null;
  notes: string | null;
  revision: string | null;
  uploadedByName: string;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  status: string;
}

export interface TecJobRow {
  id: string;
  code: string;
  status: TecJobStatus;
  technicalRoute: TechnicalRoute;
  summary: string | null;
  customerName: string;
  customerId: string;
  quotationId: string | null;
  quotationNumber: string | null;
  // TO-09: حالة مراجعة العرض (Quotation.reviewStatus) — بلا هذين الحقلين لا يرى
  // المكتب الفني أن عرضه مُرجَع: /review/[id] محروسة ["ADMIN","TEC_APPROVER"]
  // و /quotations/[id] لا تقرأ reviewStatus أصلًا. null = لا عرض بعد.
  reviewStatus: ReviewStatus | null;
  reviewNote: string | null;
  engineerName: string | null;
  engineerId: string | null;
  salesOwnerName: string | null;
  inspectionOwnerName: string | null;
  drawingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TecJobDetail extends TecJobRow {
  notes: string | null;
  // TO-09: منشئ العرض — تُستعمل حصرًا لمرآة حارس resubmitQuotationAction في الواجهة
  // (المنشئ أو TECHNICAL_OFFICE أو ADMIN). بدونها لا يُميَّز TEC_APPROVER المنشئ عن
  // غيره فيظهر له زر يرفضه الأكشن، أو يُخفى عمّن يملكه. الحارس النافذ server-side.
  quotationCreatedById: string | null;
  inspectionRequestId: string | null;
  hasContract: boolean;
  hasPayment: boolean;
  hasManufacturingOrder: boolean;
  drawings: DrawingRow[];
}

export interface TecFilters {
  route?: TechnicalRoute;
  status?: TecJobStatus;
  search?: string;
}

export interface EngineerOption {
  id: string;
  name: string;
}

/**
 * TO-25: `buildWhere` صارت غير متزامنة لأن نطاق TEC_LEAD يحتاج قراءة `leadRoute`
 * من القاعدة (الجلسة تحمل userId/role فقط — `src/lib/rbac.ts:28-32`). نفس السبب
 * والنمط في `getQuotations` (TO-23).
 */
// TO-08: صار مُصدَّرًا ليستعمله داشبورد المكتب الفني **نفس** قاعدة النطاق.
// نسخة ثانية من النطاق = انحراف مؤجَّل: أي تعديل مستقبلي على نطاق دور واحد
// كان سيسري على الشاشة دون الداشبورد فيعرضان رقمين مختلفين للحقيقة نفسها.
export async function buildWhere(userId: string, role: string, filters?: TecFilters) {
  const where: Record<string, any> = { deletedAt: null };

  const and: Record<string, any>[] = [];

  if (role === "TECHNICAL_OFFICE") {
    // دفعة هـ: المهندس يرى طلباته + الطلبات غير المُسنَدة (كي يلتقطها/يوزّعها المدير)
    //
    // 🔴 TO-30 — الشق الثاني كان **بلا فلتر مسار**، فكل مهندس يرى (ويسعّر) كل
    // الطلبات غير المُسنَدة من كل المسارات. أثره المُثبَت ميدانيًا: مهندس تابع
    // لتيم ليدر سوشيال سعّر طلب مشروعات (Q-2026-00034)، فذهب الإشعار لتيم ليدره
    // الذي لا يملك اعتماده (`canDecide` يطابق المسار) ⇒ عرض عالق بلا معتمِد.
    // القاعدة النافذة (قرار المالك): **مسار المهندس = مسار تيم ليدره**.
    const engineer = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamLead: { select: { leadRoute: true } } },
    });
    const engineerRoute = engineer?.teamLead?.leadRoute ?? null;

    if (engineerRoute) {
      and.push({
        OR: [
          // ⚠️ المُسنَد إليه يبقى مرئيًا **بلا فلتر مسار** عمدًا: لو أُسند له طلب
          // من مسار آخر (بقرار مدير مثلًا) فإخفاؤه يُضيّع شغلًا قائمًا من أمامه
          // بلا أي إشعار. الفلترة تخصّ الالتقاط الجديد لا العمل الجاري.
          { engineerId: userId },
          { engineerId: null, technicalRoute: engineerRoute },
        ],
      });
    } else {
      // مهندس بلا تيم ليدر ⇒ **لا مسار يمكن اشتقاقه**، فلا أساس للفلترة.
      // السلوك يبقى كما كان (يرى كل غير المُسنَد) — لأن البديل (لا يرى شيئًا)
      // يشلّ 3 من 4 مهندسين في القاعدة اليوم. الثغرة تبقى مفتوحة لهم **حتى
      // يُربطوا بتيم ليدر من /users**، وتُسجَّل هنا كي تكون مرئية لا صامتة.
      console.warn(
        `[tec] ENGINEER_WITHOUT_TEAM_LEAD userId=${userId} — نطاق المسار غير مُطبَّق (يرى كل الطلبات غير المُسنَدة)`
      );
      and.push({ OR: [{ engineerId: userId }, { engineerId: null }] });
    }
  }

  if (role === "TEC_LEAD") {
    // TO-25: التيم ليدر يرى **طلبات مساره فقط** — لا كل الطلبات ولا المسند إليه وحده،
    // فهو يوزّع ما يرد على مساره. `technicalRoute` حقل إلزامي على QuotationRequest
    // (@default(PROJECTS)) ⇒ لا طلب بلا مسار، فلا حالة «غير معروف» هنا.
    const lead = await prisma.user.findUnique({
      where: { id: userId },
      select: { leadRoute: true },
    });
    // بلا مسار مُسنَد ⇒ صفر طلب (فشل مغلق — نفس قاعدة TO-23 حرفيًا).
    // `false` مستحيلة التحقق ⇒ نتيجة فارغة مضمونة بلا تعطيل بقية الفلاتر.
    if (!lead?.leadRoute) {
      and.push({ id: { in: [] } });
    } else {
      and.push({ technicalRoute: lead.leadRoute });
    }
  }

  if (filters?.route) where.technicalRoute = filters.route;
  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    and.push({
      OR: [
        { code: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      ],
    });
  }

  if (and.length) where.AND = and;

  return where;
}

export async function getTecJobs(
  userId: string,
  role: string,
  filters?: TecFilters
): Promise<TecJobRow[]> {
  const where = await buildWhere(userId, role, filters);

  const jobs = await prisma.quotationRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      // TO-09: توسيع الـselect القائم — بلا استعلام إضافي
      quotation: {
        select: { id: true, number: true, reviewStatus: true, reviewNote: true },
      },
      engineer: { select: { id: true, name: true } },
      salesOwner: { select: { name: true } },
      inspectionOwner: { select: { name: true } },
      _count: { select: { drawings: true } },
    },
  });

  return jobs.map((j) => ({
    id: j.id,
    code: j.code,
    status: j.status,
    technicalRoute: j.technicalRoute,
    summary: j.summary,
    customerName: j.customer.name,
    customerId: j.customer.id,
    quotationId: j.quotation?.id ?? null,
    quotationNumber: j.quotation?.number ?? null,
    reviewStatus: j.quotation?.reviewStatus ?? null,
    reviewNote: j.quotation?.reviewNote ?? null,
    engineerName: j.engineer?.name ?? null,
    engineerId: j.engineer?.id ?? null,
    salesOwnerName: j.salesOwner?.name ?? null,
    inspectionOwnerName: j.inspectionOwner?.name ?? null,
    drawingsCount: j._count.drawings,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  }));
}

export async function getTecJobDetail(
  id: string,
  userId: string,
  role: string
): Promise<TecJobDetail | null> {
  const where = await buildWhere(userId, role);
  where.id = id;

  const job = await prisma.quotationRequest.findFirst({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      quotation: {
        select: {
          id: true,
          number: true,
          // TO-09: حالة المراجعة + سببها + المنشئ — توسيع الـselect القائم بلا استعلام إضافي
          reviewStatus: true,
          reviewNote: true,
          createdById: true,
          // PHASE 2 (BL-32/44): بيانات حارس إصدار أمر التصنيع (عقد + دفعة + أمر سابق)
          contract: { select: { id: true } },
          _count: { select: { payments: true } },
          manufacturingOrders: {
            where: { parentOrderId: null },
            select: { id: true },
          },
        },
      },
      engineer: { select: { id: true, name: true } },
      salesOwner: { select: { name: true } },
      inspectionOwner: { select: { name: true } },
      _count: { select: { drawings: true } },
      drawings: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    code: job.code,
    status: job.status,
    technicalRoute: job.technicalRoute,
    summary: job.summary,
    notes: job.notes,
    customerName: job.customer.name,
    customerId: job.customer.id,
    quotationId: job.quotation?.id ?? null,
    quotationNumber: job.quotation?.number ?? null,
    reviewStatus: job.quotation?.reviewStatus ?? null,
    reviewNote: job.quotation?.reviewNote ?? null,
    quotationCreatedById: job.quotation?.createdById ?? null,
    hasContract: !!job.quotation?.contract,
    hasPayment: (job.quotation?._count.payments ?? 0) > 0,
    hasManufacturingOrder: (job.quotation?.manufacturingOrders.length ?? 0) > 0,
    engineerName: job.engineer?.name ?? null,
    engineerId: job.engineer?.id ?? null,
    salesOwnerName: job.salesOwner?.name ?? null,
    inspectionOwnerName: job.inspectionOwner?.name ?? null,
    inspectionRequestId: job.inspectionRequestId,
    drawingsCount: job._count.drawings,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    drawings: job.drawings.map((d) => ({
      id: d.id,
      category: d.category,
      fileType: d.fileType,
      filename: d.filename,
      originalName: d.originalName,
      url: d.url,
      sizeBytes: d.sizeBytes,
      label: d.label,
      notes: d.notes,
      revision: d.revision,
      uploadedByName: d.uploadedBy.name,
      approvedByName: d.approvedBy?.name ?? null,
      approvedAt: d.approvedAt,
      createdAt: d.createdAt,
      status: d.status,
    })),
  };
}

/**
 * TO-25 — قائمة الإسناد مُنطَّقة بالدور:
 * - `TEC_LEAD` → **مهندسوه فقط** (`teamLeadId = userId`).
 * - `ADMIN` / `TEC_APPROVER` → كل المهندسين (كما كان حرفيًا).
 *
 * ⚠️ هذه واجهة عرض لا حارس. القيد النافذ في `assignEngineerAction` (server-side):
 * إسناد لمهندس خارج الفريق يُرفض حتى لو زُوِّر الطلب بلا مرور بالقائمة.
 * الوسيطان **إلزاميان** لا اختياريان — مستدعٍ ينسى التمرير = خطأ بناء لا قائمة مفتوحة.
 */
export async function getEngineers(
  userId: string,
  role: string
): Promise<EngineerOption[]> {
  const where: Record<string, any> = {
    role: "TECHNICAL_OFFICE",
    isActive: true,
    deletedAt: null,
  };

  if (role === "TEC_LEAD") where.teamLeadId = userId;

  return prisma.user.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * TO-25 — هل يملك هذا المستخدم إسناد هذا المهندس؟ مصدر واحد للقاعدة يستعمله
 * `assignEngineerAction`. TEC_LEAD مقيَّد بفريقه؛ ADMIN/TEC_APPROVER بلا قيد.
 */
export async function canAssignEngineer(
  actorId: string,
  actorRole: string,
  engineerId: string
): Promise<boolean> {
  const engineer = await prisma.user.findUnique({
    where: { id: engineerId },
    select: { role: true, isActive: true, deletedAt: true, teamLeadId: true },
  });

  // المهندس يجب أن يكون مكتبًا فنيًا نشطًا — يمنع إسناد الطلب لأي دور آخر.
  if (!engineer || engineer.role !== "TECHNICAL_OFFICE") return false;
  if (!engineer.isActive || engineer.deletedAt) return false;

  if (actorRole === "TEC_LEAD") return engineer.teamLeadId === actorId;
  return true;
}
