import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { t } from "@/lib/server-translations";

/**
 * BL-136: رسالة "غير مصرّح" موحّدة — تظهر بدل redirect صامت لـ/dashboard لمن
 * يفتح صفحة محروسة بدور غير مصرَّح. تُرندَر داخل shell الداشبورد (route group
 * (dashboard))، فالقائمة الجانبية تكون قد أخفت الرابط أصلًا لنفس الدور
 * (getNavItems) — هذه الرسالة تغطّي الدخول المباشر بالرابط رغم اختفائه.
 *
 * كل النصوص عبر server-translations t() — لا نص hardcoded. المفاتيح في
 * errors.* (namespace مشترك لرفض الصلاحيات) وموجودة في ملفَّي اللغة معًا.
 * الأيقونة من lucide-react (SVG، تبعية قائمة) لا material-symbols — خط الأخير
 * غير مُحمَّل في المشروع فيرتدّ نصًّا خامًا (رصد أثناء BL-136).
 */
export function Unauthorized() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white rounded-lg border p-8 max-w-md text-center flex flex-col items-center gap-4">
        <ShieldAlert className="w-16 h-16 text-red-500" aria-hidden="true" />
        <h1 className="text-xl font-bold text-gray-900">
          {t("errors.notAuthorized")}
        </h1>
        <p className="text-sm text-gray-500">{t("errors.notAuthorizedBody")}</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 transition-colors"
        >
          {t("errors.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
