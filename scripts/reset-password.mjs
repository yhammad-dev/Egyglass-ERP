/**
 * ⛔ أداة break-glass — لا تُستخدم في التشغيل العادي.
 *
 * الغرض: إعادة تعيين كلمة مرور مستخدم عند انسداد كل مسار داخل التطبيق
 * (مثال: ADMIN نسي كلمته ولا مسار استرجاع — BL-47). ليست بديلًا عن شاشة
 * إدارة المستخدمين؛ تُشغَّل يدويًا من داخل الحاوية بيد من يملك الخادم فقط.
 *
 * لا تمنح قدرة جديدة (من يملك الحاوية يملك القاعدة أصلًا) — لكنها تجعل الفعل
 * **مسجَّلًا** (ActivityLog: PASSWORD_RESET_BREAKGLASS) بدل كتابة صامتة (BL-48).
 *
 * أمانيات: كلمة المرور تُدخَل تفاعليًا من stdin (لا كوسيط CLI → لا shell history)
 * ولا تُطبع على الشاشة. المخرج الوحيد عند النجاح = "OK".
 *
 * التشغيل داخل الحاوية:
 *   docker compose exec app node scripts/reset-password.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline";

const BCRYPT_COST = 12; // مطابق لـ auth.ts / seed.ts

/** سؤال tty؛ hidden=true يكتم صدى الإدخال (لكلمة المرور) */
function ask(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  return new Promise((resolve) => {
    rl._writeToOutput = (str) => {
      if (rl.__muted) rl.output.write(""); // ابتلاع صدى الأحرف
      else rl.output.write(str);
    };
    rl.question(query, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    if (hidden) rl.__muted = true; // بعد كتابة السؤال، اكتم ما يليه
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const email = (await ask("Email: ")).trim();
    if (!email) {
      console.error("ERROR: email required");
      process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error("ERROR: user not found");
      process.exit(1);
    }

    const password = await ask("New password (hidden): ", true);
    if (!password || password.length < 8) {
      console.error("ERROR: password too short (min 8)");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: user.id, // الفاعل = مشغّل الحاوية (CLI بلا هوية تطبيق) — مسجَّل على الحساب المُعاد ضبطه
          action: "PASSWORD_RESET_BREAKGLASS",
          entity: "User",
          entityId: user.id,
          details: JSON.stringify({
            target: email,
            via: "break-glass CLI (host operator)",
            at: new Date().toISOString(),
          }),
        },
      }),
    ]);

    console.log("OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
