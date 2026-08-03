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
 * **نشأتها:** استُخرجت في `BL-196` لأن حارس المستندات احتاج القاعدة، وملفات `P0`
 * كانت محظورة وقتها — فبقيت القاعدة في موضعين مؤقتًا.
 * ✅ **و`P0` (بند 4.1) أنهى الازدواج:** `getQuotations` والتفصيل والطباعة تستهلك
 * هذه الوحدة الآن. **هي المصدر الوحيد — أي تعديل على قاعدة النطاق يقع هنا وحده.**
 *
 * 🔴 **شرط الدور وحده — بلا `id` وبلا `deletedAt`.** كل مستدعٍ يضمّه إلى قاعدته:
 * القائمة تبدأ بـ`{ deletedAt: null }`، والقراءة المفردة بـ`{ id }` ثم `deletedAt`
 * بعد النطاق (`BL-197`). الفصل مقصود: **النطاق يجيب «مَن يرى»، و`deletedAt` يجيب
 * «ماذا يبقى مقروءًا» — بُعدان متعامدان، وخلطهما هنا كان يمنع أيًّا منهما من التغيّر
 * وحده.**
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
