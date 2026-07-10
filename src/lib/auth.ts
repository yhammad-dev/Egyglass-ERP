import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

// ── SCR-016: قفل الحساب — ثوابت (قرار يوسف: rolling 24h، قفل 24h، 5 محاولات) ──
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // SCR-016: تقصير عمر الجلسة — أقصى تأخير لقطع جلسة مستخدم قُفل/عُطّل = 24h
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // SCR-016: كل مسارات الفشل تعيد null الموحّد نفسه — لا تسريب تمييز للخارج
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        // مقفول؟ رفض فوري — بلا فحص كلمة المرور وبلا زيادة العدّاد
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        if (!user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          const now = new Date();
          const windowExpired =
            !user.lastFailedLoginAt ||
            now.getTime() - user.lastFailedLoginAt.getTime() > LOCKOUT_WINDOW_MS;
          const attempts = windowExpired ? 1 : user.failedLoginAttempts + 1;
          const shouldLock = attempts >= LOCKOUT_MAX_ATTEMPTS;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lastFailedLoginAt: now,
              ...(shouldLock
                ? { lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS) }
                : {}),
            },
          });

          if (shouldLock) {
            await prisma.activityLog.create({
              data: {
                userId: user.id,
                action: "ACCOUNT_LOCKED",
                entity: "User",
                entityId: user.id,
                details: `قُفل الحساب تلقائيًا بعد ${attempts} محاولات دخول فاشلة خلال 24 ساعة — القفل حتى انقضاء 24 ساعة أو فك أدمن`,
              },
            });
          }

          return null;
        }

        // دخول ناجح — تصفير آثار الفشل (كتابة فقط عند الحاجة، لا على كل دخول)
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        };
      },
    }),
  ],
});
