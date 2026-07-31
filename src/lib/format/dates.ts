/**
 * ══ المصدر الوحيد لتنسيق التواريخ المعروضة ═════════════════════════════════════
 *
 * 🔴 **الجذر (مُتحقَّق بالدليل، موجة C1):** نفس المعاينة كانت تُظهر يومين مختلفين —
 * قائمة المعاينات `2026-08-06` وشاشة التفاصيل `٢٠٢٦/٠٨/٠٧`. السبب ليس بيانات
 * ولا إعادة جدولة: القيمة المخزَّنة `2026-08-06 23:59:59.999+00`، وحاوية التطبيق
 * تعمل بـ**UTC** (`TZ` فارغ) بينما متصفح المستخدم في **القاهرة (+3)** ⇒ نفس اللحظة
 * = `2026-08-07 02:59` عنده. وكل المُنسِّقات كانت تستعمل **المنطقة الزمنية للبيئة**،
 * فيختلف الناتج بين ما يُرسَم على الخادم وما يُرسَم بعد hydration في المتصفح.
 *
 * 🔴 **لماذا هذا حرج ولا يُترك تجميلًا:** `K3` (نسبة تجاوز SLA) ستُحسب على
 * `dueDate`. حقل يُقرأ بيومين مختلفين حسب مكان الرسم يُنتج مؤشرًا لا يمكن تدقيقه.
 *
 * ── التمييز الحاكم: نوعان من القيم، لا نوع واحد ──────────────────────────────
 *
 * (١) **يوم عمل** (`dueDate` · `scheduledAt`): ليس لحظة بل **تاريخ**. مصدره
 *     `<input type="date">` الذي يُفسَّر منتصف ليل **UTC**، و`computeDueDate`
 *     يختم اليوم بـ`setUTCHours(23,59,59,999)` — أي أن «اليوم» معرَّف في UTC عمدًا
 *     (IN-09: «بتوحيد القراءة والكتابة على UTC يصير الحساب مستقلًا عن منطقة النشر»).
 *     ⇒ **يُعرض بـUTC**، وإلا انزاح اليوم لكل قارئ شرق غرينتش.
 *
 * (٢) **لحظة حقيقية** (`assignedAt` · `submittedAt` · `completedAt` · `createdAt`):
 *     `new Date()` وقت وقوع الحدث. ⇒ تُعرض **بتوقيت القاهرة صراحةً** — لا بمنطقة
 *     البيئة: تثبيتها يجعل الخادم والمتصفح يتفقان، ويجعل ما يراه موظفو القاهرة
 *     هو زمنهم الفعلي بصرف النظر عن مكان النشر.
 *
 * **الأرقام لاتينية و`YYYY-MM-DD`** في الاثنين: قابل للفرز، غير ملتبس، ومتسق مع
 * `dir="ltr"` المستعمل على كل حقول التواريخ في المشروع.
 */

/** منطقة العمل الفعلية للشركة — ثابتة لا تتبع بيئة التشغيل. */
const BUSINESS_TIME_ZONE = "Africa/Cairo";

/** يوم عمل: `dueDate` · `scheduledAt`. مثبَّت على UTC (انظر الحالة ١ أعلاه). */
const businessDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

/** لحظة حقيقية — التاريخ وحده. */
const instantDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});

/** لحظة حقيقية — التاريخ والوقت (سجل الأحداث). */
const instantDateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: BUSINESS_TIME_ZONE,
});

/** `null` للمُدخل الفارغ — القرار بما يُعرض بدلًا منه يخصّ الشاشة لا المُنسِّق. */
type Input = Date | string | null | undefined;

function toDate(value: Input): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  // تاريخ غير صالح يُعامل كغياب — لا `Invalid Date` تتسرّب للشاشة
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * يوم عمل (`dueDate` · `scheduledAt`) — **UTC**.
 * ⚠️ لا تستعملها للحظات الحقيقية: ستُظهر `completedAt` بيوم أسبق لكل حدث يقع
 * بين منتصف ليل القاهرة و03:00.
 */
export function formatBusinessDate(value: Input): string | null {
  const d = toDate(value);
  return d ? businessDateFormat.format(d) : null;
}

/** لحظة حقيقية — التاريخ وحده، بتوقيت القاهرة. */
export function formatInstantDate(value: Input): string | null {
  const d = toDate(value);
  return d ? instantDateFormat.format(d) : null;
}

/** لحظة حقيقية — التاريخ والوقت، بتوقيت القاهرة. */
export function formatInstantDateTime(value: Input): string | null {
  const d = toDate(value);
  return d ? instantDateTimeFormat.format(d) : null;
}
