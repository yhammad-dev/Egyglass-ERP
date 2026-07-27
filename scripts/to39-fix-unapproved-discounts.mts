/**
 * TO-39 — تصحيح بأثر رجعي: عروض طُبِّق عليها الخصم قبل اعتماده.
 *
 * 🔴 **يُنفّذه المالك بنفسه** (L-04: الوكيل لا يكتب في القاعدة مباشرة).
 *
 * لماذا سكربت لا SQL خام: الشرط المُلزِم أن تُعاد الإجماليات بـ**نفس صيغة**
 * `recomputeQuotationTotals` لا بصيغة مكتوبة يدويًا. SQL لا يستطيع استيراد
 * الدالة، وأي إعادة كتابة لها في SQL تُنشئ **نسخة رابعة** من الصيغة — وهو
 * بالضبط العيب الذي عالجته TO-39. هذا السكربت يستورد الدالة نفسها.
 *
 * التشغيل:
 *   docker compose exec app npx tsx scripts/to39-fix-unapproved-discounts.mts          # معاينة
 *   docker compose exec app npx tsx scripts/to39-fix-unapproved-discounts.mts --apply  # تنفيذ
 *
 * يبدأ **بمعاينة بلا كتابة**. لا يكتب شيئًا إلا مع `--apply`.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { recomputeQuotationTotals } from "../src/lib/quotation-totals";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  /**
   * تعريف «لم يُعتمد خصمه»: مبلغ خصم مطبَّق على الصف، **وليس** له طلب خصم
   * حالته APPROVED. مصدر الحقيقة هو `DiscountRequest` لا حالة العرض — الحالة
   * تُغيَّر يدويًا من مسارات أخرى (`updateQuotationStatus`)، أما قرار الخصم
   * فلا يكتبه إلا `decideDiscountAction`.
   */
  // ⚠️ `DiscountRequest` بلا علاقة Prisma إلى `Quotation` (عمود `quotationId`
  // قياسي بفهرس فقط) — فالاستبعاد يتم باستعلامين لا بفلتر متداخل.
  // `ADJUSTED` تُعدّ اعتمادًا: المدير عدّل النسبة واعتمدها، والإجماليات كُتبت
  // فعلًا في `decideDiscountAction` (نفس فرع APPROVED).
  const approved = await prisma.discountRequest.findMany({
    where: { status: { in: ["APPROVED", "ADJUSTED"] } },
    select: { quotationId: true },
  });
  const approvedQuotationIds = [...new Set(approved.map((r) => r.quotationId))];

  const candidates = await prisma.quotation.findMany({
    where: {
      deletedAt: null,
      discountAmount: { gt: 0 },
      id: { notIn: approvedQuotationIds },
    },
    select: {
      id: true,
      number: true,
      status: true,
      subtotal: true,
      discountPct: true,
      discountAmount: true,
      taxPct: true,
      taxAmount: true,
      total: true,
    },
    orderBy: { number: "asc" },
  });

  if (candidates.length === 0) {
    console.log("صفر صف يحتاج تصحيحًا.");
    return;
  }

  console.log(`${APPLY ? "تنفيذ" : "معاينة (بلا كتابة)"} — ${candidates.length} صفًا:\n`);
  console.log(
    "الرقم".padEnd(15),
    "الحالة".padEnd(18),
    "خصم%".padEnd(7),
    "الإجمالي قبل".padEnd(15),
    "الإجمالي بعد"
  );

  let totalDelta = new Prisma.Decimal(0);

  for (const q of candidates) {
    // 🔴 نفس الدالة التي يستعملها الإنشاء والتعديل والاعتماد — بخصم صفر،
    // لأن هذه الصفوف لم يعتمد خصمها أحد.
    const fixed = recomputeQuotationTotals(q.subtotal, new Prisma.Decimal(0), q.taxPct);
    const delta = fixed.total.sub(q.total);
    totalDelta = totalDelta.add(delta);

    console.log(
      q.number.padEnd(15),
      q.status.padEnd(18),
      q.discountPct.toString().padEnd(7),
      q.total.toFixed(2).padEnd(15),
      fixed.total.toFixed(2)
    );

    if (APPLY) {
      await prisma.quotation.update({
        where: { id: q.id },
        data: {
          // `discountPct` **يبقى** — سجلّ الطلب لا يُمحى (قرار TO-39).
          discountAmount: fixed.discountAmount, // = 0
          taxAmount: fixed.taxAmount,
          total: fixed.total,
        },
      });
      await prisma.activityLog.create({
        data: {
          userId: (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id,
          action: "TO39_DISCOUNT_BACKFILL",
          entity: "Quotation",
          entityId: q.id,
          details: `[تصحيح TO-39] خصم ${q.discountPct}% كان مطبَّقًا بلا اعتماد — أُزيل من الإجماليات. الإجمالي ${q.total.toFixed(2)} ⇒ ${fixed.total.toFixed(2)}`,
        },
      });
    }
  }

  console.log(`\nفرق الإجماليات الكلي: ${totalDelta.toFixed(2)}`);
  if (!APPLY) console.log("\n⚠️ معاينة فقط. أعد التشغيل بـ --apply للتنفيذ.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
