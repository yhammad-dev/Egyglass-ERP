import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://egyglass:egyglass_dev_pw@localhost:5433/egyglass?schema=public'
    }
  }
});

async function main() {
  console.log('Starting cleanup...');

  const r1 = await prisma.activityLog.deleteMany();
  console.log(`Deleted ${r1.count} activity logs`);

  const r2 = await prisma.quotationApproval.deleteMany();
  console.log(`Deleted ${r2.count} quotation approvals`);

  const r3 = await prisma.quotationItem.deleteMany();
  console.log(`Deleted ${r3.count} quotation items`);

  const r4 = await prisma.quotation.deleteMany();
  console.log(`Deleted ${r4.count} quotations`);

  const r5 = await prisma.inspectionMeasurement.deleteMany();
  console.log(`Deleted ${r5.count} inspection measurements`);

  const r6 = await prisma.inspectionPhoto.deleteMany();
  console.log(`Deleted ${r6.count} inspection photos`);

  const r7 = await prisma.attachment.deleteMany();
  console.log(`Deleted ${r7.count} attachments`);

  const r8 = await prisma.inspectionRequest.deleteMany();
  console.log(`Deleted ${r8.count} inspection requests`);

  const r9 = await prisma.notification.deleteMany();
  console.log(`Deleted ${r9.count} notifications`);

  try {
    const ri = await prisma.interaction.deleteMany();
    console.log(`Deleted ${ri.count} interactions`);
  } catch(e) { console.log('Interaction delete skipped:', e.message); }

  try {
    const rref = await prisma.referral.deleteMany();
    console.log(`Deleted ${rref.count} referrals`);
  } catch(e) { console.log('Referral delete skipped:', e.message); }

  try {
    const rdr = await prisma.discountRequest.deleteMany();
    console.log(`Deleted ${rdr.count} discount requests`);
  } catch(e) { console.log('DiscountRequest delete skipped:', e.message); }

  try {
    const rp = await prisma.payment.deleteMany();
    console.log(`Deleted ${rp.count} payments`);
  } catch(e) { console.log('Payment delete skipped:', e.message); }

  try {
    const rmo = await prisma.manufacturingOrder.deleteMany();
    console.log(`Deleted ${rmo.count} manufacturing orders`);
  } catch(e) { console.log('ManufacturingOrder delete skipped:', e.message); }

  try {
    const rio = await prisma.installationOrder.deleteMany();
    console.log(`Deleted ${rio.count} installation orders`);
  } catch(e) { console.log('InstallationOrder delete skipped:', e.message); }

  const r10 = await prisma.customer.deleteMany();
  console.log(`Deleted ${r10.count} customers`);

  const r11 = await prisma.project.deleteMany();
  console.log(`Deleted ${r11.count} projects`);

  console.log('\nCleanup complete! System config tables preserved.');

  const users = await prisma.user.count();
  const productTypes = await prisma.productType.count();
  const materials = await prisma.material.count();
  const pricingFactors = await prisma.pricingFactor.count();
  console.log(`System config intact:`);
  console.log(`  Users: ${users}`);
  console.log(`  ProductTypes: ${productTypes}`);
  console.log(`  Materials: ${materials}`);
  console.log(`  PricingFactors: ${pricingFactors}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
