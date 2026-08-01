import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import {
  recomputeQuotationRequestStatus,
  recomputeCustomerStage,
} from "@/lib/services/status-derivation";
// SCR-INS-I (C2-fix): تصنيف الحالات من ملف الأوراق — يقطع الدورة مع status-derivation
import {
  NEVER_OVERDUE_STATUSES,
  TERMINAL_INSPECTION_STATUSES,
  isTerminalInspectionStatus,
} from "@/lib/services/inspection-status";
// SCR-INS-C (C3): نقطة القراءة الموحدة لإعدادات النظام — لا `findUnique` محلي (bdc873a)
import { getSystemSettings } from "@/lib/config";
// D-IN-24: تقويم العمل بتوقيت القاهرة — المصدر الوحيد للمنطقة الزمنية في النظام
import { cairoWeekday, cairoDateKey, endOfCairoDay } from "@/lib/format/dates";

// D-31 (BL-91): خطأ مُوجَّه حين لا يكون الطلب المختار مؤهَّلًا للربط
export class InspectionError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "InspectionError";
  }
}

/**
 * ✅ BL-160 (موجة C2): القيم الثلاث للعمود `SiteReadiness`. مصدر واحد يستهلكه
 * النوعان أدناه والواجهة — لا نسخة نصّية في كل ملف (علّة IN-12).
 */
export type SiteReadinessValue = "READY" | "NOT_READY" | "UNCONFIRMED";

export interface InspectionRow {
  id: string;
  customerId: string;
  customerName: string;
  location: string;
  address: string;
  phone: string;
  notes: string | null;
  status: string;
  type: string;
  scheduledAt: Date | null;
  /**
   * SCR-INS-B2 (موجة C1): **nullable الآن** — `null` = لم تُجدوَل بعد فلا مهلة تنفيذ.
   * كان العمود يحمل دلالتين في واحدة: «مهلة جدولة» عند الإنشاء ثم «مهلة تنفيذ» بعدها.
   */
  dueDate: Date | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  /** أيام كسرية حتى `dueDate` — سالب = فات الموعد. `null` = لا مهلة (غير مجدولة). */
  daysRemaining: number | null;
  /** 'OVERDUE' when dueDate < now and status !== DONE; otherwise the DB status */
  effectiveStatus: string;
  /**
   * IN-28: بُعد الاعتماد لازم في القائمة لتعكس الواجهة حارس `scheduleInspection`
   * (يرفض الكتابة بعد APPROVED) — بدونه كان زر إعادة التعيين يظهر ثم يفشل.
   */
  approvalStatus: string;
  /**
   * IN-48: تحذير «الموقع غير جاهز» في نموذج الجدولة — المدير يستهلك لا يُدخل.
   * ✅ BL-160 (C2): ثلاثي صريح. `null` = **لم يُسأل** (صفّ تاريخي) — قيمة رابعة
   * ذات معنى، لا تُطوى في `UNCONFIRMED`.
   */
  siteReadiness: SiteReadinessValue | null;
  /** SCR-INS-A: حكم المطابقة في عمود القائمة. `null` = لم يُعلَن بعد. */
  matchResult: string | null;
  /**
   * D-IN-24: تعارض جدول المندوب — **تحذير لا حجب**، فيُعاد **مع الصفّ الناجح**
   * لا كخطأ. الجدولة تمّت، والمدير يقرأ التنبيه ويقرّر.
   * فارغة = لا تعارض. تُملأ من `scheduleInspection` وحدها.
   */
  scheduleConflicts?: { customerName: string; scheduledAt: Date }[];
}

export interface UserOption {
  id: string;
  name: string;
}

/**
 * ✅ SCR-INS-C (موجة C3) — **خرق L-15 مُغلق: المهلة صارت في الإعدادات.**
 *
 * كان الرقمان صلبين في الكود، فتعديل المهلة يستلزم كودًا ونشرًا — وعمرو لا يملكهما.
 * الآن يُقرآن من `SystemSettings.inspectionSlaInsideDays/OutsideDays`.
 *
 * 🔴 **هذان يبقيان `fallback` لا أكثر** — يُستعملان **فقط** إن كان الـsingleton مفقودًا
 * (قاعدة جديدة قبل البذر · فشل قراءة). البديل — رمي خطأ — كان سيمنع الجدولة كليًا
 * بسبب إعداد، وهو أسوأ من مهلة افتراضية صحيحة. والقيمتان **مطابقتان للـdefault في
 * الschema** فلا ينشأ سلوكان.
 */
const INSIDE_CAIRO_DAYS_FALLBACK = 2;
const OUTSIDE_CAIRO_DAYS_FALLBACK = 4;

/**
 * IN-17 (موجة B3) — **المصدر الوحيد** لاشتقاق حالة التأخير.
 *
 * العيب: الشرط كان منسوخًا **ثلاث مرات داخل هذا الملف وحده** (`getInspections` ·
 * `createInspection` · `scheduleInspection`)، و**غائبًا تمامًا** عن شاشة التفاصيل
 * وملف العميل ⇒ نفس المعاينة تظهر «متأخرة» في القائمة و«مجدولة» في تفاصيلها.
 * نسختان من قاعدة = انحراف مؤجَّل (علّة IN-12 بالحرف).
 *
 * 🔴 **عرضٌ فقط — لا تُكتب في القاعدة أبدًا** (IN-07): `OVERDUE` محذوفة من القيم
 * المقبولة من العميل، وكتابتها تُنتج صفًّا محبوسًا يختفي عنه زر الجدولة. الحقيقة
 * المخزَّنة تبقى `status`، والتأخير يُحسب عند كل قراءة من `dueDate`.
 *
 * التوقيع **مُعمَّم** (`T extends string`) لا `string` خامًا: التوسيع إلى `string`
 * كان يُسقط نوع `InspectionStatus` عند حدّ الـDTO فيلزم `as` لإسكات المترجم — وهو
 * محظور (Definition of Done). بهذا الشكل يُحفظ اتحاد الـenum: الداخل
 * `InspectionStatus` يخرج `InspectionStatus` (و`OVERDUE` أحد قيمه أصلًا،
 * `prisma/schema.prisma:722-727`).
 *
 * 🔴 **SCR-INS-B2 — `null` لا يعني متأخرًا.** بعد أن صار `dueDate` nullable، `null`
 * يعني «لم تُجدوَل بعد فلا مهلة»، والمعاينة بلا مهلة **لا يمكن أن تتجاوزها**.
 * الفحص صريح (`dueDate !== null`) لا اتّكال على أن `null < Date` تعطي `false` صدفةً —
 * السلوك الصامت الصحيح بالمصادفة هو أخطر من الخاطئ الظاهر. ترك هذا الفرع بلا معالجة
 * كان سيُظهر **كل معاينة جديدة «متأخرة»** = عيب IN-09 عائدًا بالحرف.
 *
 * 🔴 **SCR-INS-D (موجة C2) — `POSTPONED` لا تتأخر.** التأجيل مصدره **العميل**
 * (الحقيقة 1 من نصّ حسن)، فاحتسابه تأخيرًا يُحمِّل القسمَ قرارَ عميلٍ لا يملكه —
 * ومؤشر SLA المبني على ذلك يقيس شيئًا غير الأداء. الاستثناء صار قيمتين لا واحدة.
 *
 * 🔴 **SCR-INS-I (موجة C2-fix) — `CANCELLED` لا تتأخر.** الإلغاء قرار العميل
 * (D-IN-20: خروج من الصفقة)، ومعاينة لن تُنفَّذ لا معنى لقياس تأخيرها.
 *
 * التصنيف نفسه انتقل إلى `services/inspection-status.ts` — ملف أوراق بلا تبعيات،
 * لأن وضعه هنا كان يُنتج استيرادًا دائريًا مع `status-derivation.ts`.
 */

export function deriveEffectiveStatus<T extends string>(
  dueDate: Date | null,
  status: T
): T | "OVERDUE" {
  if (dueDate === null) return status;
  return dueDate < new Date() && !NEVER_OVERDUE_STATUSES.includes(status)
    ? "OVERDUE"
    : status;
}

/**
 * SCR-INS-B2: الأيام المتبقية — `null` عند غياب المهلة.
 * الطرح من `null` كان يُنتج **`NaN` صامتًا** يتسرّب للواجهة كرقم بلا معنى.
 */
function computeDaysRemaining(dueDate: Date | null): number | null {
  if (dueDate === null) return null;
  return (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

/**
 * ✅ BL-160 (موجة C2) — **`SITE_READINESS_GATE_FROM` حُذف.**
 *
 * كان ثابتًا زمنيًا صلبًا (`2026-07-30`) يميّز «صفّ قديم بلا قيمة» عن «جديد اختار:
 * لم يؤكّد العميل» — **بالتاريخ لا بالبيانات**، لأن العمود البولياني كان يطوي
 * الحالتين في `null` واحدة. وكان يتّسع كل يوم يتأخر فيه الدمج، ويحتاج ضبطًا يدويًا
 * قبل كل دفع.
 *
 * بعد تحويل العمود إلى `SiteReadiness` enum صار التمييز **في البيانات نفسها**:
 * `UNCONFIRMED` = سُئل العميل ولم يؤكّد (تحجب الجدولة) · `null` = لم يُسأل أصلًا
 * (صفّ تاريخي، لا تحجب). فسقط الحدّ الزمني وسقط معه الضبط اليدوي.
 */

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    // Friday is 5 in JS getDay()
    if (result.getDay() !== 5) {
      added++;
    }
  }
  return result;
}

/**
 * IN-09 — مهلة **التنفيذ** تُقاس من يوم الجدولة لا من لحظة الطلب.
 *
 * 🔴 العيب المُصلَح (لقطة D19): `computeDueDate` كانت تُستدعى مرة واحدة داخل
 * `createInspection` وتحسب من `new Date()`، فمعاينة أُنشئت وجُدولت في نفس الجلسة
 * ظهر لها «موعد المعاينة» و«تاريخ الاستحقاق» **بنفس اليوم** ⇒ صفر أيام سماح
 * للزيارة ورفع التقرير. المهلة كانت تُقاس من لحظة الطلب لا من لحظة الالتزام بالموعد.
 *
 * القاعدة: البداية = **اليوم التالي** ليوم الجدولة، وذلك اليوم يُحتسب أول أيام
 * المهلة. مُتحقَّق عدديًا ضد مثال حسن: جدولة الجمعة 2026-07-31 ⇒ استحقاق
 * الأحد 2026-08-02 (السبت 01-08 = اليوم الأول، الأحد 02-08 = الثاني).
 * والجمعة تُستثنى: جدولة الخميس 06-08 ⇒ استحقاق الأحد 09-08 (تُقفز الجمعة 07-08).
 *
 * ⚠️ فارق موثَّق في التكليف: النصّ يقول «يوم الجدولة + 3» والمثال يقول 02-08 (+2).
 * نُفِّذ **المثال** لأنه الأثر الملموس من حسن. يُراجَع إن كان النصّ هو المقصود.
 *
 * ✅ **SCR-INS-C (موجة C3): الدالة صارت `async`** لأن المهلة تُقرأ من الإعدادات.
 * 🔴 **القراءة عند كل حساب لا في متغيّر وحدة** — `getSystemSettings()` بلا caching
 * (كل الصفحات `force-dynamic`)، فتعديل عمرو ينفذ فورًا بلا إعادة تشغيل الحاوية.
 * ⚠️ **البديل المرفوض:** تمرير المهلة كوسيطين من المستدعي — كان يوزّع قراءة الإعدادات
 * على كل مستدعٍ مستقبلي فتنحرف النسخ (علّة IN-12). المستدعي واحد اليوم
 * (`scheduleInspection`) وهو `async` أصلًا ⇒ الكلفة `await` واحد.
 */
async function computeDueDate(location: string, scheduledAt: Date): Promise<Date> {
  const settings = await getSystemSettings();
  const days =
    location === "OUTSIDE_CAIRO"
      ? settings?.inspectionSlaOutsideDays ?? OUTSIDE_CAIRO_DAYS_FALLBACK
      : settings?.inspectionSlaInsideDays ?? INSIDE_CAIRO_DAYS_FALLBACK;
  const cursor = new Date(scheduledAt);
  /**
   * 🔴 **D-IN-24 — يوم الأسبوع يُقرأ بتوقيت القاهرة لا UTC.**
   *
   * تعليق IN-09 الأصلي (المحذوف هنا) كان صحيحًا **لعالمه**: `scheduledAt` كان
   * يأتي من `<input type="date">` كتاريخ مجرَّد بمنتصف ليل UTC، فقراءة اليوم بـUTC
   * كانت الخيار المستقر ضد منطقة النشر. **وقد سقط ذلك الافتراض:** الموعد صار يحمل
   * وقتًا حقيقيًا، فـ`getUTCDay()` يقرأ يومًا غير الذي يعيشه المستخدم.
   *
   * ⚠️ **مُثبَت لا مفترض:** `2026-08-06T22:00Z` = **الخميس** بـUTC و**الجمعة**
   * بالقاهرة. فموعد الخميس مساءً كان سيُقفَز كأنه عطلة، ويُمنح المندوب يومًا زائدًا
   * بلا سبب — عكس عيب «يوم السماح الضائع» الذي عالجه IN-09 وبنفس فئته.
   *
   * **الخطو يبقى بـUTC** (`setUTCDate(+1)` = 24 ساعة بالضبط، فيحافظ على ساعة
   * الحائط القاهرية)، **والقراءة وحدها** انتقلت — أقل تغيير يُصلح العيب.
   * ومصدر المنطقة الزمنية واحد (`lib/format/dates.ts`) لا نسخة هنا (علّة IN-12).
   */
  cursor.setUTCDate(cursor.getUTCDate() + 1); // اليوم التالي ليوم الجدولة
  let counted = 0;
  for (;;) {
    if (cairoWeekday(cursor) !== 5) counted++; // الجمعة وحدها ليست يوم عمل
    if (counted >= days) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  /**
   * 🔴 **آخر اللحظة لا أولها** (IN-09): بلا ختم اليوم يبقى الاستحقاق منتصف ليله،
   * فيشتقّ `effectiveStatus` حالة `OVERDUE` **مع بداية آخر يوم مسموح** ⇒ المندوب
   * يخسر اليوم الذي منحته له القاعدة.
   *
   * ✅ **D-IN-25 (قرار يوسف): الختم بتوقيت القاهرة لا UTC.**
   * كان `setUTCHours(23,59,59,999)` — و`23:59:59 UTC` = **02:59:59 بالقاهرة من
   * اليوم التالي** ⇒ ثلاث ساعات إضافية صامتة لا يقصدها أحد. الختم الآن في وحدة
   * التواريخ (مصدر واحد للمنطقة الزمنية) لا مكرَّرًا هنا.
   *
   * ⚠️ **أثر رجعي معلَن (BL-181):** الصفوف القائمة تحتفظ بختمها القديم — الحساب
   * الجديد يسري على الجدولات الجديدة وحدها. لا تعديل بيانات لم يُطلب.
   */
  return endOfCairoDay(cursor);
}

/**
 * BL-94 (نطاق جزئي): INSPECTION_REP يرى المعاينات المسندة إليه فقط — نفس
 * تضييق الملكية المفروض في getInspectionDetail. لا توسيع لأي دور آخر:
 * ADMIN/INSPECTION_MANAGER يريان الكل كما كانا (المدير يوزّع فيلزمه الكل).
 *
 * IN-12: صار مُستخرَجًا ليستعمله عدّاد الداشبورد **نفس** قاعدة النطاق.
 * نسخة ثانية من النطاق = انحراف مؤجَّل: الداشبورد كان يعدّ بلا تضييق وبلا
 * `deletedAt` فيعرض للمندوب رقمًا (20) يناقض قائمته (2) على الشاشة نفسها.
 * (نفس علّة TO-08 في `buildWhere` بالمكتب الفني وبنفس علاجها.)
 */
function buildInspectionScope(
  userId: string,
  role: string
): Prisma.InspectionRequestWhereInput {
  const where: Prisma.InspectionRequestWhereInput = { deletedAt: null };
  if (role === "INSPECTION_REP") {
    where.assigneeId = userId;
  }
  return where;
}

/**
 * IN-12: أدوار عدّاد المعاينات على الداشبورد. الأدوار غير المعنية
 * (ACCOUNTING · VIEWER · PROCUREMENT · HR · PROJECTS …) لا ترى العدّاد إطلاقًا.
 * SALES_REP/SALES_MANAGER لهما فرعهما الخاص (getSalesDashboard) ولا يصلان هنا.
 */
const INSPECTION_KPI_ROLES = ["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"];

/**
 * IN-12: عدّاد «معاينات معلّقة» للداشبورد — محروس ومُنطَّق ومُصفّى.
 * `null` = هذا الدور لا يرى العدّاد (نفس عقد `getDashboardKPIs`/`getSalesDashboard`:
 * الحارس داخل دالة البيانات لا على الصفحة، لأن `/dashboard` مشتركة بين كل الأدوار).
 */
export async function getPendingInspectionsCount(): Promise<number | null> {
  const auth = await requireRole(INSPECTION_KPI_ROLES);
  if (!auth.authorized) return null;

  return prisma.inspectionRequest.count({
    where: {
      ...buildInspectionScope(auth.userId, auth.role),
      // SCR-INS-I (C2-fix): الملغاة **ليست معلّقة** — عدّ يشملها يبالغ في حمل القسم
      // بمعاينات لن تُنفَّذ. `POSTPONED` تبقى معدودة عمدًا (تُستأنف، ليست نهائية).
      status: { notIn: [...TERMINAL_INSPECTION_STATUSES] },
    },
  });
}

export async function getInspections(
  userId: string,
  role: string
): Promise<InspectionRow[]> {
  const where = buildInspectionScope(userId, role);

  const inspections = await prisma.inspectionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  return inspections.map((ins) => {
    // SCR-INS-B2: الحساب مشترك ويحتمل null — لا طرح مباشر (NaN صامت)
    const daysRemaining = computeDaysRemaining(ins.dueDate);
    // IN-17: الدالة المشتركة — لا نسخة محلية من الشرط
    const effectiveStatus = deriveEffectiveStatus(ins.dueDate, ins.status);
    return {
      id: ins.id,
      customerId: ins.customerId,
      customerName: ins.customer.name,
      location: ins.location,
      address: ins.address,
      phone: ins.phone,
      notes: ins.notes,
      status: ins.status,
      type: ins.type,
      scheduledAt: ins.scheduledAt,
      dueDate: ins.dueDate,
      assigneeId: ins.assigneeId,
      assigneeName: ins.assignee?.name ?? null,
      createdAt: ins.createdAt,
      daysRemaining,
      effectiveStatus,
      approvalStatus: ins.approvalStatus,
      siteReadiness: ins.siteReadiness,
      matchResult: ins.matchResult,
    };
  });
}

/**
 * IN-10: قائمة الإسناد كانت تُعيد **كل مستخدم نشط في الشركة** (مُتحقَّق ميدانيًا:
 * «تظهر كل أسماء المسجلين بالنظام») — محاسب أو مشتريات يُسنَد له معاينة، فيتلقّى
 * إشعار جدولة لشاشة لا يملك فتحها، ويصير `assigneeId` رسميًا وهو عاجز عن العمل.
 *
 * ⚠️ حدّ صريح: `ADMIN` **مستبعد** — دور إداري لا تنفيذي (افتراض التنفيذ المعلَن في
 * التكليف). إن كان الواقع التشغيلي غير ذلك فالتصحيح سطر واحد هنا.
 *
 * 🔴 **الشق الخادمي أُغلق في موجة B3** (`assertAssignable` أدناه): كانت هذه الدالة
 * ترشيح **عرض** وحده و`scheduleSchema` يقبل `z.string().min(1)` — أي نص يمرّ، فنداء
 * مباشر يُسند معاينة لمحاسب أو لمستخدم معطَّل أو لمعرّف غير موجود. نفس فئة عيب IN-11
 * حرفيًا (فلترة واجهة بلا حارس خادمي — STD-15). القائمتان تقرآن **نفس الثابت** أدناه.
 */
// `as const` لا `string[]`: يجعل القيم حروفًا يطابقها Prisma بنوع `Role` مباشرةً،
// فيسقط الحاجة إلى `as never` الذي كان يُسكِت المترجم (محظور — Definition of Done).
const ASSIGNABLE_ROLES = ["INSPECTION_REP", "INSPECTION_MANAGER"] as const;

export async function getAssignableUsers(): Promise<UserOption[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { in: [...ASSIGNABLE_ROLES] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}

/**
 * IN-10 (الشق الخادمي، موجة B3): الحارس النافذ على **من يُسنَد إليه**.
 *
 * الفحص يحتاج قاعدة بيانات (وجود · نشط · غير محذوف · دوره ضمن القائمة البيضاء)،
 * فلا يصلح في `scheduleSchema` — الـzod يتحقق من الشكل لا من الحقيقة.
 *
 * 🔴 **مصدر واحد للأدوار:** يقرأ `ASSIGNABLE_ROLES` نفسها التي تبني قائمة العرض في
 * `getAssignableUsers` — ولا يكرّرها نصًّا. تكرارها كان سيُعيد إنتاج علّة IN-12
 * بالحرف: مصدرا حقيقة ينحرفان، فتعرض الواجهة دورًا يرفضه الخادم أو العكس.
 *
 * الشروط الثلاثة مطابقة لشروط `getAssignableUsers` عمدًا — ما يظهر في القائمة هو
 * بالضبط ما يقبله الحارس، لا أوسع ولا أضيق.
 */
async function assertAssignable(assigneeId: string): Promise<void> {
  const assignee = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      isActive: true,
      deletedAt: null,
      role: { in: [...ASSIGNABLE_ROLES] },
    },
    select: { id: true },
  });
  if (!assignee) throw new InspectionError("errors.invalidAssignee");
}

export interface CreateInspectionInput {
  customerId: string;
  /** D-31 (BL-91): الطلب الذي يختاره المندوب صراحةً — إلزامي، لا تخمين */
  quotationRequestId: string;
  location: string;
  address: string;
  phone: string;
  type: string;
  notes?: string;
  /**
   * IN-48 (D-IN-15): المبيعات تُعلن جاهزية الموقع وقت الطلب — المدير يستهلك لا يُدخل.
   * `true` جاهز · `false` غير جاهز · `null` لم يُؤكَّد العميل (يحجب الجدولة).
   */
  siteReadiness?: SiteReadinessValue | null;
}

export async function createInspection(
  input: CreateInspectionInput,
  actorId: string
): Promise<InspectionRow> {
  // D-31 (BL-91): الطلب يُختار صراحةً — تحقّق server-side قبل أي إنشاء:
  // نفس العميل · غير مربوط بمعاينة · غير DONE · غير محذوف. وإلا رفض بلا إنشاء.
  const request = await prisma.quotationRequest.findUnique({
    where: { id: input.quotationRequestId },
    select: { id: true, customerId: true, inspectionRequestId: true, status: true, deletedAt: true },
  });
  if (
    !request ||
    request.deletedAt !== null ||
    request.customerId !== input.customerId ||
    request.inspectionRequestId !== null ||
    request.status === "DONE"
  ) {
    throw new InspectionError("errors.requestNotSelectable");
  }

  // ✅ SCR-INS-B2 (موجة C1) — **الدَّين المُصرَّح به أُغلق.** كان `dueDate` غير قابل
  // للـnull فاضطرّ IN-09 لكتابة قيمة هنا **قبل أن يكون للمهلة أي معنى** (المعاينة لم
  // تُجدوَل بعد)، فحمل العمود دلالتين: «مهلة جدولة» ثم «مهلة تنفيذ». الآن العمود
  // nullable ⇒ **لا تُكتب مهلة عند الإنشاء**؛ مهلة التنفيذ تُولد عند الجدولة وحدها
  // (`scheduleInspection`). دلالة واحدة لعمود واحد.
  //
  // ⚠️ **أثر معلن (BL-167):** الإشارة الجانبية التي كانت تنتجها القيمة القديمة —
  // معاينة غير مجدولة تصير `OVERDUE` بعد يومين فتلفت المدير — **سقطت**، لأن
  // `null` لا يتأخر. «مهلة الجدولة» (D-IN-6) تحتاج بيتها الخاص لا عمودًا مستعارًا،
  // وهي بند مسجَّل (SCR-INS-C في موجة C3).

  // D-31 (BL-91): الإنشاء + السجل + الربط في transaction واحدة — لا معاينة يتيمة
  // حتى لو سبق ربطٌ آخر (updateMany الشرطي يُرجِع 0 → rollback كامل للمعاينة).
  const inspection = await prisma.$transaction(async (tx) => {
    const created = await tx.inspectionRequest.create({
      data: {
        customerId: input.customerId,
        location: input.location as any,
        address: input.address,
        phone: input.phone,
        type: input.type as any,
        notes: input.notes || null,
        // SCR-INS-B2: بلا `dueDate` — تُترك null حتى الجدولة
        // IN-48: تُكتب من حوار المبيعات. `undefined` ⇒ Prisma يتركها null (لم يُؤكَّد).
        siteReadiness: input.siteReadiness ?? null,
      },
      include: {
        customer: { select: { name: true, ownerId: true } },
        assignee: { select: { name: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "INSPECTION_CREATED",
        entity: "InspectionRequest",
        entityId: created.id,
        details: JSON.stringify({
          customerId: created.customerId,
          location: created.location,
          type: created.type,
        }),
      },
    });

    // الربط الشرطي (سباق): لو سبقنا ربطٌ آخر → count=0 → throw → rollback المعاينة
    const linked = await tx.quotationRequest.updateMany({
      where: {
        id: request.id,
        inspectionRequestId: null,
        status: { not: "DONE" },
        deletedAt: null,
      },
      data: { inspectionRequestId: created.id },
    });
    if (linked.count === 0) throw new InspectionError("errors.requestNotSelectable");

    return created;
  });

  try {
    await notifyRole("INSPECTION_MANAGER", {
      title: "notifications.newInspectionTitle",
      body: `تم إنشاء طلب معاينة جديد للعميل ${inspection.customer.name}`,
      type: "INSPECTION_CREATED",
      entityId: inspection.id,
      entityType: "InspectionRequest",
    });
  } catch {
    // notification failure must not block the operation
  }

  // D-32 (BL-93): التغطية مسموحة (نموذج R-02) بلا حارس ملكية — لكن الحوكمة إلزامية:
  // يُخطَر مالك العميل (الضابط = الأثر + الرؤية، D-11/D-24). الفاعل الحقيقي مُسجَّل
  // بالفعل في ActivityLog أعلاه (INSPECTION_CREATED, userId=actorId).
  // 🔴 الشرط = **أي فاعل غير المالك** (ADMIN/مدير معاينات/مندوب مغطٍّ) — مُقرّ صراحةً
  // من يوسف: لا تُضيَّق لـSALES_REP. المالك يستحق أن يعرف أن أحدًا لمس عميله، أيًا كان.
  if (inspection.customer.ownerId && inspection.customer.ownerId !== actorId) {
    try {
      await sendNotification({
        userId: inspection.customer.ownerId,
        title: "notifications.inspectionByColleagueTitle",
        body: `زميل طلب معاينة لعميلك ${inspection.customer.name}`,
        type: "INSPECTION_BY_COLLEAGUE",
        entityId: inspection.id,
        entityType: "InspectionRequest",
      });
    } catch {
      // notification failure must not block the operation
    }
  }

  await recomputeQuotationRequestStatus(request.id, actorId);
  await recomputeCustomerStage(inspection.customerId, actorId);

  // SCR-INS-B2: الحساب مشترك ويحتمل null (هنا `dueDate = null` دائمًا بعد C1)
  const daysRemaining = computeDaysRemaining(inspection.dueDate);
  // IN-17: الدالة المشتركة — لا نسخة محلية من الشرط
  const effectiveStatus = deriveEffectiveStatus(inspection.dueDate, inspection.status);

  return {
    id: inspection.id,
    customerId: inspection.customerId,
    customerName: inspection.customer.name,
    location: inspection.location,
    address: inspection.address,
    phone: inspection.phone,
    notes: inspection.notes,
    status: inspection.status,
    type: inspection.type,
    scheduledAt: inspection.scheduledAt,
    dueDate: inspection.dueDate,
    assigneeId: inspection.assigneeId,
    assigneeName: inspection.assignee?.name ?? null,
    createdAt: inspection.createdAt,
    daysRemaining,
    effectiveStatus,
    approvalStatus: inspection.approvalStatus,
    siteReadiness: inspection.siteReadiness,
    matchResult: inspection.matchResult,
  };
}

export async function scheduleInspection(
  id: string,
  scheduledAt: Date,
  assigneeId: string,
  actorId: string
): Promise<InspectionRow> {
  // IN-11: الحارس كان في الواجهة وحدها (`inspections-client.tsx` يخفي الزر لغير
  // REQUESTED) — وهو إخفاء لا حارس (STD-15): نداء مباشر كان يكتب على أي صف بأي
  // حالة، فيُرجع معاينة DONE إلى SCHEDULED. الحارس النافذ هنا، سيرفر-سايد.
  //
  // 🔴 حدّ مقصود: **لا نقفل الجدولة على REQUESTED فقط.** إعادة الجدولة قاعدة عمل
  // مطلوبة (Q5) تُقنَّن في الموجة B، وقفلها هنا كان سيبني حاجزًا يلزم نقضه بعد
  // أسبوع. المرفوض هو الكتابة **غير المشروعة** لا إعادة الجدولة:
  //   · DONE → معاينة منتهية لا تُعاد جدولتها.
  //   · APPROVED (IN-13) → الاعتماد ذهب للمكتب الفني؛ تغيير المندوب/الموعد بعده
  //     يُباعد `approvedById` عن واقع المعاينة.
  // OVERDUE تبقى **قابلة للجدولة** عمدًا: صفوف قديمة كُتبت يدويًا (قبل IN-07)
  // يجب ألا تبقى محبوسة بلا توزيع.
  const current = await prisma.inspectionRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      approvalStatus: true,
      location: true,
      scheduledAt: true,
      assigneeId: true,
      // IN-09/IN-28: القيمة السابقة تُقرأ لتُسجَّل في الأثر (تمديد المهلة قابل للتدقيق)
      dueDate: true,
      // IN-48: بوابة جاهزية الموقع + تمييز الصفوف القديمة
      siteReadiness: true,
      createdAt: true,
      customerId: true,
      customer: { select: { name: true, ownerId: true } },
    },
  });
  if (!current) throw new InspectionError("errors.notFound");
  /**
   * 🔴 SCR-INS-I (C2-fix) — **الحارس الأخطر في هذه الموجة، ولم يُذكر في التكليف.**
   *
   * كان الشرط `=== "DONE"` وحده، فمعاينة `CANCELLED` تمرّ ⇒ **تُعاد جدولتها فتُبعث
   * صامتةً**: يعود `status` إلى `SCHEDULED`، ويُخطَر مندوب بموقع أُلغي أصلًا،
   * ويعود العميل المرفوض إلى مرحلة «معاينة» عبر إعادة الاشتقاق. أي أن التتالي كله
   * كان قابلًا للنقض بضغطة واحدة على زرّ قائم.
   *
   * `POSTPONED` **تمرّ عمدًا** — التأجيل توقّف يُستأنف، وحجب جدولتها = صفّ محبوس.
   */
  if (isTerminalInspectionStatus(current.status))
    throw new InspectionError("errors.inspectionNotSchedulable");
  if (current.approvalStatus === "APPROVED")
    throw new InspectionError("errors.inspectionApprovedNoChange");

  // ── IN-10 (الشق الخادمي، موجة B3): أهلية المُسنَد إليه ───────────────────────
  // 🔴 **موضعه في الترتيب مقصود** — الحُرّاس أعلاه (`DONE` · `APPROVED`) تخصّ **حالة
  // السجل**: صف منتهٍ أو معتمَد لا يُجدوَل أصلًا، فلا معنى للتحقق من مُدخل لن يُكتب.
  // وهذا الحارس يسبق بوابة جاهزية الموقع أدناه عن قصد: تلك البوابة لها **أثر جانبي**
  // (إشعار لمالك العميل)، ونداء مشوَّه المُدخلات يجب ألا يُنتج إشعارًا في جرس المبيعات.
  // أي: حالة السجل أولًا → صحة المُدخل ثانيًا → بوابة العمل ذات الأثر ثالثًا.
  await assertAssignable(assigneeId);

  // ── IN-48 (D-IN-15) + ✅ BL-160 (C2): بوابة جاهزية الموقع ────────────────────
  // `UNCONFIRMED` = سُئل العميل ولم يؤكّد ⇒ **لا جدولة**.
  // `NOT_READY`   = غير جاهز ⇒ الجدولة **مسموحة** (قرار المدير، والتحذير في الواجهة)
  //                 لأن معاينة موقع غير جاهز قد تكون مقصودة.
  // `null`        = **لم يُسأل أصلًا** (صفّ تاريخي، 23 صفًّا) ⇒ لا تُحجب.
  //
  // 🔴 هذا هو مكسب BL-160 الملموس: الشرط صار **على البيانات** بدل
  // `=== null && createdAt >= SITE_READINESS_GATE_FROM`. الحدّ الزمني الصلب كان
  // يميّز الحالتين بالتاريخ لأن العمود البولياني طواهما في `null` واحدة — واتّسع
  // كل يوم يتأخر فيه الدمج. الآن التمييز صريح ولا يحتاج ضبطًا يدويًا قبل أي دفع.
  if (current.siteReadiness === "UNCONFIRMED") {
    // لا يقف الطلب صامتًا بلا تفسير يصل لصاحبه (درس IN-37): المالك يُخطَر بأن
    // طلبه مُعلَّق لسبب في يده هو — تأكيد جاهزية الموقع مع العميل.
    //
    // 🔴 إزالة التكرار (تصحيح مراجعة): الرفض لا يُنشئ إشعارًا جديدًا في كل محاولة.
    // المدير يكرّر الضغط طبعًا (الرسالة لا تُصلَح من شاشته)، فكانت كل ضغطة تُنتج صفًّا
    // في جرس المالك يلزمه رفضه فرديًا ⇒ قناة إشعارات تتوقف عن كونها مقروءة.
    // الشرط: إشعار **غير مقروء** واحد لنفس المعاينة يكفي.
    try {
      const pending = await prisma.notification.findFirst({
        where: {
          type: "SITE_READINESS_REQUIRED",
          entityId: id,
          entityType: "InspectionRequest",
          isRead: false,
        },
        select: { id: true },
      });
      if (!pending) {
        const body = `تعذّرت جدولة معاينة العميل ${current.customer.name} — أكّد جاهزية الموقع مع العميل`;
        if (current.customer.ownerId) {
          await sendNotification({
            userId: current.customer.ownerId,
            title: "notifications.siteReadinessRequiredTitle",
            body,
            type: "SITE_READINESS_REQUIRED",
            entityId: id,
            entityType: "InspectionRequest",
          });
        } else {
          // 🔴 عميل بلا مالك (تصحيح مراجعة): `Customer.ownerId` قابل للـnull، وبلا هذا
          // الفرع كان الطلب يُحجَب و**لا أحد في المبيعات يعلم** — وهو حرفيًا العيب الذي
          // يستشهد به التعليق أعلاه. نفس fallback الموجود في inspection-measurements.ts.
          await notifyRole("SALES_MANAGER", {
            title: "notifications.siteReadinessRequiredTitle",
            body: `${body} (عميل بلا مالك مندوب)`,
            type: "SITE_READINESS_REQUIRED",
            entityId: id,
            entityType: "InspectionRequest",
          });
        }
      }
    } catch {
      // notification failure must not block the operation
    }
    throw new InspectionError("errors.siteReadinessRequired");
  }

  // IN-09: مهلة التنفيذ تُحسب **الآن** من الموعد المُلتزَم به، لا من لحظة الطلب.
  /**
   * ── D-IN-24: فحص تعارض جدول المندوب — **تحذير لا حجب** ──────────────────────
   *
   * 🔴 **التعريف المُنفَّذ: نفس المندوب في نفس اليوم (بتوقيت القاهرة).**
   * التداخل الزمني الحقيقي يستلزم **مدة الزيارة** وهي غير مخزَّنة في أي عمود —
   * فاختراع نافذة (ساعتان؟ أربع؟) كان تخمينًا يُقيَّد به المدير بلا سند. مسجَّل
   * في BACKLOG حتى تُحسم المدة مع حسن.
   *
   * 🔴 **ولماذا تحذير لا حجب:** المدير قد يعرف ما لا يعرفه النظام (موقعان متجاوران ·
   * زيارتان قصيرتان · تنسيق هاتفي). الحجب كان سيمنع جدولةً مشروعة، والصمت كان
   * يترك المندوب في موعدين. التحذير يُعلِم ويترك القرار لصاحبه.
   */
  const dayKey = cairoDateKey(scheduledAt);
  const sameDayOthers = await prisma.inspectionRequest.findMany({
    where: {
      id: { not: id },
      assigneeId,
      deletedAt: null,
      // الحالات النهائية لا تشغل جدول المندوب — نفس المصدر الوحيد (SCR-INS-I)
      status: { notIn: [...TERMINAL_INSPECTION_STATUSES] },
      scheduledAt: { not: null },
    },
    select: { id: true, scheduledAt: true, customer: { select: { name: true } } },
  });
  const conflicts = sameDayOthers.filter(
    (o) => o.scheduledAt !== null && cairoDateKey(o.scheduledAt) === dayKey
  );

  // SCR-INS-C: `await` — المهلة تُقرأ من الإعدادات عند كل حساب
  const dueDate = await computeDueDate(current.location, scheduledAt);

  const inspection = await prisma.inspectionRequest.update({
    where: { id },
    data: {
      status: "SCHEDULED" as any,
      scheduledAt,
      assigneeId,
      dueDate,
      /**
       * SCR-INS-B (IN-33): لحظة الإسناد — يفتح «زمن التوزيع» وحمل العمل.
       *
       * 🔴 **يُدهس عند كل إسناد، لا يُكتب مرة واحدة** — ودلالته محسومة بسابقة
       * المشروع لا باجتهاد: `Quotation.submittedAt` يُعاد ضبطه عند كل تقديم بتعليق
       * صريح (`lib/actions/lead-approval.ts:110`: «الدورة الجديدة تُقاس من تقديمها
       * هي لا من الأول»). ومتسق داخليًا مع `dueDate` أعلاه الذي يُعاد حسابه مع كل
       * جدولة (IN-09) — الطابعان يصفان **الدورة الجارية** لا أول دورة.
       * الأثر الكامل للانتقالات محفوظ في ActivityLog أدناه (IN-28 يكتب from/to).
       */
      assignedAt: new Date(),
    },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  // IN-28: إعادة التعيين تُسجَّل بالانتقال لا بالقيمة الجديدة وحدها. الفحص الميداني
  // (خطوة 16) رصد «لا يوجد سجل من قام بآخر تحديث»: السجل القديم كان يكتب القيمة
  // الجديدة فقط، فإعادة إسناد تبدو كإسناد أول ولا يظهر مَن أُخذت منه ولا الموعد السابق.
  const isReassignment =
    current.assigneeId !== null || current.scheduledAt !== null;
  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: isReassignment ? "INSPECTION_RESCHEDULED" : "INSPECTION_SCHEDULED",
      entity: "InspectionRequest",
      entityId: id,
      details: JSON.stringify({
        assigneeId: { from: current.assigneeId, to: assigneeId },
        scheduledAt: {
          from: current.scheduledAt ? current.scheduledAt.toISOString() : null,
          to: scheduledAt.toISOString(),
        },
        // IN-09: المهلة تُعاد حسابها مع كل جدولة — والانتقال يُسجَّل `from/to` مثل
        // أخويه. تسجيل القيمة الجديدة وحدها كان يفقد **الحقل الوحيد الحامل لـSLA**:
        // إعادة جدولة تمدّ المهلة بلا سقف، والقيمة المُستبدَلة غير قابلة للاستخراج
        // من الأثر (سجل الإنشاء لا يحمل dueDate أصلًا) ⇒ تمديد غير قابل للتدقيق.
        // SCR-INS-B2: `from` صار يحتمل null (معاينة تُجدوَل لأول مرة) — `?.` لا
        // استدعاء مباشر، وإلا رمى `.toISOString()` على null وأسقط الجدولة كلها.
        dueDate: {
          from: current.dueDate?.toISOString() ?? null,
          to: dueDate.toISOString(),
        },
      }),
    },
  });

  try {
    await sendNotification({
      userId: assigneeId,
      title: "notifications.inspectionScheduledTitle",
      body: `تم جدولة معاينة للعميل ${inspection.customer.name}`,
      type: "INSPECTION_SCHEDULED",
      entityId: id,
      entityType: "InspectionRequest",
    });
  } catch {
    // notification failure must not block the operation
  }

  // SCR-INS-B2: الحساب مشترك ويحتمل null (هنا مضمون غير-null بعد الجدولة)
  const daysRemaining = computeDaysRemaining(inspection.dueDate);
  // IN-17: الدالة المشتركة — لا نسخة محلية من الشرط
  const effectiveStatus = deriveEffectiveStatus(inspection.dueDate, inspection.status);

  return {
    id: inspection.id,
    customerId: inspection.customerId,
    customerName: inspection.customer.name,
    location: inspection.location,
    address: inspection.address,
    phone: inspection.phone,
    notes: inspection.notes,
    status: inspection.status,
    type: inspection.type,
    scheduledAt: inspection.scheduledAt,
    dueDate: inspection.dueDate,
    assigneeId: inspection.assigneeId,
    assigneeName: inspection.assignee?.name ?? null,
    createdAt: inspection.createdAt,
    daysRemaining,
    effectiveStatus,
    approvalStatus: inspection.approvalStatus,
    siteReadiness: inspection.siteReadiness,
    matchResult: inspection.matchResult,
    // D-IN-24: التعارض يُعاد **مع الصفّ الناجح** — الجدولة تمّت والتنبيه يرافقها
    scheduleConflicts: conflicts.map((c) => ({
      customerName: c.customer.name,
      scheduledAt: c.scheduledAt as Date,
    })),
  };
}
