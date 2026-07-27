import { prisma } from "@/lib/prisma";

/**
 * TO-30 — القاعدة: **مسار المهندس = مسار تيم ليدره** (قرار المالك).
 *
 * 🔴 مصدر واحد يستعمله الإنشاء والتعديل وطلب اعتماد الفاكتور وإعادة التقديم.
 * نسختان من القاعدة = بوابة نصفية — وهو ما وقع مرتين في هذه السلسلة:
 * مُنع الإنشاء وبقي التعديل، ثم مُنع الاثنان وبقيت ثلاثة مسارات أخرى.
 *
 * TO-31 — نُقلت من `lib/pricing/actions.ts` إلى هنا: ذلك الملف `"use server"`،
 * ولا يُصدِّر إلا **أفعال شبكة**. تصدير هذا الحارس منه كان سيحوّله إلى نقطة
 * استدعاء عن بُعد، واستيراده في `lib/review/actions.ts` بلا تصدير مستحيل —
 * فالبديل الوحيد نسخة ثانية، وهي بالضبط ما نتجنّبه.
 * الملف هنا **ليس** `"use server"` ⇒ دالة عادية تُستدعى داخل السيرفر فقط.
 * ⚠️ لا تستوردها في مكوّن كلاينت — تجرّ Prisma إلى الحزمة.
 *
 * تُرجع مفتاح خطأ للرفض، أو `null` للسماح. لا ترمي أبدًا.
 * حالات السماح الصريح:
 *  · الدور ليس `TECHNICAL_OFFICE` — ADMIN/TEC_APPROVER بلا حدود مسار، وTEC_LEAD
 *    محدود سلفًا بمساره في نطاقه الخاص.
 *  · العرض بلا طلب تسعير ⇒ لا مسار يُقارَن به.
 *  · المهندس بلا تيم ليدر ⇒ لا مسار يمكن اشتقاقه (نفس قرار `buildWhere`: لا نشلّ
 *    من لم يُربط بعد — 3 من 4 مهندسين اليوم). يُسجَّل كي لا يكون التخطي صامتًا.
 */
export async function checkEngineerRoute(
  role: string,
  userId: string,
  requestRoute: string | null | undefined,
  context: string
): Promise<string | null> {
  if (role !== "TECHNICAL_OFFICE") return null;
  if (!requestRoute) return null;

  const engineer = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamLead: { select: { leadRoute: true } } },
  });
  const engineerRoute = engineer?.teamLead?.leadRoute ?? null;

  if (!engineerRoute) {
    console.warn(
      `[pricing] ROUTE_GUARD_SKIPPED ${context} engineer=${userId} — المهندس بلا تيم ليدر`
    );
    return null;
  }

  if (engineerRoute !== requestRoute) {
    console.warn(
      `[pricing] ROUTE_MISMATCH_BLOCKED ${context} engineer=${userId} engineerRoute=${engineerRoute} requestRoute=${requestRoute}`
    );
    return "errors.requestOutsideEngineerRoute";
  }

  return null;
}
