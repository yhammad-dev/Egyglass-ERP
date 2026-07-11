"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  createInvoice,
  issueInvoice,
  cancelInvoice,
  InvoiceError,
} from "@/lib/services/invoices";

// SCR-015 دفعة 2: server actions للفواتير — الحراسة هنا، المنطق في services/invoices.ts
const INVOICE_ROLES = ["ACCOUNTING", "ADMIN"];

const createInvoiceSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  contractId: z.string().optional(),
  statementId: z.string().optional(),
  notes: z.string().optional(),
});

export async function createInvoiceAction(input: unknown) {
  try {
    const roleCheck = await requireRole(INVOICE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const invoice = await createInvoice(parsed.data, roleCheck.userId);
    return { success: true as const, id: invoice.id };
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    console.error("[createInvoiceAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const issueInvoiceSchema = z.object({ id: z.string().min(1, "errors.invalidInput") });

export async function issueInvoiceAction(input: unknown) {
  try {
    const roleCheck = await requireRole(INVOICE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = issueInvoiceSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const invoice = await issueInvoice(parsed.data.id, roleCheck.userId);
    return {
      success: true as const,
      id: invoice.id,
      documentNumber: invoice.documentNumber,
    };
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    console.error("[issueInvoiceAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const cancelInvoiceSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().min(1, "errors.cancelReasonRequired"),
});

export async function cancelInvoiceAction(input: unknown) {
  try {
    const roleCheck = await requireRole(INVOICE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = cancelInvoiceSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await cancelInvoice(parsed.data.id, parsed.data.reason, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    console.error("[cancelInvoiceAction]", e);
    return { error: "errors.serverError" as const };
  }
}
