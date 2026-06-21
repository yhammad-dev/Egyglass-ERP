import { prisma } from "@/lib/prisma";
import type { Customer } from "@prisma/client";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
  stage: string;
  ownerName: string | null;
  ownerId: string | null;
}

export interface SalesRepOption {
  id: string;
  name: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  altPhone?: string;
  type: string;
  source: string;
  address?: string;
  notes?: string;
  isRepeat: boolean;
  ownerId?: string;
}

export async function getCustomers(
  userId: string,
  role: string
): Promise<CustomerRow[]> {
  const where: Record<string, any> = { deletedAt: null };

  if (role === "SALES_REP") {
    where.ownerId = userId;
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      type: true,
      source: true,
      stage: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    type: c.type,
    source: c.source,
    stage: c.stage,
    ownerId: c.ownerId,
    ownerName: c.owner?.name ?? null,
  }));
}

function toRow(customer: any): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    type: customer.type,
    source: customer.source,
    stage: customer.stage,
    ownerId: customer.ownerId,
    ownerName: customer.owner?.name ?? null,
  };
}

export async function createCustomer(
  input: CreateCustomerInput,
  actorId: string
): Promise<CustomerRow> {
  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      phone: input.phone,
      altPhone: input.altPhone || null,
      type: input.type as any,
      source: input.source as any,
      address: input.address || null,
      notes: input.notes || null,
      isRepeat: input.isRepeat,
      ownerId: input.ownerId || null,
    },
    include: { owner: { select: { name: true } } },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "CUSTOMER_CREATED",
      entity: "Customer",
      entityId: customer.id,
      details: JSON.stringify({
        name: customer.name,
        phone: customer.phone,
        type: customer.type,
        source: customer.source,
      }),
    },
  });

  return toRow(customer);
}

export async function updateCustomer(
  id: string,
  input: Partial<CreateCustomerInput>,
  actorId: string
): Promise<CustomerRow> {
  const data: Record<string, any> = {};
  const changed: string[] = [];

  if (input.name !== undefined) { data.name = input.name; changed.push("name"); }
  if (input.phone !== undefined) { data.phone = input.phone; changed.push("phone"); }
  if (input.altPhone !== undefined) { data.altPhone = input.altPhone || null; changed.push("altPhone"); }
  if (input.type !== undefined) { data.type = input.type; changed.push("type"); }
  if (input.source !== undefined) { data.source = input.source; changed.push("source"); }
  if (input.address !== undefined) { data.address = input.address || null; changed.push("address"); }
  if (input.notes !== undefined) { data.notes = input.notes || null; changed.push("notes"); }
  if (input.isRepeat !== undefined) { data.isRepeat = input.isRepeat; changed.push("isRepeat"); }
  if (input.ownerId !== undefined) { data.ownerId = input.ownerId || null; changed.push("ownerId"); }

  const customer = await prisma.customer.update({
    where: { id },
    data,
    include: { owner: { select: { name: true } } },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "CUSTOMER_UPDATED",
      entity: "Customer",
      entityId: customer.id,
      details: JSON.stringify({ changes: changed }),
    },
  });

  return toRow(customer);
}

export async function getSalesReps(): Promise<SalesRepOption[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["SALES_REP", "SALES_MANAGER"] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}
