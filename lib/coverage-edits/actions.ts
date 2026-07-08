"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const COVERAGE_EDITS_ROLES = ["ADMIN", "SALES_MANAGER"];
const MAX_ROWS = 500;

export type CoverageEditRow = {
  id: string;
  editorName: string;
  customerId: string;
  customerName: string;
  ownerName: string;
  action: string;
  createdAt: string;
};

export async function getCoverageEdits(): Promise<CoverageEditRow[]> {
  try {
    const roleCheck = await requireRole(COVERAGE_EDITS_ROLES);
    if (!roleCheck.authorized) return [];

    const logs = await prisma.activityLog.findMany({
      where: {
        entity: "Customer",
        user: { role: "SALES_REP" },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });

    if (logs.length === 0) return [];

    const customerIds = Array.from(new Set(logs.map((log) => log.entityId)));

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { name: true } },
      },
    });

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // "Coverage edit" = a SALES_REP wrote on a Customer they are not the current owner of.
    // Unassigned customers (ownerId null) are excluded — there is no colleague being covered.
    const coverageLogs = logs.filter((log) => {
      const customer = customerMap.get(log.entityId);
      return (
        customer != null &&
        customer.ownerId != null &&
        customer.ownerId !== log.userId
      );
    });

    return coverageLogs.map((log) => {
      const customer = customerMap.get(log.entityId)!;
      return {
        id: log.id,
        editorName: log.user.name,
        customerId: customer.id,
        customerName: customer.name,
        ownerName: customer.owner?.name ?? "",
        action: log.action,
        createdAt: log.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error("[getCoverageEdits]", error);
    return [];
  }
}
