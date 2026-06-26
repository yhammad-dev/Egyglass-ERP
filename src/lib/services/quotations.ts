import { prisma } from "@/lib/prisma";
import type { QuotationStatus, CustomerSource } from "@prisma/client";

// ── Status Bucket ────────────────────────────────────

export type StatusBucket = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "EXPIRED";

export const STATUS_BUCKET_I18N: Record<StatusBucket, string> = {
  NEW: "quotations.statusBucket_NEW",
  IN_PROGRESS: "quotations.statusBucket_IN_PROGRESS",
  ON_HOLD: "quotations.statusBucket_ON_HOLD",
  COMPLETED: "quotations.statusBucket_COMPLETED",
  EXPIRED: "quotations.statusBucket_EXPIRED",
};

/**
 * Pure function — maps QuotationStatus → display bucket.
 * DRAFT → NEW | SENT → IN_PROGRESS | PENDING_APPROVAL → ON_HOLD |
 * APPROVED → COMPLETED | EXPIRED → EXPIRED
 */
export function mapStatusToBucket(status: QuotationStatus): StatusBucket {
  const map: Record<QuotationStatus, StatusBucket> = {
    DRAFT: "NEW",
    SENT: "IN_PROGRESS",
    PENDING_APPROVAL: "ON_HOLD",
    APPROVED: "COMPLETED",
    EXPIRED: "EXPIRED",
  };
  return map[status];
}

// ── Row type ─────────────────────────────────────────

export interface QuotationRow {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  source: CustomerSource;
  statusBucket: StatusBucket;
  total: number;
  createdAt: Date;
  technicalEngineer: string | null;
  salesResponsible: string | null;
  inspectionsResponsible: string | null; // always null — no Quotation→Inspection link exists
}

// ── Fetch ────────────────────────────────────────────

export async function getQuotations(
  userId: string,
  role: string,
): Promise<QuotationRow[]> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (role === "SALES_REP") {
    where.OR = [
      { createdById: userId },
      { customer: { ownerId: userId } },
    ];
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      customer: {
        select: {
          name: true,
          phone: true,
          source: true,
          owner: { select: { name: true } },
        },
      },
    },
  });

  return quotations.map((q) => ({
    id: q.id,
    number: q.number,
    customerName: q.customer.name,
    customerPhone: q.customer.phone,
    source: q.customer.source as CustomerSource,
    statusBucket: mapStatusToBucket(q.status as QuotationStatus),
    total: Number(q.total),
    createdAt: q.createdAt,
    technicalEngineer: q.createdBy?.name ?? null,
    salesResponsible: q.customer.owner?.name ?? null,
    inspectionsResponsible: null,
  }));
}
