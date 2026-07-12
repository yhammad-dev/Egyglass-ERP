"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "../finance/scope";
import { createContractCore } from "@/lib/services/contract-core";

// R-03: read-only financial visibility, least-privilege scoped by getFinanceScope.
const ACCOUNTING_READ_ROLES = ["ADMIN", "ACCOUNTING", "PROJECTS", "TECHNICAL_OFFICE"];
// Writes (recording payments) stay accounting-only — R-03 only expands reads.
const ACCOUNTING_WRITE_ROLES = ["ADMIN", "ACCOUNTING"];

export async function getAccountingDashboard() {
  try {
    const roleCheck = await requireRole(ACCOUNTING_READ_ROLES);
    if (!roleCheck.authorized) return [];

    const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
    if (scope.kind === "none") return [];

    const quotations = await prisma.quotation.findMany({
      where: {
        reviewStatus: "APPROVED",
        ...(scope.kind === "filtered" ? scope.quotationWhere : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
        // Payment-engine part B: rows with a contract can open the milestone
        // plan editor / balances panel (getContractBalances needs contractId).
        contract: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return quotations.map((q) => {
      // RR-1 STEP-4: contract value is quotation.total, which is now the
      // post-discount, post-VAT figure computed server-side in createQuotation
      // (never the raw subtotal).
      // SCR-015 دفعة 2: التجميع Decimal كامل — التحويل لـ number عند حدود الإرجاع فقط
      const totalPaidDec = q.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      const remainingDec = q.total.sub(totalPaidDec);
      const totalContract = q.total.toNumber();
      const totalPaid = totalPaidDec.toNumber();
      const remaining = remainingDec.toNumber();

      return {
        quotationId: q.id,
        number: q.number,
        customerId: q.customer.id,
        customerName: q.customer.name,
        totalContract,
        totalPaid,
        remaining,
        contractId: q.contract?.id ?? null,
        status: (remaining <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID") as
          | "PAID"
          | "PARTIAL"
          | "UNPAID",
      };
    });
  } catch (error) {
    console.error("[getAccountingDashboard]", error);
    return [];
  }
}

// ─── SCR-015 دفعة 2: شيت العميل (أعمدة راندا) — قراءة مجمّعة per-customer ─────
// يخضع لـ getFinanceScope (R-03) كباقي القراءات المالية — لا يتجاوزه.
export type CustomerSheetRow = {
  quotationId: string;
  number: string;
  date: Date;
  description: string;
  totalContract: number;
  totalPaid: number;
  remaining: number;
};

export async function getCustomerSheet(customerId: string): Promise<{
  customerName: string;
  rows: CustomerSheetRow[];
  totals: { contract: number; paid: number; remaining: number };
} | null> {
  try {
    const roleCheck = await requireRole(ACCOUNTING_READ_ROLES);
    if (!roleCheck.authorized) return null;

    const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
    if (scope.kind === "none") return null;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true },
    });
    if (!customer) return null;

    const quotations = await prisma.quotation.findMany({
      where: {
        customerId,
        reviewStatus: "APPROVED",
        ...(scope.kind === "filtered" ? scope.quotationWhere : {}),
      },
      include: {
        payments: { select: { amount: true } },
        project: { select: { nameAr: true } },
        items: { select: { description: true }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    });

    // التجميع Decimal كامل — التحويل لـ number عند حدود الإرجاع فقط
    const D = Prisma.Decimal;
    let contractSum = new D(0);
    let paidSum = new D(0);

    const rows = quotations.map((q) => {
      const paid = q.payments.reduce((sum, p) => sum.add(p.amount), new D(0));
      const remaining = q.total.sub(paid);
      contractSum = contractSum.add(q.total);
      paidSum = paidSum.add(paid);
      return {
        quotationId: q.id,
        number: q.number,
        date: q.createdAt,
        description: q.project?.nameAr ?? q.items[0]?.description ?? "—",
        totalContract: q.total.toNumber(),
        totalPaid: paid.toNumber(),
        remaining: remaining.toNumber(),
      };
    });

    return {
      customerName: customer.name,
      rows,
      totals: {
        contract: contractSum.toNumber(),
        paid: paidSum.toNumber(),
        remaining: contractSum.sub(paidSum).toNumber(),
      },
    };
  } catch (error) {
    console.error("[getCustomerSheet]", error);
    return null;
  }
}

export async function getPayments(quotationId: string) {
  try {
    const roleCheck = await requireRole(ACCOUNTING_READ_ROLES);
    if (!roleCheck.authorized) return [];

    const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
    if (scope.kind === "none") return [];

    // Defense-in-depth: even if called directly with a quotationId outside
    // the dashboard list, verify it is actually within the caller's scope.
    if (scope.kind === "filtered") {
      const inScope = await prisma.quotation.findFirst({
        where: { id: quotationId, ...scope.quotationWhere },
        select: { id: true },
      });
      if (!inScope) return [];
    }

    const payments = await prisma.payment.findMany({
      where: { quotationId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
    });

    return payments.map((p) => ({
      id: p.id,
      amount: p.amount.toNumber(),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      notes: p.notes,
      createdByName: p.createdBy.name,
    }));
  } catch (error) {
    console.error("[getPayments]", error);
    return [];
  }
}

const addPaymentSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  amount: z.coerce.number().positive("errors.invalidInput"),
  paidAt: z.string().min(1, "errors.invalidInput"),
  method: z.string().min(1, "errors.required"),
  notes: z.string().optional(),
});

export async function addPayment(input: unknown) {
  try {
    const roleCheck = await requireRole(ACCOUNTING_WRITE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = addPaymentSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const quotation = await prisma.quotation.findUnique({
      where: { id: parsed.data.quotationId },
      select: {
        id: true,
        number: true,
        customerId: true,
        reviewStatus: true,
        contract: { select: { id: true } },
        quotationRequest: { select: { technicalRoute: true } },
      },
    });
    if (!quotation) return { error: "errors.notFound" as const };

    // D-14: عقد السوشيال يُنشأ آليًا عند أول دفعة (لا عقد له بعد + مساره سوشيال +
    // التسعير معتمد نهائيًا). العقد والدفعة في **transaction واحدة** — لا حالة فاسدة.
    const shouldAutoCreateContract =
      !quotation.contract &&
      quotation.quotationRequest?.technicalRoute === "SOCIAL_MEDIA" &&
      quotation.reviewStatus === "APPROVED"; // Q1: نهائية التسعير المعتمدة

    await prisma.$transaction(async (tx) => {
      if (shouldAutoCreateContract) {
        const contractResult = await createContractCore(
          { customerId: quotation.customerId, quotationId: quotation.id },
          roleCheck.userId, // createdById = المحاسب المسجِّل، لا المندوب (D-14)
          tx
        );
        if ("error" in contractResult) {
          // يفشل كامل الـ transaction — لا دفعة بلا عقد
          throw new Error(`AUTO_CONTRACT_FAILED:${contractResult.error}`);
        }
        await tx.activityLog.create({
          data: {
            userId: roleCheck.userId,
            action: "CONTRACT_AUTO_CREATED",
            entity: "Contract",
            entityId: contractResult.contract.id,
            details: `عقد سوشيال أُنشئ تلقائيًا عند أول دفعة على عرض ${quotation.number} (بيد الحسابات — D-14)`,
          },
        });
      }

      const created = await tx.payment.create({
        data: {
          quotationId: parsed.data.quotationId,
          amount: parsed.data.amount,
          paidAt: new Date(parsed.data.paidAt),
          method: parsed.data.method,
          notes: parsed.data.notes,
          createdById: roleCheck.userId,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "CREATE",
          entity: "Payment",
          entityId: created.id,
          details: `تم تسجيل دفعة بقيمة ${parsed.data.amount} لعرض السعر ${quotation.number}`,
        },
      });

      return created;
    });

    return { success: true as const };
  } catch (error) {
    console.error("[addPayment]", error);
    return { error: "errors.serverError" as const };
  }
}
