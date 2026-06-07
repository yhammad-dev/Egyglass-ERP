import { PrismaClient, Role, Department, PipelineStage } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@egyglass.com" },
    update: {},
    create: {
      name: "مدير النظام",
      email: "admin@egyglass.com",
      passwordHash,
      role: Role.ADMIN,
      department: Department.EXECUTIVE,
    },
  });

  const salesManager = await prisma.user.upsert({
    where: { email: "salesmanager@egyglass.com" },
    update: {},
    create: {
      name: "مدير المبيعات",
      email: "salesmanager@egyglass.com",
      passwordHash,
      role: Role.SALES_MANAGER,
      department: Department.SALES,
    },
  });

  const salesRep = await prisma.user.upsert({
    where: { email: "salesrep@egyglass.com" },
    update: {},
    create: {
      name: "مندوب مبيعات",
      email: "salesrep@egyglass.com",
      passwordHash,
      role: Role.SALES_REP,
      department: Department.SALES,
    },
  });

  const inspectionManager = await prisma.user.upsert({
    where: { email: "inspection@egyglass.com" },
    update: {},
    create: {
      name: "مدير المعاينات",
      email: "inspection@egyglass.com",
      passwordHash,
      role: Role.INSPECTION_MANAGER,
      department: Department.INSPECTIONS,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@egyglass.com" },
    update: {},
    create: {
      name: "مشاهد",
      email: "viewer@egyglass.com",
      passwordHash,
      role: Role.VIEWER,
      department: Department.SALES,
    },
  });

  const customer1 = await prisma.customer.create({
    data: {
      name: "أحمد محمد",
      phone: "01000000001",
      type: "INDIVIDUAL",
      source: "AD",
      address: "القاهرة الجديدة",
      stage: PipelineStage.NEW,
      ownerId: salesRep.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: "شركة الزجاج الحديث",
      phone: "01000000002",
      altPhone: "01000000003",
      type: "COMPANY",
      source: "REFERRAL",
      address: "مدينة نصر",
      stage: PipelineStage.PRICED,
      ownerId: salesRep.id,
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: "م. خالد علي",
      phone: "01000000004",
      type: "ENGINEER",
      source: "EXHIBITION",
      address: "الشيخ زايد",
      stage: PipelineStage.FOLLOW_UP,
      ownerId: salesRep.id,
    },
  });

  const customer4 = await prisma.customer.create({
    data: {
      name: "محمد حسن",
      phone: "01000000005",
      type: "INDIVIDUAL",
      source: "WHATSAPP",
      address: "المعادي",
      stage: PipelineStage.REJECTED,
      rejectReason: "السعر مرتفع جداً",
      ownerId: salesRep.id,
    },
  });

  const customer5 = await prisma.customer.create({
    data: {
      name: "شركة الأهرام للزجاج",
      phone: "01000000006",
      type: "COMPANY",
      source: "VISIT",
      address: "العاشر من رمضان",
      stage: PipelineStage.INSPECTION,
      ownerId: salesRep.id,
    },
  });

  const quotation1 = await prisma.quotation.create({
    data: {
      number: "Q-2026-0001",
      customerId: customer2.id,
      createdById: salesRep.id,
      subtotal: 50000,
      discountPct: 10,
      discountAmount: 5000,
      taxPct: 14,
      taxAmount: 6300,
      total: 51300,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: "SENT",
      items: {
        create: [
          {
            description: "زجاج سيكوريت 10مم",
            quantity: 50,
            unitPrice: 800,
            lineTotal: 40000,
          },
          {
            description: "زجاج سيكوريت 6مم",
            quantity: 20,
            unitPrice: 500,
            lineTotal: 10000,
          },
        ],
      },
    },
  });

  const quotation2 = await prisma.quotation.create({
    data: {
      number: "Q-2026-0002",
      customerId: customer5.id,
      createdById: salesRep.id,
      subtotal: 120000,
      discountPct: 20,
      discountAmount: 24000,
      taxPct: 14,
      taxAmount: 13440,
      total: 109440,
      needsApproval: true,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: "PENDING_APPROVAL",
      items: {
        create: [
          {
            description: "واجهة زجاجية سيكوريت 12مم",
            quantity: 80,
            unitPrice: 1200,
            lineTotal: 96000,
          },
          {
            description: "باب زجاج مفصلات أرضية",
            quantity: 4,
            unitPrice: 6000,
            lineTotal: 24000,
          },
        ],
      },
    },
  });

  const inspection1 = await prisma.inspectionRequest.create({
    data: {
      customerId: customer5.id,
      location: "INSIDE_CAIRO",
      address: "العاشر من رمضان",
      phone: "01000000006",
      status: "REQUESTED",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  const inspection2 = await prisma.inspectionRequest.create({
    data: {
      customerId: customer3.id,
      location: "OUTSIDE_CAIRO",
      address: "الشيخ زايد",
      phone: "01000000004",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      assigneeId: inspectionManager.id,
    },
  });

  const inspection3 = await prisma.inspectionRequest.create({
    data: {
      customerId: customer2.id,
      location: "INSIDE_CAIRO",
      address: "مدينة نصر",
      phone: "01000000002",
      status: "DONE",
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      assigneeId: inspectionManager.id,
    },
  });

  console.log("Seed completed successfully");
  console.log(`Users: 5 (admin, salesManager, salesRep, inspectionManager, viewer)`);
  console.log(`Customers: 5`);
  console.log(`Quotations: 2`);
  console.log(`Inspections: 3`);
  console.log("\nDefault password for all users: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
