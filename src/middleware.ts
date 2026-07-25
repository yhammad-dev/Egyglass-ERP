import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * TO-07 — بوابة المصادقة على الملفات المرفوعة.
 *
 * 🔴 لماذا middleware ولا يكفي route handler:
 * الملفات تُخزَّن تحت `public/uploads/**`، و Next يخدم `public/` **ساكنًا قبل أي كود**.
 * مُتحقَّق بالتجربة: ملف موجود كان يعود 200 بترويسات الخادم الساكن
 * (Accept-Ranges/Cache-Control) بلا أي جلسة، بينما ملف **غير موجود** كان يسقط
 * إلى src/app/uploads/[...path]/route.ts فيعيد 401. أي أن الـroute handler
 * كان كودًا ميتًا لكل ملف حقيقي. الـmiddleware هي الطبقة الوحيدة التي تسبق
 * خادم الملفات الساكنة، فهي المكان الوحيد الذي يمكنه إغلاق الباب فعليًا.
 *
 * getToken (edge-safe) لا PrismaAdapter — الجلسة JWT (auth.ts: strategy "jwt")
 * فالتحقق لا يحتاج قاعدة بيانات. لم أستخدم غلاف `auth()` لأن callback الـauthorized
 * في auth.config.ts يعيد توجيهًا إلى /login (302)، والمطلوب هنا 401 صريح لمورد ملفّي.
 *
 * 🔴 حدّ النطاق: هذا يضمن **"مُصادَق فقط"** لا "مصرَّح له بهذا الملف تحديدًا".
 * أي مستخدم مسجَّل ما زال يستطيع جلب أي ملف يعرف مساره — التدقيق على مستوى
 * السجل بند منفصل لم يُنفَّذ.
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secureCookie: request.nextUrl.protocol === "https:",
  });

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

// النطاق مقصور على الملفات المرفوعة عمدًا: بقية المسارات محروسة بـrequireRole
// على مستوى الصفحة/الأكشن، وتوسيع الـmatcher هنا يغيّر سلوك التطبيق كله بلا داعٍ.
export const config = {
  matcher: ["/uploads/:path*"],
};
