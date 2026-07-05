"use server";

import { z } from "zod";
import { MfgStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const MFG_ROLES = ["ADMIN", "PROCUREMENT"];

export async function getMfgOrders() {
  const roleCheck = await requireRole(MFG_ROLES);
  if (!roleCheck.authorized) return [];

  const orders = await prisma.manufacturingOrder.findMany({
    include: {
      quotation: {
        select: {
          id: true,
          number: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    quotationId: order.quotationId,
    number: order.quotation.number,
    customerName: order.quotation.customer.name,
    status: order.status,
    expectedAt: order.expectedAt ? order.expectedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
  }));
}

export async function createManufacturingOrder(quotationId: string) {
  const existing = await prisma.manufacturingOrder.findUnique({
    where: { quotationId },
  });
  if (existing) return existing;

  return prisma.manufacturingOrder.create({
    data: { quotationId },
  });
}

const updateStatusSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(MfgStatus),
});

export async function updateMfgStatus(input: unknown) {
  const roleCheck = await requireRole(MFG_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const order = await prisma.manufacturingOrder.findUnique({
    where: { id: parsed.data.id },
  });
  if (!order) return { error: "errors.notFound" as const };

  await prisma.manufacturingOrder.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "UPDATE_STATUS",
      entity: "ManufacturingOrder",
      entityId: order.id,
      details: `تم تغيير حالة أمر التصنيع من ${order.status} إلى ${parsed.data.status}`,
    },
  });

  return { success: true as const };
}
