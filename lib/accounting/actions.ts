"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const ACCOUNTING_ROLES = ["ADMIN", "ACCOUNTING"];

export async function getAccountingDashboard() {
  const roleCheck = await requireRole(ACCOUNTING_ROLES);
  if (!roleCheck.authorized) return [];

  const quotations = await prisma.quotation.findMany({
    where: { reviewStatus: "APPROVED" },
    include: {
      customer: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return quotations.map((q) => {
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
      status: (remaining <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID") as
        | "PAID"
        | "PARTIAL"
        | "UNPAID",
    };
  });
}

export async function getPayments(quotationId: string) {
  const roleCheck = await requireRole(ACCOUNTING_ROLES);
  if (!roleCheck.authorized) return [];

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
}

const addPaymentSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  amount: z.coerce.number().positive("errors.invalidInput"),
  paidAt: z.string().min(1, "errors.invalidInput"),
  method: z.string().min(1, "errors.required"),
  notes: z.string().optional(),
});

export async function addPayment(input: unknown) {
  const roleCheck = await requireRole(ACCOUNTING_ROLES);
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
}
