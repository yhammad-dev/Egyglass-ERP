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
export const BUSINESS_TIME_ZONE = "Africa/Cairo";

/**
 * ══ D-IN-24: تقويم يوم العمل بتوقيت القاهرة ══════════════════════════════════
 *
 * 🔴 **لماذا هنا لا في خدمة المعاينات:** المنطقة الزمنية للعمل حقيقة واحدة في
 * النظام. تكرار `"Africa/Cairo"` في ملف ثانٍ = مصدرا حقيقة ينحرفان (علّة IN-12)،
 * ويوم تتغيّر المنطقة (فرع ثانٍ · قرار إداري) يُنسى أحدهما.
 *
 * 🔴 **ولماذا `Intl` لا حساب إزاحة يدوي:** مصر أعادت التوقيت الصيفي — الإزاحة
 * تتأرجح بين +2 و+3 خلال السنة. أي ثابت `+3` يصير خاطئًا نصف العام بصمت.
 * `Intl.DateTimeFormat` يقرأ قاعدة IANA فيصيب في الاتجاهين وعند التحوّل نفسه.
 */
const cairoPartsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

/** أسماء أيام `en-CA` القصيرة → رقم اليوم (0=الأحد … 5=الجمعة … 6=السبت). */
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * يوم الأسبوع **بتوقيت القاهرة** لأي لحظة. `5` = الجمعة.
 *
 * ⚠️ الفرق عن `getUTCDay()` ليس نظريًا: موعد **الخميس 22:00 بالقاهرة** هو
 * **الجمعة 19:00 UTC** ⇒ `getUTCDay()` يراه جمعةً فيقفزه، بينما هو خميس عمل
 * عند صاحبه. النافذة المتأثرة هي مساء كل يوم (21:00–24:00 صيفًا).
 */
export function cairoWeekday(instant: Date): number {
  const wd = cairoPartsFormat
    .formatToParts(instant)
    .find((p) => p.type === "weekday")?.value;
  return wd ? WEEKDAY_INDEX[wd] ?? instant.getUTCDay() : instant.getUTCDay();
}

/** `YYYY-MM-DD` لليوم التقويمي بتوقيت القاهرة — أساس مقارنة «نفس اليوم». */
export function cairoDateKey(instant: Date): string {
  const p = cairoPartsFormat.formatToParts(instant);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** صيغة كاملة (تاريخ + وقت) لحساب الإزاحة الفعلية عند لحظة بعينها. */
const cairoFullFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** إزاحة القاهرة بالدقائق عند لحظة بعينها (+120 أو +180 حسب التوقيت الصيفي). */
function cairoOffsetMinutes(instant: Date): number {
  const p = cairoFullFormat.formatToParts(instant);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  const asIfUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour") % 24,
    n("minute"),
    n("second")
  );
  /**
   * 🔴 **الأجزاء بلا أجزاء الثانية** — `Intl` لا يُعيد الميلي ثانية، فطرح
   * `instant.getTime()` الكامل كان يُدخل كسرها في الإزاحة: `.999` أنتجت
   * `179.98` دقيقة بدل `180`، فانزاح الختم ثانيةً كاملة ووقع في **اليوم التالي**
   * (`21:00:00.997Z` بدل `20:59:59.999Z`). تُصفَّر الميلي في الطرفين فتخرج الإزاحة
   * دقائق صحيحة. **كشفه الفحص العددي لا المترجم** — الكود كان يُبنى ويعمل خطأً.
   */
  const instantWholeSeconds = instant.getTime() - instant.getMilliseconds();
  return (asIfUtc - instantWholeSeconds) / 60000;
}

/**
 * 🔴 **D-IN-24 — يحلّ أخطر فخّ في تحويل الموعد إلى وقت.**
 *
 * `<input type="datetime-local">` يُنتج نصًّا **بلا منطقة زمنية** (`2026-08-04T22:00`)،
 * و`new Date(...)` يفسّره **بتوقيت بيئة التشغيل**. وحاوية التطبيق تعمل بـUTC
 * (مُتحقَّق) ⇒ مدير يُدخل «22:00» قاصدًا القاهرة كان سيُخزَّن `22:00 UTC` = **01:00
 * من اليوم التالي بالقاهرة**. أي أن الموعد ينزاح ثلاث ساعات ويقفز يومًا، بصمت.
 *
 * وهذا **يُفعّل بالضبط** نافذة الخطر المعروفة (00:00–03:00 بالقاهرة) التي يقوم
 * هذا البند على تجنّبها — من باب الكتابة لا القراءة.
 *
 * الحل: تُقرأ القيمة على أنها **ساعة حائط بالقاهرة** وتُحوَّل للحظة الحقيقية.
 * ⚠️ **حدّ معروف:** الساعة المكرّرة/المفقودة عند تحوّل التوقيت الصيفي تحتمل تفسيرين؛
 * يُختار الأول. الأثر: موعد واحد في السنة قد ينزاح ساعة — مقبول ومُعلَن.
 */
/**
 * 🔴 **D-IN-25 (قرار يوسف): نهاية يوم العمل = 23:59:59.999 بتوقيت القاهرة.**
 *
 * العيب: `setUTCHours(23,59,59,999)` كان يختم اليوم بـUTC، و`23:59:59 UTC` هي
 * **02:59:59 بالقاهرة من اليوم التالي** ⇒ المندوب يملك **ثلاث ساعات إضافية** لا
 * يعرف بها أحد ولا يقصدها أحد، ومؤشر تجاوز المهلة يقيس على حدّ لم يقرّره أحد.
 *
 * ⚠️ **لا إزاحة يدوية بثلاث ساعات:** مصر أعادت التوقيت الصيفي فالإزاحة تتأرجح بين
 * `+2` شتاءً و`+3` صيفًا. أي ثابت يصير خاطئًا نصف العام **بصمت** — نفس السبب الذي
 * رُفضت لأجله الإزاحة اليدوية في D-IN-24.
 *
 * **تمريرتان على الإزاحة** لأن الإزاحة تُقاس عند لحظة تقريبية أولًا: لو وقع تحوّل
 * التوقيت الصيفي بين التقريب والنتيجة، تُعاد الحسبة بالإزاحة الصحيحة. بلا ذلك
 * ينزاح يومان في السنة ساعةً كاملة.
 */
export function endOfCairoDay(instant: Date): Date {
  return endOfCairoDayForKey(cairoDateKey(instant));
}

/**
 * نفس الختم لكن انطلاقًا من **مفتاح يوم صريح** (`YYYY-MM-DD`) لا من لحظة.
 *
 * 🔴 **لماذا يلزم منفصلًا (D-IN-26):** سكربت تصحيح الصفوف القائمة يعرف **اليوم
 * المقصود** من التاريخ التقويمي UTC للقيمة القديمة — و`endOfCairoDay` على تلك
 * القيمة كان **سيزيح يومًا**: `23:59:59.999Z` من يوم X هي `02:59` بالقاهرة من
 * **X+1**، فيُختَم اليوم التالي. المفتاح الصريح يقطع هذا الالتباس.
 */
export function endOfCairoDayForKey(key: string): Date {
  const approx = new Date(`${key}T23:59:59.999Z`);
  const off1 = cairoOffsetMinutes(approx);
  const candidate = new Date(approx.getTime() - off1 * 60000);
  const off2 = cairoOffsetMinutes(candidate);
  return off2 === off1
    ? candidate
    : new Date(approx.getTime() - off2 * 60000);
}

export function parseCairoWallTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const asUtc = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  return new Date(asUtc.getTime() - cairoOffsetMinutes(asUtc) * 60000);
}

/**
 * ✅ **D-IN-26: `businessDateFormat` (المثبَّت على UTC) حُذف — وكذلك
 * `formatBusinessDate`.**
 *
 * كانا يخدمان تصنيف «يوم عمل مخزَّن UTC» الذي أنشأه C1-fix حين كان `dueDate`
 * و`scheduledAt` تاريخين مجرَّدين. بعد D-IN-24/25/26 صار **كل وقت في النظام لحظةً
 * حقيقية بتوقيت القاهرة**، وسكربت التصحيح وحّد الصفوف القائمة (28/28، تباين صفر
 * بين التقويمين) ⇒ لم يبقَ مستهلك واحد.
 *
 * 🔴 **حُذفا ولم يُتركا «احتياطًا»:** إبقاء مُنسِّق UTC بعد قرار «كل وقت بالقاهرة»
 * يدعو لإعادة إدخال العيب — أول من يحتاج تنسيقًا سيجد اثنين ويختار أحدهما بلا سياق.
 * دالة واحدة تعني قرارًا واحدًا.
 */

/** لحظة حقيقية — التاريخ وحده. */
const instantDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});

/**
 * لحظة حقيقية — التاريخ والوقت (سجل الأحداث · موعد المعاينة).
 *
 * ⚠️ **`hourCycle: "h23"` لا `hour12: false` وحده:** الأخير يسمح بدورة `h24` التي
 * تعرض منتصف الليل **`24:00`** بدل `00:00` — رُصد فعليًا في فحص D-IN-25 على موعد
 * منتصف ليل قاهري. `h23` تفرض `00–23` صراحةً.
 */
const instantDateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
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
