"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "../finance/scope";

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
      const totalContract = q.total.toNumber();
      const totalPaid = q.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const remaining = totalContract - totalPaid;

      return {
        quotationId: q.id,
        number: q.number,
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
    });
    if (!quotation) return { error: "errors.notFound" as const };

    const payment = await prisma.payment.create({
      data: {
        quotationId: parsed.data.quotationId,
        amount: parsed.data.amount,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method,
        notes: parsed.data.notes,
        createdById: roleCheck.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        details: `تم تسجيل دفعة بقيمة ${parsed.data.amount} لعرض السعر ${quotation.number}`,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[addPayment]", error);
    return { error: "errors.serverError" as const };
  }
}
