import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateInvoiceDocumentNumber } from "@/lib/finance/document-number";

// SCR-015 دفعة 2: منطق الفاتورة — كل الحسابات Decimal، snapshot يتجمّد عند الإصدار
const D = Prisma.Decimal;

export class InvoiceError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "InvoiceError";
  }
}

export interface CreateInvoiceInput {
  quotationId: string;
  contractId?: string;
  statementId?: string;
  notes?: string;
}

/** حساب مبالغ الفاتورة من العرض — VAT على الصافي بعد الخصم (§5)، Decimal صرف */
function computeAmounts(q: {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxPct: Prisma.Decimal;
}) {
  const net = q.subtotal.sub(q.discountAmount);
  const vatAmount = net.mul(q.taxPct).div(100);
  const totalAmount = net.add(vatAmount);
  return {
    subtotal: q.subtotal,
    discountAmount: q.discountAmount,
    vatAmount,
    totalAmount,
  };
}

/** ينشئ فاتورة DRAFT — مشاريع (بربط عقد/مستخلص) أو سوشيال مباشرة (كلاهما NULL) */
export async function createInvoice(input: CreateInvoiceInput, actorId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: input.quotationId },
    select: {
      id: true,
      customerId: true,
      subtotal: true,
      discountAmount: true,
      taxPct: true,
    },
  });
  if (!quotation) throw new InvoiceError("errors.notFound");

  const amounts = computeAmounts(quotation);

  const invoice = await prisma.invoice.create({
    data: {
      customerId: quotation.customerId,
      quotationId: quotation.id,
      contractId: input.contractId ?? null,
      statementId: input.statementId ?? null,
      notes: input.notes ?? null,
      ...amounts,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INVOICE_CREATED",
      entity: "Invoice",
      entityId: invoice.id,
      details: `فاتورة مسودة لعرض ${quotation.id} — إجمالي ${amounts.totalAmount}`,
    },
  });

  return invoice;
}

/**
 * يُصدر فاتورة DRAFT: يعيد حساب المبالغ من العرض لحظة الإصدار **ويجمّدها** (snapshot)،
 * يولّد documentNumber عبر الدالة المركزية، transaction ذرّية.
 */
export async function issueInvoice(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      include: {
        quotation: {
          select: {
            subtotal: true,
            discountAmount: true,
            taxPct: true,
            quotationRequest: { select: { technicalRoute: true } },
          },
        },
      },
    });
    if (!invoice) throw new InvoiceError("errors.notFound");
    if (invoice.status !== "DRAFT") throw new InvoiceError("errors.invoiceNotDraft");
    if (!invoice.quotation) throw new InvoiceError("errors.notFound");

    const now = new Date();
    const route =
      invoice.quotation.quotationRequest?.technicalRoute ??
      (invoice.contractId ? "PROJECTS" : "SOCIAL_MEDIA");
    const documentNumber = await generateInvoiceDocumentNumber(
      tx,
      invoice.contractId,
      route,
      now
    );

    // لحظة التجميد — بعدها لا تُقرأ قيم العرض لايف أبدًا
    const amounts = computeAmounts(invoice.quotation);

    const issued = await tx.invoice.update({
      where: { id },
      data: {
        status: "ISSUED",
        documentNumber,
        issuedAt: now,
        issuedById: actorId,
        ...amounts,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "INVOICE_ISSUED",
        entity: "Invoice",
        entityId: id,
        details: `صدرت الفاتورة ${documentNumber} — إجمالي مجمّد ${amounts.totalAmount}`,
      },
    });

    return issued;
  });
}

/** إلغاء فاتورة صادرة — سند لا يُحذف: ISSUED→CANCELLED فقط، بالسبب */
export async function cancelInvoice(id: string, reason: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, documentNumber: true },
    });
    if (!invoice) throw new InvoiceError("errors.notFound");
    if (invoice.status !== "ISSUED") throw new InvoiceError("errors.invoiceNotIssued");

    const cancelled = await tx.invoice.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "INVOICE_CANCELLED",
        entity: "Invoice",
        entityId: id,
        details: `أُلغيت الفاتورة ${invoice.documentNumber} — السبب: ${reason}`,
      },
    });

    return cancelled;
  });
}
