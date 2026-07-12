"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "../finance/scope";
import { notifyRole } from "@/lib/notifications/send";
import {
  recomputeCustomerStage,
  recomputeQuotationRequestStatus,
} from "@/lib/services/status-derivation";
import { z } from "zod";

const CONTRACT_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];
// R-03: read-only financial visibility, least-privilege scoped by getFinanceScope.
const CONTRACT_READ_ROLES = [...CONTRACT_ROLES, "REVIEW", "VIEWER", "PROJECTS", "TECHNICAL_OFFICE"];

const createSchema = z.object({
  customerId: z.string().min(1),
  quotationId: z.string().min(1),
  signedAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function createContract(input: unknown) {
  try {
    const roleCheck = await requireRole(CONTRACT_ROLES);
    if (!roleCheck.authorized) return { error: "غير مخول" };

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { error: "بيانات غير صحيحة" };

    const { customerId, quotationId, signedAt, notes } = parsed.data;

    const existing = await prisma.contract.findUnique({ where: { quotationId } });
    if (existing) return { error: "يوجد عقد مرتبط بهذا العرض بالفعل" };

    // SCR-014: fetch the quotation to snapshot its total as the frozen contract
    // value (official rule: value freezes at issuance; later changes = new
    // contract/annex, never a live read of the mutable quotation).
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, number: true, total: true, customer: { select: { name: true } } },
    });
    if (!quotation) return { error: "عرض السعر غير موجود" };

    const contract = await prisma.contract.create({
      data: {
        customerId,
        quotationId,
        signedAt: signedAt ? new Date(signedAt) : null,
        notes: notes || null,
        createdById: roleCheck.userId,
        totalValue: quotation.total, // snapshot — frozen at issuance (Decimal, no float)
      },
    });

    // دفعة هـ · Phase 4: المرحلة تُشتق لا تُكتب يدويًا — وجود العقد الآن يشتق CONTRACT.
    await recomputeCustomerStage(customerId, roleCheck.userId);

    // طلب التسعير المربوط بهذا العرض يُشتق DONE (اكتملت دورة المكتب الفني).
    const linkedRequest = await prisma.quotationRequest.findFirst({
      where: { quotationId },
      select: { id: true },
    });
    if (linkedRequest) {
      await recomputeQuotationRequestStatus(linkedRequest.id, roleCheck.userId);
    }

    // دفعة هـ: اشتقاق isRepeat (إغلاق ثغرة مالية) — العميل يصبح "مكرر" حقيقةً
    // عند أول تعاقد، وهو شرط أهلية الكاش باك. ActivityLog للأثر المالي.
    const cust = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { isRepeat: true, name: true },
    });
    if (cust && !cust.isRepeat) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isRepeat: true },
      });
      await prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "CUSTOMER_BECAME_REPEAT",
          entity: "Customer",
          entityId: customerId,
          details: `أصبح العميل ${cust.name} "مكرّرًا" بعد أول تعاقد — صار مؤهلًا للكاش باك`,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
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

    return { success: true, contract };
  } catch (e) {
    console.error(e);
    return { error: "فشل إنشاء العقد" };
  }
}

export async function getContractByQuotation(quotationId: string) {
  try {
    const roleCheck = await requireRole(CONTRACT_READ_ROLES);
    if (!roleCheck.authorized) return null;

    // R-03: only the newly-added least-privilege roles need scope filtering;
    // pre-existing roles (ADMIN/SALES_MANAGER/SALES_REP/REVIEW/VIEWER) keep
    // their existing unrestricted contract-read access unchanged.
    if (roleCheck.role === "PROJECTS" || roleCheck.role === "TECHNICAL_OFFICE") {
      const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
      if (scope.kind === "none") return null;
      if (scope.kind === "filtered") {
        const inScope = await prisma.quotation.findFirst({
          where: { id: quotationId, ...scope.quotationWhere },
          select: { id: true },
        });
        if (!inScope) return null;
      }
    }

    return await prisma.contract.findUnique({
      where: { quotationId },
      include: { createdBy: { select: { name: true } } },
    });
  } catch {
    return null;
  }
}
