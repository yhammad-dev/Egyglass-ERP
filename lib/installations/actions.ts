"use server";

import { z } from "zod";
import { InstStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const INSTALLATION_ROLES = ["ADMIN", "INSTALLATIONS"];

export async function getInstallationOrders() {
  try {
    const roleCheck = await requireRole(INSTALLATION_ROLES);
    if (!roleCheck.authorized) return [];

    const orders = await prisma.installationOrder.findMany({
      include: {
        manufacturingOrder: {
          select: {
            id: true,
            quotation: {
              select: {
                id: true,
                number: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        },
        teamLead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((order) => ({
      id: order.id,
      quotationNumber: order.manufacturingOrder.quotation.number,
      customerName: order.manufacturingOrder.quotation.customer.name,
      teamLead: order.teamLead ? { id: order.teamLead.id, name: order.teamLead.name } : null,
      scheduledAt: order.scheduledAt ? order.scheduledAt.toISOString() : null,
      status: order.status,
    }));
  } catch (error) {
    console.error("[getInstallationOrders]", error);
    return [];
  }
}

const scheduleSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  teamLeadId: z.string().min(1, "errors.invalidInput"),
  scheduledAt: z.string().min(1, "errors.invalidInput"),
});

export async function scheduleInstallation(input: unknown) {
  try {
    const roleCheck = await requireRole(INSTALLATION_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const order = await prisma.installationOrder.findUnique({
      where: { id: parsed.data.id },
    });
    if (!order) return { error: "errors.notFound" as const };

    await prisma.installationOrder.update({
      where: { id: parsed.data.id },
      data: {
        teamLeadId: parsed.data.teamLeadId,
        scheduledAt: new Date(parsed.data.scheduledAt),
        status: "SCHEDULED",
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "SCHEDULE",
        entity: "InstallationOrder",
        entityId: order.id,
        details: `تم جدولة أمر التركيب بتاريخ ${parsed.data.scheduledAt}`,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[scheduleInstallation]", error);
    return { error: "errors.serverError" as const };
  }
}

const updateStatusSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(InstStatus),
});

export async function updateInstStatus(input: unknown) {
  try {
    const roleCheck = await requireRole(INSTALLATION_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const order = await prisma.installationOrder.findUnique({
      where: { id: parsed.data.id },
    });
    if (!order) return { error: "errors.notFound" as const };

    await prisma.installationOrder.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_STATUS",
        entity: "InstallationOrder",
        entityId: order.id,
        details: `تم تغيير حالة أمر التركيب من ${order.status} إلى ${parsed.data.status}`,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[updateInstStatus]", error);
    return { error: "errors.serverError" as const };
  }
}

export async function getInstallationTeamLeads() {
  try {
    const roleCheck = await requireRole(INSTALLATION_ROLES);
    if (!roleCheck.authorized) return [];

    const users = await prisma.user.findMany({
      where: { role: "INSTALLATIONS", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return users;
  } catch (error) {
    console.error("[getInstallationTeamLeads]", error);
    return [];
  }
}

export async function createInstallationOrder(manufacturingOrderId: string) {
  try {
    const existing = await prisma.installationOrder.findUnique({
      where: { manufacturingOrderId },
    });
    if (existing) return existing;

    return await prisma.installationOrder.create({
      data: { manufacturingOrderId },
    });
  } catch (error) {
    console.error("[createInstallationOrder]", error);
    throw error;
  }
}
