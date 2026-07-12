"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { notifyRole } from "@/lib/notifications/send";
import {
  createInvoice,
  issueInvoice,
  cancelInvoice,
  InvoiceError,
} from "@/lib/services/invoices";

// SCR-015 دفعة 2: server actions للفواتير — الحراسة هنا، المنطق في services/invoices.ts
const INVOICE_ROLES = ["ACCOUNTING", "ADMIN"];
// D-21: الإصدار (= الاعتماد) بيد ADMIN وحده. ACCOUNTING تجهّز المسودة فقط.
const INVOICE_ISSUE_ROLES = ["ADMIN"];

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

    // D-21: مسودة جاهزة → إشعار ADMIN (صاحب قرار الإصدار)
    await notifyRole("ADMIN", {
      title: "invoices.awaitingApprovalTitle",
      body: `فاتورة مسودة بانتظار الاعتماد للإصدار`,
      type: "INVOICE_AWAITING_APPROVAL",
      entityId: invoice.id,
      entityType: "Invoice",
    });

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
    // D-21: الإصدار = الاعتماد النهائي — ADMIN فقط (ACCOUNTING تُرفَض)
    const roleCheck = await requireRole(INVOICE_ISSUE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = issueInvoiceSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const invoice = await issueInvoice(parsed.data.id, roleCheck.userId);

    // D-21: بعد اعتماد ADMIN وإصدارها → إشعار ACCOUNTING (الرقم تجمّد، تذهب للعميل)
    await notifyRole("ACCOUNTING", {
      title: "invoices.issuedTitle",
      body: `صدرت الفاتورة ${invoice.documentNumber} — جاهزة للعميل`,
      type: "INVOICE_ISSUED",
      entityId: invoice.id,
      entityType: "Invoice",
    });

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
    if (!parsed.success) {
      // D-24: السبب إلزامي server-side (لا UI فقط)
      return {
        error:
          parsed.error.flatten().fieldErrors.reason?.[0] ??
          ("errors.invalidInput" as const),
      };
    }

    const cancelled = await cancelInvoice(
      parsed.data.id,
      parsed.data.reason,
      roleCheck.userId
    );

    // D-24: إشعار فوري لـ ADMIN (رقم + مبلغ + سبب) — الضابط = الأثر والرؤية لا المنع
    await notifyRole("ADMIN", {
      title: "invoices.cancelledTitle",
      body: `أُلغيت الفاتورة ${cancelled.documentNumber ?? cancelled.id} — مبلغ ${cancelled.totalAmount} — السبب: ${parsed.data.reason}`,
      type: "INVOICE_CANCELLED",
      entityId: cancelled.id,
      entityType: "Invoice",
    });

    return { success: true as const };
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    console.error("[cancelInvoiceAction]", e);
    return { error: "errors.serverError" as const };
  }
}
