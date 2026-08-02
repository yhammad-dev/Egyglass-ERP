import { prisma } from "@/lib/prisma";

/**
 * ══ BL-196 — المصدر الواحد لنطاق رؤية عرض السعر بالدور ════════════════════════
 *
 * القاعدة نفسها **الموجودة والعاملة** في `getQuotations` (`services/quotations.ts:81-99`)
 * — منقولة حرفيًا بلا تغيير شرط واحد:
 *
 * | الدور              | ما يراه                                                     |
 * |--------------------|-------------------------------------------------------------|
 * | `SALES_REP`        | `OR[ createdById, customer.ownerId ]`                        |
 * | `TECHNICAL_OFFICE` | `createdById` (عروضه هو)                                     |
 * | `TEC_LEAD`         | `quotationRequest.technicalRoute = leadRoute` · وبلا مسار ⇒ صفر |
 * | الباقي             | الكل (بلا فلتر) — كما هو قائم                                 |
 *
 * 🔴 **لماذا وحدة جديدة ولم تُعدَّل `getQuotations`:** ملفات إصلاح `P0` (تسريب عروض
 * الأسعار) **محظور لمسها في هذا المرور** بنصّ التكليف، و`services/quotations.ts`
 * أحدها. وكتابة نسخة ثانية من القاعدة داخل وحدة المستندات كان **بالضبط** ما يمنعه
 * درس IN-12. فالمخرج: يُستخرج المصدر الواحد **هنا** الآن، وتستهلكه المستندات فورًا،
 * و`P0` يتبنّاه في القائمة والتفصيل والطباعة حين يُستأنف — وهو أصلًا ما يطلبه
 * بند `4.1` منه («دالة واحدة تبني `where` بحسب الدور»).
 * ⚠️ **حتى يُستأنف P0 تبقى القاعدة في موضعين** (هنا وفي `getQuotations`). مقصود
 * ومؤقّت ومسجَّل — وليس اكتشافًا يُترك لمن يأتي بعد.
 *
 * 🔴 **شرط الدور وحده — بلا `id` وبلا `deletedAt`.** كل مستدعٍ يضمّه إلى قاعدته:
 * القائمة تبدأ بـ`{ deletedAt: null }`، والقراءة المفردة بـ`{ id }`. خلط الاثنين هنا
 * كان سيغيّر سلوك مستدعٍ قائم بلا أن يطلب أحد (انظر `BL-197` لتفاوت `deletedAt`).
 */

/** `null` = لا وصول إلى أي عرض إطلاقًا (وليس «بلا قيد») — يجب أن يفحصه كل مستدعٍ. */
export type QuotationRoleScope = Record<string, unknown> | null;

export async function buildQuotationRoleScope(
  userId: string,
  role: string
): Promise<QuotationRoleScope> {
  if (role === "SALES_REP") {
    return { OR: [{ createdById: userId }, { customer: { ownerId: userId } }] };
  }
  if (role === "TECHNICAL_OFFICE") {
    return { createdById: userId };
  }
  if (role === "TEC_LEAD") {
    // `leadRoute` ليس في الجلسة (rbac.ts يُرجع userId/role فقط) — يُقرأ هنا.
    const lead = await prisma.user.findUnique({
      where: { id: userId },
      select: { leadRoute: true },
    });
    // 🔴 بلا مسار مُسنَد ⇒ **صفر عرض**، لا «بلا فلتر». إرجاع `{}` هنا كان سيقلب
    // المعنى إلى «يرى الكل» — عكس المقصود تمامًا. ولهذا النوع `| null` صراحةً.
    if (!lead?.leadRoute) return null;
    return { quotationRequest: { technicalRoute: lead.leadRoute } };
  }
  // ADMIN · SALES_MANAGER · TEC_APPROVER · VIEWER · غيرهم ⇒ بلا فلتر (السلوك القائم).
  return {};
}
