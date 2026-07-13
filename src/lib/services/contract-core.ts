import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";
import {
  recomputeCustomerStage,
  recomputeQuotationRequestStatus,
} from "@/lib/services/status-derivation";

/**
 * جوهر إنشاء العقد — استخراج نقي من `lib/contracts/actions.ts:createContract`
 * (صفر تغيير سلوك؛ فقط بلا `requireRole`، وبمُعامل `db` لدعم transaction).
 * يستدعيه مساران: `createContract` المحروس (مشروعات، بيد المبيعات)، و`addPayment`
 * (سوشيال، بيد الحسابات عند أول دفعة — D-14). المسؤولية عن الحراسة على المستدعي.
 */
export interface CreateContractCoreInput {
  customerId: string;
  quotationId: string;
  signedAt?: string;
  notes?: string;
}

export async function createContractCore(
  input: CreateContractCoreInput,
  actorId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const { customerId, quotationId, signedAt, notes } = input;

  const existing = await db.contract.findUnique({ where: { quotationId } });
  if (existing) return { error: "يوجد عقد مرتبط بهذا العرض بالفعل" as const };

  // SCR-014: snapshot لإجمالي العرض كقيمة العقد المجمّدة (تُجمَّد عند الإصدار).
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      number: true,
      total: true,
      reviewStatus: true,
      customer: { select: { name: true } },
    },
  });
  if (!quotation) return { error: "عرض السعر غير موجود" as const };

  // PHASE 3.5 (BL-88/STD-15): لا عقد ضد سعر غير معتمد — الحارس server-side لا واجهة.
  // الاعتماد النهائي للتسعير = approveQuotationAction (TEC_APPROVER/ADMIN، route-agnostic).
  if (quotation.reviewStatus !== "APPROVED") {
    return { error: "errors.reviewNotApproved" as const };
  }

  const contract = await db.contract.create({
    data: {
      customerId,
      quotationId,
      signedAt: signedAt ? new Date(signedAt) : null,
      notes: notes || null,
      createdById: actorId,
      totalValue: quotation.total, // snapshot — frozen at issuance (Decimal, no float)
    },
  });

  // دفعة هـ · Phase 4: المرحلة تُشتق لا تُكتب يدويًا — وجود العقد الآن يشتق CONTRACT.
  await recomputeCustomerStage(customerId, actorId, db);

  // طلب التسعير المربوط بهذا العرض يُشتق DONE (اكتملت دورة المكتب الفني).
  const linkedRequest = await db.quotationRequest.findFirst({
    where: { quotationId },
    select: { id: true },
  });
  if (linkedRequest) {
    await recomputeQuotationRequestStatus(linkedRequest.id, actorId, db);
  }

  // دفعة هـ: اشتقاق isRepeat (إغلاق ثغرة مالية) — العميل يصبح "مكرر" عند أول تعاقد.
  const cust = await db.customer.findUnique({
    where: { id: customerId },
    select: { isRepeat: true, name: true },
  });
  if (cust && !cust.isRepeat) {
    await db.customer.update({
      where: { id: customerId },
      data: { isRepeat: true },
    });
    await db.activityLog.create({
      data: {
        userId: actorId,
        action: "CUSTOMER_BECAME_REPEAT",
        entity: "Customer",
        entityId: customerId,
        details: `أصبح العميل ${cust.name} "مكرّرًا" بعد أول تعاقد — صار مؤهلًا للكاش باك`,
      },
    });
  }

  await db.activityLog.create({
    data: {
      userId: actorId,
      action: "CONTRACT_CREATED",
      entity: "Contract",
      entityId: contract.id,
      details: `تم إنشاء عقد لعرض السعر ${quotation.number} بقيمة مجمّدة ${quotation.total.toFixed(2)}`,
    },
  });

  // دفعة د — ACC-R01: الحسابات تُخطَر فور التعاقد (لا تنتظر فتح الشاشة)
  await notifyRole("ACCOUNTING", {
    title: "notifications.contractCreatedTitle",
    body: `عقد جديد — العميل ${quotation.customer.name} · عرض ${quotation.number} · قيمة مجمّدة ${quotation.total.toFixed(2)} جنيه`,
    type: "CONTRACT_CREATED",
    entityId: contract.id,
    entityType: "Contract",
  });

  return { success: true as const, contract };
}
