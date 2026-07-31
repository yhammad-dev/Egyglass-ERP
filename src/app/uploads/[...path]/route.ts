import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { auth } from "@/lib/auth";
import { UPLOADS_ROOT, SERVE_CONTENT_TYPE } from "@/lib/storage/paths";

/**
 * TO-07 — تحصين خدمة الملفات المرفوعة.
 * TO-11 — الجذر صار خارج `public/`، فهذا المسار هو **الطريق الوحيد** للملفات.
 *
 * قبل: المسار كان مفتوحًا لأي زائر (بلا جلسة إطلاقًا) ويبني المسار بـjoin من
 * مقاطع URL بلا احتواء ⇒ الملفات كلها (رسومات، صور معاينات) كانت محمية بغموض
 * اسم الـUUID وحده، وقابلة نظريًا للخروج من مجلد uploads.
 *
 * الآن: (1) جلسة صالحة إلزامية — 401 بلا ذلك، بنفس آلية المشروع
 * (auth() من @/lib/auth، نفس نمط src/app/api/notifications/route.ts).
 * (2) احتواء المسار: رفض المقاطع الخبيثة ثم resolve ومقارنة بالجذر المُحلَّل.
 *
 * 🔴 التغيير الجوهري في TO-11: قبله كان الملف تحت `public/` فيخدمه Next **ساكنًا
 * قبل الوصول إلى هذا الملف أصلًا** — أي أن هذا الحارس كان يُتخطّى لكل ملف موجود
 * فعلًا (مُتحقَّق: 200 بترويسات الخادم الساكن بلا جلسة). بعد نقل الجذر خارج
 * `public/` لم يعد ثمة مسار ساكن يخدم هذه الملفات، فصار هذا الحارس **نافذًا بنيويًا**.
 * `src/middleware.ts` يبقى دفاعًا ثانيًا على `/uploads/*` ولم يُمس.
 *
 * 🔴 حدّ النطاق الصريح: هذا يضمن **"مُصادَق فقط"** لا "مصرَّح له بهذا الملف
 * تحديدًا". أي مستخدم مسجَّل يستطيع جلب أي ملف يعرف مساره. التدقيق على مستوى
 * السجل (هل يملك هذا المستخدم حق رؤية رسمة هذا المشروع؟) بند منفصل لم يُنفَّذ هنا.
 */
export async function GET(
  request: NextRequest,
  // Next 15: params صار Promise — التوقيع القديم كان يخالف RouteContext (خطأ نوع قائم).
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: segments } = await params;

  if (!Array.isArray(segments) || segments.length === 0) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // رفض المقاطع الخبيثة قبل أي لمس للقرص: صعود لأعلى · null byte · فاصل مسار
  // مدسوس (يشمل نتيجة فك ترميز %2F/%5C) · مقطع فارغ · مسار مطلق.
  const hasUnsafeSegment = segments.some(
    (s) =>
      typeof s !== "string" ||
      s.length === 0 ||
      s === "." ||
      s === ".." ||
      s.includes("\0") ||
      s.includes("/") ||
      s.includes("\\")
  );
  if (hasUnsafeSegment) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // الاحتواء الحقيقي: resolve للمسار المطلوب ومقارنته بالجذر المُحلَّل — لا مقارنة
  // نصية خام. الفاصل في نهاية الجذر يمنع تطابقًا كاذبًا مع مجلد شقيق (uploads-evil).
  const filePath = resolve(join(UPLOADS_ROOT, ...segments));
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + sep)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const file = await readFile(filePath);

    // بلا تغيير (TO-A): Content-Type يُشتق من الامتداد الخاضع للسيرفر، لا من
    // mimeType القادم من العميل — وهو ما يمنع XSS المخزَّن عبر نوع محتوى مزيّف.
    //
    // IN-40 (موجة B3): الخريطة كانت مكتوبة هنا يدويًا و**تجهل `webp`/`gif`** رغم
    // قبولهما صراحةً عند الرفع ⇒ يسقطان على octet-stream فينزّلهما المتصفح بدل
    // عرضهما. صارت مشتقّة من allowlist الرفع في `lib/storage/paths.ts` — قائمة واحدة
    // لبابين. المجهول يبقى octet-stream (تنزيل) كما كان — وهو الصحيح لـ`dwg`.
    const ext = segments[segments.length - 1].split(".").pop();
    const contentType =
      (ext ? SERVE_CONTENT_TYPE[ext] : undefined) ?? "application/octet-stream";

    return new NextResponse(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
