import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@2026!", 12);

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
