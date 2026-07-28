import { prisma } from "@/lib/prisma";
import { buildWhere } from "./tec";

/**
 * TO-08 — قارئ داشبورد المكتب الفني.
 *
 * 🔴 مبدآن حاكمان:
 *  1. **كل مؤشر له كاتب فعلي في الكود.** لا حقل يُعرض ما لم يكن هناك مسار يكتبه
 *     (درس TO-03: عدّاد `INS_VERIFIED` عرض رقمًا مجمّدًا للإدارة سنة كاملة).
 *     القيم الميتة `INS_VERIFIED`/`CEO_APPROVED`/`RELEASED_TO_FACTORY` (BL-20)
 *     **غير مستعملة هنا إطلاقًا** — حالة الرسمة تُقرأ كـTEC_APPROVED مقابل غيرها.
 *  2. **النطاق من `buildWhere` القائمة** (`tec.ts`) لا من نسخة ثانية.
 *
 * ⚠️ **صفر N+1**: استعلامان فقط لكل تحميل — صفوف مُنطَّقة + عدّ الرسومات
 * المعتمدة دفعة واحدة. كل التجميعات تتم في الذاكرة على نفس الصفوف.
 */

/**
 * TO-08 — أدوار الداشبورد. نفس أدوار `/technical-office` بالضبط: الداشبورد
 * قراءة مُجمَّعة لما تراه تلك الشاشة، فلا يصح أن تفترقا.
 * ⚠️ تعيش هنا لا في `actions.ts`: ملف `"use server"` لا يُصدِّر إلا دوالّ async،
 * وتصدير ثابت منه يكسر البناء (`Failed to collect configuration`) — نفس القيد
 * الذي فرض `quotation-roles.ts` في TO-31.
 */
export const TEC_DASHBOARD_ROLES = [
  "ADMIN",
  "TECHNICAL_OFFICE",
  "TEC_APPROVER",
  "TEC_LEAD",
] as const;

/** مراحل الملف — مشتقّة من `Quotation.leadApprovalStatus` (TO-24) لا من عمود مستقل. */
export type TecStage =
  | "UNASSIGNED"
  | "NOT_SUBMITTED"
  | "PENDING_LEAD"
  | "LEAD_RETURNED"
  | "LEAD_APPROVED"
  | "FINAL_APPROVED";

export interface TecDashboardRow {
  requestId: string;
  code: string;
  customerName: string;
  engineerId: string | null;
  engineerName: string | null;
  route: string;
  quotationId: string | null;
  quotationNumber: string | null;
  stage: TecStage;
  /** أيام الانتظار — تُشتق عند القراءة، لا scheduler في المشروع. */
  waitingDays: number | null;
  /** أيام قرار الليدر (`leadDecidedAt − submittedAt`) — للمكتملة فقط. */
  decisionDays: number | null;
  leadNote: string | null;
  /** TO-40/TO-05: حالة الرسمة — معتمدة فنيًا أو لا. القيم الميتة غير مستعملة. */
  drawing: "approved" | "draft" | "none";
  /** 🔒 مالية — تُقصّ server-side لغير ADMIN قبل الإرسال. */
  value: number | null;
  marginPct: number | null;
}

export interface TecDashboardData {
  rows: TecDashboardRow[];
  /** هل يرى المستخدم المالية؟ يُقرَّر server-side ويُرسل للواجهة لقفل الكرت. */
  canSeeMoney: boolean;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

/**
 * 🔒 TO-08 — المالية لـADMIN وحده في هذه الموجة (قرار المالك).
 * ⚠️ **دور فقط، لا محرّك صلاحيات** — الصلاحيات المرنة بند منفصل (TO-45، BACKLOG).
 */
function canSeeMoneyFor(role: string): boolean {
  return role === "ADMIN";
}

export async function getTecDashboard(
  userId: string,
  role: string,
  filters?: { route?: string; days?: number }
): Promise<TecDashboardData> {
  // النطاق **من المصدر القائم** — نفس ما تراه شاشة `/technical-office` بالضبط.
  const where = await buildWhere(
    userId,
    role,
    filters?.route ? { route: filters.route as never } : undefined
  );

  // 📌 المدة تُطبَّق على `QuotationRequest.createdAt` — تاريخ **دخول الطلب**
  // للمكتب الفني. اخترناه لأنه التاريخ الوحيد الموجود على كل صف بلا استثناء:
  // `submittedAt`/`leadDecidedAt` تنعدم للطلبات التي لم تُقدَّم بعد، فالفلترة
  // بها كانت ستُخفي بالضبط الملفات المتأخرة التي توجد الشاشة لإظهارها.
  if (filters?.days && filters.days > 0) {
    const since = new Date(Date.now() - filters.days * DAY_MS);
    (where as Record<string, unknown>).createdAt = { gte: since };
  }

  const requests = await prisma.quotationRequest.findMany({
    where,
    select: {
      id: true,
      code: true,
      technicalRoute: true,
      createdAt: true,
      engineerId: true,
      engineer: { select: { name: true } },
      customer: { select: { name: true } },
      quotation: {
        select: {
          id: true,
          number: true,
          leadApprovalStatus: true,
          leadNote: true,
          submittedAt: true,
          leadDecidedAt: true,
          reviewStatus: true,
          total: true,
          items: { select: { unitPrice: true, quantity: true, costSnapshot: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // استعلام ثانٍ وأخير: الرسومات المعتمدة فنيًا لكل طلب — `groupBy` واحد لا
  // استعلام لكل صف. (`TEC_APPROVED` هي القيمة الحيّة الوحيدة — BL-20.)
  const drawingGroups = await prisma.drawing.groupBy({
    by: ["quotationRequestId", "status"],
    where: { quotationRequestId: { in: requests.map((r) => r.id) } },
    _count: { _all: true },
  });
  const approvedByRequest = new Set(
    drawingGroups.filter((g) => g.status === "TEC_APPROVED").map((g) => g.quotationRequestId)
  );
  const anyByRequest = new Set(drawingGroups.map((g) => g.quotationRequestId));

  const showMoney = canSeeMoneyFor(role);
  const now = new Date();

  const rows: TecDashboardRow[] = requests.map((r) => {
    const q = r.quotation;

    // 🔴 المرحلة مشتقّة — **مكان واحد** يقرأ منه الكارت والقمع والدرل-داون والجدول
    // (كلها تقرأ `row.stage`)، فلا ثلاثة شروط تنحرف.
    //
    // «بلا إسناد» = **بلا مهندس وبلا عرض سعر معًا** — أي أن العمل لم يبدأ.
    // كان الشرط `!engineerId` وحده يأخذ الأولوية، فيسحب طلبات عليها عروض
    // (منها معتمدة نهائيًا) من خانتها الصحيحة إلى خانة «محتاجة توزيع».
    // الأثر التشغيلي أخطر من الرقم: المدير يضغط الكارت ليوزّع فيجد ملفات
    // منتهية لا تحتاج توزيعًا — رقم يطلب فعلًا غير مطلوب (صنف عيب TO-03).
    // ⇒ أي طلب عليه عرض يُصنَّف **بمرحلته** مهما كان إسناده.
    let stage: TecStage;
    if (!r.engineerId && !q) stage = "UNASSIGNED";
    else if (!q) stage = "NOT_SUBMITTED";
    else if (q.reviewStatus === "APPROVED") stage = "FINAL_APPROVED";
    else if (q.leadApprovalStatus === "PENDING_LEAD") stage = "PENDING_LEAD";
    else if (q.leadApprovalStatus === "LEAD_RETURNED") stage = "LEAD_RETURNED";
    else if (q.leadApprovalStatus === "LEAD_APPROVED") stage = "LEAD_APPROVED";
    else stage = "NOT_SUBMITTED";

    // زمن الانتظار: المُقدَّم ينتظر منذ تقديمه، وغيره منذ دخول الطلب.
    const waitingFrom = q?.submittedAt ?? r.createdAt;
    const waitingDays =
      stage === "FINAL_APPROVED" || stage === "LEAD_APPROVED"
        ? null
        : daysBetween(waitingFrom, now);

    const decisionDays =
      q?.submittedAt && q?.leadDecidedAt ? daysBetween(q.submittedAt, q.leadDecidedAt) : null;

    // 🔒 المالية: تُحسب فقط إن كان الدور يراها — القصّ **قبل الإرسال** لا في
    // الواجهة، فلا تصل الحزمة أرقامًا لا يملكها المستخدم.
    let value: number | null = null;
    let marginPct: number | null = null;
    if (showMoney && q) {
      value = Number(q.total);
      // الهامش من البنود التي **لها تكلفة محفوظة فقط** — بند بلا `costSnapshot`
      // يُستبعَد من البسط والمقام معًا (SCR-020: null ≠ صفر، ولا تُلفَّق تكلفة).
      const priced = q.items.filter((it) => it.costSnapshot !== null);
      if (priced.length > 0) {
        const revenue = priced.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity), 0);
        const cost = priced.reduce((s, it) => s + Number(it.costSnapshot) * Number(it.quantity), 0);
        if (revenue > 0) marginPct = ((revenue - cost) / revenue) * 100;
      }
    }

    return {
      requestId: r.id,
      code: r.code,
      customerName: r.customer.name,
      engineerId: r.engineerId,
      engineerName: r.engineer?.name ?? null,
      route: r.technicalRoute,
      quotationId: q?.id ?? null,
      quotationNumber: q?.number ?? null,
      stage,
      waitingDays,
      decisionDays,
      leadNote: q?.leadApprovalStatus === "LEAD_RETURNED" ? q.leadNote : null,
      drawing: approvedByRequest.has(r.id) ? "approved" : anyByRequest.has(r.id) ? "draft" : "none",
      value,
      marginPct,
    };
  });

  return { rows, canSeeMoney: showMoney };
}
