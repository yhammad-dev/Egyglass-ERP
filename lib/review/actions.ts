"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const REVIEW_ROLES = ["ADMIN", "REVIEW"];

export async function getPendingReviewQuotations() {
  const roleCheck = await requireRole(REVIEW_ROLES);
  if (!roleCheck.authorized) return [];

  const quotations = await prisma.quotation.findMany({
    where: { reviewStatus: "PENDING_REVIEW" },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return quotations.map((q) => ({
    id: q.id,
    number: q.number,
    customerName: q.customer.name,
    total: q.total.toNumber(),
    createdByName: q.createdBy.name,
    createdAt: q.createdAt.toISOString(),
  }));
}

export async function getReviewQuotationDetail(id: string) {
  const roleCheck = await requireRole(REVIEW_ROLES);
  if (!roleCheck.authorized) return null;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  if (!quotation) return null;

  return {
    id: quotation.id,
    number: quotation.number,
    reviewStatus: quotation.reviewStatus,
    reviewNote: quotation.reviewNote,
    createdAt: quotation.createdAt.toISOString(),
    subtotal: quotation.subtotal.toNumber(),
    taxPct: quotation.taxPct.toNumber(),
    taxAmount: quotation.taxAmount.toNumber(),
    total: quotation.total.toNumber(),
    customer: quotation.customer,
    createdBy: quotation.createdBy,
    items: quotation.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
    })),
  };
}

const approveSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
});

export async function approveQuotationAction(input: unknown) {
  const roleCheck = await requireRole(REVIEW_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const quotation = await prisma.quotation.findUnique({
    where: { id: parsed.data.id },
  });
  if (!quotation) return { error: "errors.notFound" as const };

  await prisma.quotation.update({
    where: { id: parsed.data.id },
    data: {
      reviewStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: roleCheck.userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "APPROVE",
      entity: "Quotation",
      entityId: quotation.id,
      details: `تمت الموافقة على عرض السعر ${quotation.number}`,
    },
  });

  return { success: true as const };
}

const rejectSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().min(1, "errors.rejectReasonRequired"),
});

export async function rejectQuotationAction(input: unknown) {
  const roleCheck = await requireRole(REVIEW_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.reason?.[0] ?? "errors.invalidInput",
    };
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: parsed.data.id },
  });
  if (!quotation) return { error: "errors.notFound" as const };

  await prisma.quotation.update({
    where: { id: parsed.data.id },
    data: {
      reviewStatus: "RETURNED",
      reviewNote: parsed.data.reason,
      reviewedAt: new Date(),
      reviewedById: roleCheck.userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "REJECT",
      entity: "Quotation",
      entityId: quotation.id,
      details: `تم إرجاع عرض السعر ${quotation.number} بسبب: ${parsed.data.reason}`,
    },
  });

  return { success: true as const };
}
