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
