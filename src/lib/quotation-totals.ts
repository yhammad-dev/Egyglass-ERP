import { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal;

/**
 * TO-39 — صيغة إجماليات عرض السعر. **مصدر واحد** يستعمله الإنشاء والتعديل
 * ومسار اعتماد الخصم.
 *
 * كانت الصيغة مكتوبة ثلاث مرات (`createQuotation` · `updateQuotation` ·
 * `decideDiscountAction`)، وهو ما سمح لمسارين أن يطبّقا الخصم فورًا بينما
 * المسار الثالث وحده يملك حق تطبيقه. نقلها إلى هنا يجعل الانحراف مستحيلًا.
 *
 * القاعدة (RR-1، بلا تغيير): الخصم على الإجمالي ⇒ الصافي ⇒ **الضريبة على
 * الصافي بعد الخصم** لا على الإجمالي.
 *
 * ⚠️ Decimal من طرف إلى طرف (L-07) — لا float في أي خطوة.
 * ⚠️ ملف عادي **ليس** `"use server"`: ملفات الأفعال لا تُصدِّر إلا دوالّ async،
 * فبقاء الصيغة داخلها كان يفرض نسخًا متعددة.
 */
export function recomputeQuotationTotals(subtotal: Dec, discountPct: Dec, taxPct: Dec) {
  const discountAmount = subtotal.mul(discountPct).div(100);
  const netAfterDiscount = subtotal.sub(discountAmount);
  const taxAmount = netAfterDiscount.mul(taxPct).div(100);
  const total = netAfterDiscount.add(taxAmount);
  return { discountAmount, netAfterDiscount, taxAmount, total };
}

/**
 * 🔴 TO-39 — نسبة الخصم **النافذة** عند حساب الإجماليات.
 *
 * قرار المالك: «الخصم لا يُحسب إطلاقًا حتى يُوافَق عليه» — تنفيذًا لـD-19 الذي
 * ينصّ على أن أي خصم > 0 **طلب** لا تطبيق. كان الكود يحفظ الإجمالي ناقص الخصم
 * فورًا ثم يضع `PENDING_APPROVAL`، فخرجت أوراق مطبوعة عليها «بانتظار الموافقة»
 * وخصم مطبَّق فعلًا.
 *
 * `discountPct` يبقى محفوظًا على الصف بوصفه **سجلّ الطلب**، لكنه لا يدخل
 * الحساب حتى يعتمده صاحب الصلاحية عبر `decideDiscountAction`.
 */
export function effectiveDiscountPct(requestedPct: Dec, isApproved: boolean): Dec {
  return isApproved ? requestedPct : new Prisma.Decimal(0);
}
