import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // أمان: لا كلمة مرور صلبة في الكود — تُقرأ من env، وقيمة الـ placeholder تُرفض أيضًا.
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword || seedPassword === "<SET_STRONG_PASSWORD>") {
    throw new Error(
      "SEED_ADMIN_PASSWORD env var is required — set a real value in .env (not the placeholder)"
    );
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@egyglass.com" },
    update: {},
    create: {
      name: "مدير النظام",
      email: "admin@egyglass.com",
      passwordHash,
      role: "ADMIN",
      department: "EXECUTIVE",
      isActive: true,
    },
  });

  console.log("✅ Admin user created:", admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
