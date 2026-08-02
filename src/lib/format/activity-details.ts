import { formatInstantDateTime } from "@/lib/format/dates";

/**
 * ── BL-192: تشكيل حمولة `ActivityLog.details` للعرض ──────────────────────────
 *
 * 🔴 **لماذا وحدة مشتركة لا دالة داخل الشاشة:** القاعدة تُقرأ من **جهتين**: الخادم
 * يجمع المعرّفات ليحلّها أسماءً (`getInspectionDetail`)، والواجهة ترسم السطور. قاعدة
 * «ما هو معرّف مستخدم؟» لو تكرّرت في الملفين لانحرفتا أول يوم يُضاف مفتاح — وهو
 * درس IN-12 حرفيًا. المصدر هنا **واحد**، والجهتان تستوردانه.
 *
 * الوحدة نقيّة: لا Prisma ولا `server-only` — تُستورد من مكوّن عميل بلا مشاكل.
 */

/**
 * 🔴 **الكشف بشكل القيمة لا باسم المفتاح — قرار مبني على جرد القاعدة لا على حدس.**
 *
 * الجرد الفعلي (`ActivityLog` حيث `entity='InspectionRequest'`) أخرج **ثلاثة** مفاتيح
 * زمنية مختلفة: `scheduledAt` و`dueDate` (داخل `{from,to}`) و`clearedTecReceivedAt`
 * (مسطّح) — وكلها من كتّاب مختلفين. قائمة مفاتيح كانت ستغطّي الثلاثة اليوم **وتفوتها
 * صامتةً** أول ما يكتب مسار رابع مفتاحًا جديدًا، فيعود عيب D-IN-26 من الباب الخلفي
 * بلا أن يكسر شيئًا يُرى. الشكل يصف نفسه، فلا يتقادم.
 *
 * النمط **صارم عمدًا** (تاريخ + وقت + منطقة صريحة): `"3"` و`"1.4"` — وهي قيم
 * `width`/`height` الفعلية في نفس الجدول — لا تقترب منه.
 */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * المعرّفات **باسم المفتاح** لا بشكل القيمة — عكس التوقيتات تمامًا، وللسبب نفسه:
 * لا يوجد شكل يميّز CUID مستخدمٍ عن CUID أي كيان آخر، فمحاولة كشفها بنمط كانت
 * ستلتقط نصوصًا عادية. اللاحقة `Id` تصف النية صراحةً.
 *
 * ⚠️ تلتقط عمدًا ما ليس مستخدمًا (`customerId` · `measurementId` — كلاهما في الجرد):
 * لا ضرر — لا يُعثر عليهما في `User` فيبقيان خامَّين كما هما (انظر `renderValue`).
 * الترشيح الحقيقي يقع عند الحلّ لا عند الجمع.
 */
function isIdKey(key: string): boolean {
  return key.endsWith("Id");
}

/** يقرأ الحمولة بأمان — أي شكل غير متوقّع يُعيد `null` ولا يرمي. */
function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * BL-192: كل قيمة نصية تحت مفتاح ينتهي بـ`Id` — مسطّحة أو داخل `{from,to}`.
 * يستدعيها **الخادم** ليجمع المرشّحين قبل استعلام أسماء واحد (لا N+1).
 */
export function collectIdCandidates(raw: string | null): string[] {
  const parsed = parsePayload(raw);
  if (!parsed) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!isIdKey(key)) continue;
    if (typeof value === "string" && value) out.push(value);
    else if (value !== null && typeof value === "object") {
      // شكل الانتقال `{from,to}` — الطرفان معرّفان، و`from` قد يكون null عند أول إسناد
      const pair = value as { from?: unknown; to?: unknown };
      if (typeof pair.from === "string" && pair.from) out.push(pair.from);
      if (typeof pair.to === "string" && pair.to) out.push(pair.to);
    }
  }
  return out;
}

/**
 * قيمة واحدة → نصّ معروض. **لا ترمي أبدًا** — كل فرع له مخرج، والمجهول يمرّ كما هو.
 */
function renderValue(
  key: string,
  value: unknown,
  names: Readonly<Record<string, string>>
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    if (ISO_INSTANT.test(value)) {
      // D-IN-26: التوقيت بالقاهرة عبر **المُنسِّق القائم** — لا مُنسِّق ثانٍ في المشروع.
      // يعيد `null` للحظة غير صالحة، فتُعرض القيمة خامًا بدل `Invalid Date`.
      const formatted = formatInstantDateTime(value);
      if (formatted) return formatted;
    }
    // اسم إن عُرف، وإلا **المعرّف الخام** — سجل تدقيقي لا يُخفي ما لم يستطع حلّه
    if (isIdKey(key)) return names[value] ?? value;
    return value;
  }
  return String(value);
}

/**
 * IN-45: عرض `details` **بلا افتراض شكل**. العمود يحمل أحيانًا JSON مهيكلًا
 * (`{assigneeId:{from,to}, …}` من الجدولة) وأحيانًا نصًّا عربيًا حرًّا
 * (`"الموقع جاهز"`)، وأحيانًا `null`.
 *
 * 🔴 القاعدة الحاكمة (قائمة ولم تُمَس في BL-192): **لا يُسقَط الصف مهما كان
 * المحتوى.** فشل التحليل يعني عرض النص كما هو، لا اختفاء حدث من سجل تدقيقي —
 * سجل ينقص صفًّا أسوأ من سجل قبيح. لذلك كل تحويل مُضاف هنا نقيّ وغير رامٍ:
 * فحص نمط، وقراءة من خريطة، ومُنسِّق يعيد `null` بدل أن يرمي.
 *
 * @param names خريطة `معرّف → اسم` من الخادم. غيابها = سلوك ما قبل BL-192 حرفيًا.
 */
export function formatActivityDetails(
  raw: string | null,
  names: Readonly<Record<string, string>> = {}
): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = parsePayload(trimmed);
  // نصّ حر، أو JSON مكسور، أو قيمة ليست كائنًا ⇒ يُعرض حرفيًا ولا يختفي
  if (!parsed) return [trimmed];
  return Object.entries(parsed).map(([key, value]) => {
    // شكل الانتقال `{from, to}` هو الأشيع (جدولة/إعادة جدولة) — يُقرأ كسهم
    if (value !== null && typeof value === "object" && "to" in value) {
      const pair = value as { from?: unknown; to?: unknown };
      return `${key}: ${renderValue(key, pair.from, names)} ← ${renderValue(
        key,
        pair.to,
        names
      )}`;
    }
    return `${key}: ${renderValue(key, value, names)}`;
  });
}
