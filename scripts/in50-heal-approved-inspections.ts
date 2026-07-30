/**
 * IN-50 — تصحيح لمرة واحدة: معاينات مُعتمدة حالتها التشغيلية ليست DONE.
 *
 * ═══ لماذا يلزم سكربت أصلًا ═══
 * قبل IN-50 كان `approvalStatus` و`InspectionStatus` بُعدين منفصلين، فأمكن اعتماد
 * معاينة وهي `SCHEDULED`. ثم أتى حارس IN-13 (موجة A) فمنع تغيير الحالة بعد الاعتماد
 * ⇒ هذه الصفوف **محبوسة بنيويًا**: `inspectionActive` تبقى true للأبد، ومرحلة
 * عميلها لا تخرج من `INSPECTION` بأي إجراء متاح في الواجهة.
 * إصلاح IN-50 يمنع تكوّن صفوف جديدة كهذه، ولا يلمس القائم — فهذا دوره.
 *
 * ═══ حدود صريحة ═══
 * • **لا يلمس إلا** صفوفًا `approvalStatus = APPROVED` و`status <> DONE`. لا شيء غيرها.
 * • يكتب `ActivityLog` لكل صف بفاعل حقيقي — لا تصحيح صامت بلا أثر تدقيقي.
 * • يعيد اشتقاق حالة الطلب ومرحلة العميل عبر `recomputeAfterInspection` نفسها التي
 *   يستعملها التطبيق — لا منطق حالة موازٍ (نفس قاعدة status-derivation الوحيدة).
 * • كل صف في معاملة مستقلة: فشل صف لا يُسقط الباقي ولا يترك نصف تصحيح.
 * • **DRY-RUN افتراضيًا.** لا يكتب حرفًا بلا `--apply`.
 * • يُشغَّل مرة واحدة. تشغيله ثانيًا بلا صفوف مؤهَّلة = لا عمل (idempotent).
 *
 * ═══ التشغيل ═══
 *   معاينة فقط (لا كتابة):
 *     docker compose exec app npx tsx scripts/in50-heal-approved-inspections.ts
 *   التنفيذ الفعلي:
 *     docker compose exec app npx tsx scripts/in50-heal-approved-inspections.ts --apply
 *
 * الفاعل: يُقرأ من `IN50_ACTOR_EMAIL` (إن غاب → أقدم ADMIN نشط). لا مجهول في الأثر.
 */
import { prisma } from "@/lib/prisma";
import { recomputeAfterInspection } from "@/lib/services/status-derivation";

const APPLY = process.argv.includes("--apply");

/**
 * سقف أمان: البند يعالج صفَّين مرصودين. أي عدد أكبر معناه أن الحالة صارت مشروعة
 * (مثلًا بعد بناء «إعادة الفتح المقنَّن» في موجة لاحقة) ⇒ السكربت يتوقف ولا يُصحّح
 * جماعيًا بلا قرار بشري. رقم مقصود لا سحري: أُنشئ للصفَّين وحدهما.
 */
const MAX_ROWS = 5;

/**
 * الفاعل **ADMIN حصرًا**: السكربت يكتب ActivityLog على ثلاثة كيانات (المعاينة +
 * الطلب + العميل عبر recomputeAfterInspection)، وسجلّا الاشتقاق يحملان
 * {from,to,derived} فقط فيُقرأان كنشاط واجهة عادي لشخص مسمّى. نسبتهما لغير ADMIN
 * تُلبس تصحيحًا إداريًا ثوبَ عمل مستخدم عادي.
 */
async function resolveActor(): Promise<{ id: string; name: string; email: string }> {
  const email = process.env.IN50_ACTOR_EMAIL?.trim();

  if (email) {
    const user = await prisma.user.findFirst({
      where: { email, role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      throw new Error(
        `IN50_ACTOR_EMAIL=${email} لا يطابق ADMIN نشطًا — التصحيح يُنسب لأدمن فقط`
      );
    }
    return user;
  }

  // بلا بريد صريح: أقدم ADMIN نشط. الأثر يجب أن يُنسب لشخص، لا لـ"system".
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });
  if (!admin) throw new Error("لا يوجد ADMIN نشط لنسبة الأثر إليه — أوقفت العمل");
  return admin;
}

async function main() {
  const actor = await resolveActor();

  const stuck = await prisma.inspectionRequest.findMany({
    // `deletedAt: null` مثل كل قراءات الموديول — لا نُحيي صفًّا محذوفًا منطقيًا
    where: { approvalStatus: "APPROVED", status: { not: "DONE" }, deletedAt: null },
    select: {
      id: true,
      status: true,
      customerId: true,
      approvedAt: true,
      customer: { select: { name: true, stage: true } },
    },
    orderBy: { approvedAt: "asc" },
  });

  console.log(`\n── IN-50 heal ${APPLY ? "APPLY" : "DRY-RUN"} ──`);
  console.log(`الفاعل: ${actor.name} <${actor.email}>`);
  console.log(`صفوف مؤهَّلة (APPROVED و status<>DONE): ${stuck.length}\n`);

  if (stuck.length === 0) {
    console.log("لا عمل. (السكربت idempotent — هذه نتيجة صحيحة بعد تشغيله مرة.)");
    return;
  }

  for (const ins of stuck) {
    console.log(
      `  ${ins.id}  status=${ins.status} → DONE  |  عميل: ${ins.customer.name} (المرحلة الآن ${ins.customer.stage})`
    );
  }

  if (stuck.length > MAX_ROWS) {
    console.error(
      `\n🔴 توقّف: ${stuck.length} صفًّا مؤهَّلًا والسقف ${MAX_ROWS}.\n` +
        "هذا السكربت أُنشئ لصفَّين مرصودين. عدد أكبر معناه أن «معتمدة وغير DONE»\n" +
        "صارت حالة مشروعة في النظام (إعادة فتح مقنَّنة؟) — وحينها التصحيح الجماعي\n" +
        "قرار بشري لا سكربت. راجع الحالة أولًا ثم عدّل السقف بوعي إن لزم."
    );
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log(
      "\nلم يُكتب شيء. أعد التشغيل بـ --apply للتنفيذ.\n" +
        "ملاحظة: مرحلة كل عميل ستُشتق بعد التصحيح، فقد تتقدّم أو تتراجع بحسب وقائعه\n" +
        "(عقد/عرض/تركيب). المراحل البشرية (REJECTED · FOLLOW_UP · RE_INSPECTION_FOLLOWUP)\n" +
        "محمية ولا تُدهس — IN-37."
    );
    return;
  }

  let healed = 0;
  const failures: { id: string; error: string }[] = [];

  for (const ins of stuck) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.inspectionRequest.update({
          where: { id: ins.id },
          data: { status: "DONE" },
        });
        await tx.activityLog.create({
          data: {
            userId: actor.id,
            action: "INSPECTION_STATUS_HEALED_IN50",
            entity: "InspectionRequest",
            entityId: ins.id,
            details: JSON.stringify({
              from: ins.status,
              to: "DONE",
              reason:
                "IN-50: معاينة معتمدة كانت محبوسة بحالة تشغيلية غير DONE — تصحيح لمرة واحدة",
              script: "scripts/in50-heal-approved-inspections.ts",
            }),
          },
        });
        // نفس القاعدة الوحيدة التي يستعملها التطبيق — لا منطق حالة موازٍ
        await recomputeAfterInspection(ins.id, ins.customerId, actor.id, tx);
      });
      healed++;
      console.log(`  ✓ ${ins.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ id: ins.id, error: message });
      console.error(`  ✗ ${ins.id} — ${message}`);
    }
  }

  console.log(`\nتمّ: ${healed}/${stuck.length}`);
  if (failures.length > 0) {
    console.error(`فشل: ${failures.length} — راجعها يدويًا قبل أي خطوة تالية.`);
    process.exitCode = 1;
  }

  const after = await prisma.customer.findMany({
    where: { id: { in: stuck.map((s) => s.customerId) } },
    select: { id: true, name: true, stage: true },
  });
  console.log("\nمراحل العملاء بعد التصحيح:");
  for (const c of after) console.log(`  ${c.name}: ${c.stage}`);
}

main()
  .catch((error) => {
    console.error("\n[IN-50 heal] توقّف:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
