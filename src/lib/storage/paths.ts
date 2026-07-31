import { join, resolve } from "path";

/**
 * TO-11 — المصدر الوحيد لمسار تخزين الملفات المرفوعة.
 *
 * 🔴 الجذر **خارج `public/` عمدًا**. السبب بنيوي لا تجميلي: كل ما تحت `public/`
 * يخدمه Next ساكنًا **قبل أي كود** — لا middleware ولا route handler يسبقه.
 * مُتحقَّق سابقًا (TO-07): ملف موجود تحت public كان يعود 200 بترويسات الخادم الساكن
 * بلا أي جلسة. بنقل الجذر خارج public تصير المصادقة **خاصية بنيوية**: لا يوجد
 * أصلًا مسار ساكن يخدم هذه الملفات، فلا تسقط الحماية عند إضافة reverse proxy لاحقًا.
 *
 * ⚠️ **مسار الـURL العام لا يتغيّر**: يبقى `/uploads/<section>/<file>` حرفيًا،
 * فأعمدة قاعدة البيانات (`Drawing.url` وأخواتها) تحتفظ بقيمها ⇒ صفر ترحيل بيانات.
 * الذي تغيّر هو موقع الملف على القرص فقط، ومَن يخدمه:
 * `src/app/uploads/[...path]/route.ts` المحروس بالمصادقة.
 */
const DEFAULT_UPLOADS_DIR = join(process.cwd(), "var", "uploads");

/** الجذر المُحلَّل (absolute) — يُضبط بـ`UPLOADS_DIR` عند الحاجة (نشر/تخزين خارجي). */
export const UPLOADS_ROOT: string = resolve(
  process.env.UPLOADS_DIR?.trim() || DEFAULT_UPLOADS_DIR
);

/** الأقسام الأربعة — أي قسم جديد يُضاف هنا لا في الكتّاب. */
export const UPLOAD_SECTIONS = [
  "drawings",
  "inspections",
  "company",
  "documents",
] as const;

export type UploadSection = (typeof UPLOAD_SECTIONS)[number];

/**
 * مسار مجلد القسم على القرص. الكاتب مسؤول عن `mkdir({recursive:true})` قبل الكتابة.
 * الاسم `uploadDirFor` لا `uploadDir` عمدًا: ثلاثة من الكتّاب الأربعة يستخدمون
 * متغيّرًا محليًا بالاسم `uploadDir`، فالتسمية المتمايزة تمنع تظليلًا صامتًا.
 */
export function uploadDirFor(section: UploadSection): string {
  return join(UPLOADS_ROOT, section);
}

/**
 * الـURL العام للملف — يبقى `/uploads/...` كما هو مخزَّن في القاعدة.
 * يُبنى هنا كي لا يتفرّق بناء الروابط بين الكتّاب الأربعة.
 */
export function uploadUrl(section: UploadSection, filename: string): string {
  return `/uploads/${section}/${filename}`;
}

/**
 * ══ IN-40 (موجة B3) — بابا الرفع والتقديم على قائمة واحدة ══════════════════════
 *
 * العيب: `webp` و`gif` **مقبولان صراحةً** في allowlist بصمة البايتات عند الرفع
 * (`inspections/actions.ts` → `sniffImageMime`)، و**مجهولان** في اشتقاق نوع المحتوى
 * عند التقديم ⇒ يسقطان على `application/octet-stream` ⇒ المتصفح **ينزّلهما بدل
 * عرضهما**. بابان لا يتفقان على نفس القائمة، فانحرفا.
 *
 * (السبب المفترض سابقًا — `Content-Disposition: attachment` — **غير قائم**: لا وجود
 * لهذه الترويسة في الكود إطلاقًا.)
 *
 * 🔴 **الاتجاه أحادي عمدًا:** خريطة التقديم **مشتقّة** من allowlist الرفع بالعكس،
 * لا مكتوبة يدويًا. فلا يمكن أن يُعرض نوع لا يُقبل رفعه — وأي توسيع مستقبلي يبدأ من
 * الرفع فينتقل للتقديم تلقائيًا، لا العكس. `image/svg+xml` يبقى خارج القائمتين معًا
 * (ناقل XSS مخزَّن عند العرض المضمّن).
 */
export const UPLOAD_IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * مسار الرسومات — قائمة مغلقة يكتبها الخادم (`technical-office/actions.ts:246`:
 * `pdf` · `dwg` · `jpg` وحدها). `dwg` **غائب عمدًا**: ملف CAD لا يعرضه متصفح،
 * فيبقى على `octet-stream` أي تنزيلًا — وهو السلوك الصحيح له لا عيبًا.
 */
const DRAWING_EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
};

/**
 * خريطة التقديم: الامتداد ← نوع المحتوى. يستهلكها `app/uploads/[...path]/route.ts`.
 *
 * ⚠️ الامتداد يبقى **مشتقًّا من اسم الملف على القرص الخاضع للسيرفر** لا من `mimeType`
 * القادم من العميل — هذا ضابط TO-A الأمني ولا يُستبدل. وكل الامتدادات المكتوبة فعليًا
 * من توليد الخادم وبحروف صغيرة (`randomUUID()` + امتداد من قائمة مغلقة)، فلا مدخل
 * عميل يصل إلى مفتاح هذه الخريطة أصلًا.
 */
export const SERVE_CONTENT_TYPE: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(UPLOAD_IMAGE_EXT).map(([mime, ext]) => [ext, mime])
  ),
  ...DRAWING_EXT_MIME,
  // `jpeg` مرادف لـ`jpg`: الخادم لا يكتبه اليوم (كل الكتّاب يكتبون `jpg`)، لكن
  // السلوك القائم كان يقبله — ولا تُسحب قدرة قائمة بلا سبب.
  jpeg: "image/jpeg",
};
