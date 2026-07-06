"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const AUDIT_ROLES = ["ADMIN"];
const PAGE_SIZE = 50;

const filtersSchema = z.object({
  userId: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AuditLogFilters = z.infer<typeof filtersSchema>;

export async function getAuditLogs(filters: unknown, page = 1) {
  try {
    const roleCheck = await requireRole(AUDIT_ROLES);
    if (!roleCheck.authorized) return { logs: [], total: 0, page: 1, pageSize: PAGE_SIZE };

    const parsed = filtersSchema.safeParse(filters ?? {});
    const f = parsed.success ? parsed.data : {};
    const safePage = Math.max(1, page);

    const where = {
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.entityType ? { entity: f.entityType } : {}),
      ...(f.dateFrom || f.dateTo
        ? {
            createdAt: {
              ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}),
              ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        userName: log.user.name,
        action: log.action,
        entityType: log.entity,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
    };
  } catch (error) {
    console.error("[getAuditLogs]", error);
    return { logs: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getAuditFilterOptions() {
  try {
    const roleCheck = await requireRole(AUDIT_ROLES);
    if (!roleCheck.authorized) return { users: [], entityTypes: [] };

    const [users, entityTypes] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.activityLog.findMany({
        select: { entity: true },
        distinct: ["entity"],
        orderBy: { entity: "asc" },
      }),
    ]);

    return {
      users,
      entityTypes: entityTypes.map((e) => e.entity),
    };
  } catch (error) {
    console.error("[getAuditFilterOptions]", error);
    return { users: [], entityTypes: [] };
  }
}
