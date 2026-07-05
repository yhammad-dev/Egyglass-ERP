import { PrismaClient, QtyRule, FactorMode } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCT_TYPE_ID = "cmqve5u5z0006r0f6dikq90u1";

const recipes: {
  materialId: string;
  qtyRule: QtyRule;
  defaultQty: number;
  factorMode: FactorMode;
  notes: string;
}[] = [
  // زجاج -> BY_AREA
  { materialId: "cmqve5u84000fr0f62t4z99fg", qtyRule: "BY_AREA", defaultQty: 1.0, factorMode: "STANDARD", notes: "GLASS" }, // 8 مم شفاف
  { materialId: "cmqve5u8h000gr0f6z2bwn7qu", qtyRule: "BY_AREA", defaultQty: 1.0, factorMode: "STANDARD", notes: "GLASS" }, // 10 مم شفاف
  { materialId: "cmqve5u8n000hr0f6x8od2djv", qtyRule: "BY_AREA", defaultQty: 1.0, factorMode: "STANDARD", notes: "GLASS" }, // 12 مم شفاف

  // قطاع التثبيت -> BY_LENGTH
  { materialId: "cmqve5uq90058r0f61cssfrq0", qtyRule: "BY_LENGTH", defaultQty: 1.0, factorMode: "STANDARD", notes: "SECTION" }, // قطاع التثبيت
  { materialId: "cmqve5upj0051r0f66l80owyi", qtyRule: "BY_LENGTH", defaultQty: 1.0, factorMode: "STANDARD", notes: "SECTION" }, // U شاور الومنيوم فضى 2 سم

  // شداد -> FIXED / FIXED_AFTER
  { materialId: "cmqve5ux30071r0f6umoaibwt", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "TENSION" }, // شداد فضى
  { materialId: "cmqve5ux60072r0f6zwlrbv3z", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "TENSION" }, // شداد اسود / ذهبى

  // مقبض -> FIXED / FIXED_AFTER
  { materialId: "cmqve5usc005sr0f67fomjota", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "HANDLE" }, // مقبض 60 فضى
  { materialId: "cmqve5usm005ur0f6obysjvka", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "HANDLE" }, // مقبض 60 اسود

  // كوع -> FIXED / FIXED_AFTER
  { materialId: "cmqve5ux90073r0f6j7pe9d8p", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "ELBOW" }, // كوع فضى
  { materialId: "cmqve5uxd0074r0f6b8y66sdv", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "ELBOW" }, // كوع اسود / ذهبى

  // سيليكون -> FIXED / FIXED_AFTER (always included, no choice)
  { materialId: "cmqve5uz6007lr0f6t0ucenu6", qtyRule: "FIXED", defaultQty: 1, factorMode: "FIXED_AFTER", notes: "SILICON" }, // سيليكون
];

async function main() {
  await prisma.productRecipe.deleteMany({
    where: { productTypeId: PRODUCT_TYPE_ID },
  });

  const result = await prisma.productRecipe.createMany({
    data: recipes.map((r) => ({
      productTypeId: PRODUCT_TYPE_ID,
      materialId: r.materialId,
      qtyRule: r.qtyRule,
      defaultQty: r.defaultQty,
      factorMode: r.factorMode,
      notes: r.notes,
      updatedAt: new Date(),
    })),
  });

  console.log("Inserted:", result.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
