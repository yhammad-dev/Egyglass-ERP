import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

/**
 * TO-07 — بوابة المصادقة على الملفات المرفوعة.
 * TO-13 — إصلاح انحدار MissingSecret.
 *
 * 🔴 لماذا middleware أصلًا: الملفات تحت `public/uploads/**` و Next يخدم `public/`
 * ساكنًا **قبل أي كود** — مُتحقَّق: ملف موجود كان يعود 200 بترويسات الخادم الساكن بلا
 * جلسة، بينما ملف غير موجود كان يسقط إلى route.ts. الـmiddleware هي الطبقة الوحيدة
 * التي تسبق الخادم الساكن.
 *
 * 🔴 TO-13 — جذر الانحدار: الإصدار السابق استخدم `getToken` من "next-auth/jwt"،
 * وهي واجهة v4 تبحث افتراضيًا عن `NEXTAUTH_SECRET`. هذا المشروع على Auth.js v5
 * ويضبط `AUTH_SECRET` فقط (مُتحقَّق من متغيرات بيئة الحاوية) ⇒ استثناء MissingSecret
 * على **كل** طلب /uploads، فحُجب المصادَق وغير المصادَق معًا وانقطع اللوجو والصور.
 * الإصلاح ليس تمرير السر يدويًا بل استخدام آلية التطبيق نفسها: NextAuth(authConfig)
 * يقرأ AUTH_SECRET كما يقرؤه باقي التطبيق ⇒ صنف الخطأ يزول من جذره لا يُرقَّع.
 *
 * لماذا تُستبدل `authorized`: الـcallback المشترك في auth.config.ts يعيد **توجيهًا
 * إلى /login** عند غياب الجلسة — وهو سلوك صحيح لتنقّل الصفحات وخاطئ تمامًا لمورد
 * ملفّي: وسم <img> يتلقى صفحة HTML فيُنتج «isn't a valid image» بدل خطأ مفهوم.
 * لذا تُحيَّد هنا (محليًا، بلا مساس بالملف المشترك) ويقرّر الحارس أدناه: 401 صريح.
 *
 * 🔴 حدّ النطاق: يضمن **"مُصادَق فقط"** لا "مصرَّح له بهذا الملف تحديدًا".
 * التدقيق على مستوى السجل بند منفصل لم يُنفَّذ.
 */
const { auth } = NextAuth({
  ...authConfig,
  callbacks: { ...authConfig.callbacks, authorized: () => true },
});

const guarded = auth((request) => {
  if (!request.auth?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.next();
});

export default async function middleware(
  request: NextRequest,
  // النوع مشتقّ من الغلاف نفسه بدل تخمينه: Next يمرّر NextFetchEvent وقت التشغيل،
  // بينما توقيع auth() يعلن سياق route handler. الاشتقاق يمنع كذبة `as`/`any`.
  event: Parameters<typeof guarded>[1]
) {
  // TO-13 (قيد 2): أي فشل في قراءة الجلسة ⇒ رفض منظّم لا استثناء غير ملتقَط.
  // الاستثناء غير الملتقَط هنا يتحول إلى 500 صامت يحجب الملفات عن الجميع —
  // وهو بالضبط ما حدث في هذا الانحدار.
  try {
    return await guarded(request, event);
  } catch (error) {
    console.error("[middleware/uploads] فشل قراءة الجلسة", error);
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

// النطاق مقصور على الملفات المرفوعة عمدًا (قيد 1): بقية المسارات محروسة بـrequireRole
// على مستوى الصفحة/الأكشن، وتوسيع الـmatcher يغيّر سلوك التطبيق كله.
export const config = {
  matcher: ["/uploads/:path*"],
};
