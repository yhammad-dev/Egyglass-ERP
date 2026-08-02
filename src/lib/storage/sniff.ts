import { UPLOAD_IMAGE_EXT } from "@/lib/storage/paths";

/**
 * ══ BL-196 — المصدر الوحيد لاشتقاق نوع الملف من بايتاته ═══════════════════════
 *
 * 🔴 **لا ثقة بادعاء العميل.** `file.type` و`file.name` كلاهما بيد المُرسِل: امتداد
 * `.jpg` على ملف HTML، أو `mimeType: "image/png"` على أي شيء. الحقيقة الوحيدة هي
 * **البايتات**، ومنها يُشتق النوع ثم الامتداد المكتوب على القرص.
 *
 * 🔴 **لماذا هذا الملف موجود:** المنطق كان دالة **محلية غير مُصدَّرة** داخل
 * `inspections/actions.ts`، ووحدة المستندات كانت بلا أي فحص إطلاقًا. الخيار كان بين
 * نسخة ثانية (تنحرف بعد أشهر — درس IN-12) أو استخراج المصدر الواحد. هذا هو الثاني:
 * الكاتبان يستوردان من هنا، والقائمة تُوسَّع في مكان واحد.
 *
 * 🔴 **`image/svg+xml` خارج القائمتين عمدًا** — ناقل XSS مخزَّن عند العرض المضمّن،
 * و`accept="image/*"` في المتصفح **لا يفلتره** (نوعه يبدأ بـ`image/`). الرفض هنا
 * بالبايتات هو الحارس الحقيقي الوحيد.
 */

/** بصمة الصور — نفس المنطق المنقول حرفيًا من `inspections/actions.ts` بلا تغيير قيمة. */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  )
    return "image/gif";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

/**
 * BL-196 — بصمة PDF: `%PDF-` في أول خمسة بايتات (توقيع قاطع، ISO 32000).
 *
 * ⚠️ **قرار يوسف (2026-08-02): مستندات العرض/العقد = PDF + صور، بلا ملفات أوفيس.**
 * السبب تقني لا تفضيلي: `docx`/`xlsx` بصمتها `PK\x03\x04` — أي **أرشيف ZIP**، ولا
 * تتمايز عن أي مضغوط آخر. قبولها كان يعني عمليًا قبول أي ZIP باسم `.docx` ما لم
 * يُفتح الأرشيف ويُقرأ `[Content_Types].xml` — وهو كود تفتيش جديد لا إعادة استخدام.
 * فضمانٌ صادق على قائمة أضيق خير من قائمة أوسع بضمان يوهم.
 */
function sniffPdfMime(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-")
    return "application/pdf";
  return null;
}

/**
 * قائمة المستندات: النوع ← الامتداد المكتوب على القرص.
 * تُبنى **فوق** `UPLOAD_IMAGE_EXT` لا بنسخها — فتوسيع الصور يصل الطرفين معًا.
 */
export const UPLOAD_DOCUMENT_EXT: Record<string, string> = {
  ...UPLOAD_IMAGE_EXT,
  "application/pdf": "pdf",
};

/**
 * بصّامة المستندات — صورة أو PDF. `null` = نوع غير مقبول (ومنه SVG وأوفيس وكل ما عداه).
 *
 * ⚠️ **خريطة التقديم تغطّي المخرجات كلها سلفًا**: امتدادات الصور مشتقّة من
 * `UPLOAD_IMAGE_EXT`، و`pdf` مُدرج في `DRAWING_EXT_MIME` — كلاهما داخل
 * `SERVE_CONTENT_TYPE` (`paths.ts:91`). فلا يُقبل رفع نوع لا يعرف الخادم تقديمه،
 * وهو الاتجاه أحادي الجانب المنصوص عليه في IN-40.
 */
export function sniffDocumentMime(buf: Buffer): string | null {
  return sniffImageMime(buf) ?? sniffPdfMime(buf);
}
