import { prisma } from "@/lib/prisma";
import type { Customer } from "@prisma/client";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  altPhone: string | null;
  type: string;
  source: string;
  stage: string;
  address: string | null;
  notes: string | null;
  isRepeat: boolean;
  isVip: boolean;
  ownerName: string | null;
  ownerId: string | null;
  coveredById: string | null;
  coveredByName: string | null;
  isCoverage: boolean;
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
    where.OR = [
      { ownerId: userId },
      { coveredById: userId },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      altPhone: true,
      type: true,
      source: true,
      stage: true,
      address: true,
      notes: true,
      isRepeat: true,
      isVip: true,
      ownerId: true,
      coveredById: true,
      owner: { select: { name: true } },
    },
  });

  const coveringIds = customers
    .map((c) => c.coveredById)
    .filter((id): id is string => id != null);
  const coveringUsers =
    coveringIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: coveringIds } },
          select: { id: true, name: true },
        })
      : [];
  const coveringMap = new Map(coveringUsers.map((u) => [u.id, u.name]));

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    altPhone: c.altPhone ?? null,
    type: c.type,
    source: c.source,
    stage: c.stage,
    address: c.address ?? null,
    notes: c.notes ?? null,
    isRepeat: c.isRepeat,
    isVip: c.isVip,
    ownerId: c.ownerId,
    coveredById: c.coveredById,
    ownerName: c.owner?.name ?? null,
    isCoverage: c.coveredById != null,
    coveredByName: c.coveredById
      ? coveringMap.get(c.coveredById) ?? null
      : null,
  }));
}

function toRow(customer: any): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    altPhone: customer.altPhone ?? null,
    type: customer.type,
    source: customer.source,
    stage: customer.stage,
    address: customer.address ?? null,
    notes: customer.notes ?? null,
    isRepeat: customer.isRepeat,
    isVip: customer.isVip ?? false,
    ownerId: customer.ownerId,
    coveredById: customer.coveredById ?? null,
    coveredByName: customer.coveredByName ?? null,
    ownerName: customer.owner?.name ?? null,
    isCoverage: customer.coveredById != null,
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

export interface CustomerProfileData {
  id: string;
  name: string;
  phone: string;
  altPhone: string | null;
  type: string;
  source: string;
  address: string | null;
  notes: string | null;
  stage: string;
  rejectReason: string | null;
  isRepeat: boolean;
  isVip: boolean;
  ownerName: string | null;
  ownerId: string | null;
  coveredById: string | null;
  coveredByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  interactions: Array<{
    id: string;
    type: string;
    note: string;
    userName: string | null;
    createdAt: Date;
  }>;
  quotations: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    createdAt: Date;
  }>;
  inspections: Array<{
    id: string;
    status: string;
    type: string;
    location: string;
    address: string | null;
    scheduledAt: Date | null;
    dueDate: Date;
    createdAt: Date;
  }>;
}

export async function getCustomerById(
  id: string,
  actorId: string,
  role: string
): Promise<CustomerProfileData | null> {
  const where: Record<string, any> = { id, deletedAt: null };

  if (role === "SALES_REP") {
    where.OR = [
      { ownerId: actorId },
      { coveredById: actorId },
    ];
  }

  const customer = await prisma.customer.findFirst({
    where,
    include: {
      owner: { select: { name: true } },
      interactions: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      quotations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
      inspections: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          type: true,
          location: true,
          address: true,
          scheduledAt: true,
          dueDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) return null;

  let coveredByName: string | null = null;
  if (customer.coveredById) {
    const coveringUser = await prisma.user.findUnique({
      where: { id: customer.coveredById },
      select: { name: true },
    });
    coveredByName = coveringUser?.name ?? null;
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    altPhone: customer.altPhone,
    type: customer.type,
    source: customer.source,
    address: customer.address,
    notes: customer.notes,
    stage: customer.stage,
    rejectReason: customer.rejectReason,
    isRepeat: customer.isRepeat,
    isVip: customer.isVip,
    ownerName: customer.owner?.name ?? null,
    ownerId: customer.ownerId,
    coveredById: customer.coveredById,
    coveredByName,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    interactions: customer.interactions.map((i) => ({
      id: i.id,
      type: i.type,
      note: i.note,
      userName: i.user?.name ?? null,
      createdAt: i.createdAt,
    })),
    quotations: customer.quotations.map((q) => ({
      id: q.id,
      number: q.number,
      status: q.status,
      total: Number(q.total),
      createdAt: q.createdAt,
    })),
    inspections: customer.inspections.map((ins) => ({
      id: ins.id,
      status: ins.status,
      type: ins.type,
      location: ins.location,
      address: ins.address,
      scheduledAt: ins.scheduledAt,
      dueDate: ins.dueDate,
      createdAt: ins.createdAt,
    })),
  };
}

export async function setCustomerVip(
  customerId: string,
  isVip: boolean,
  actorId: string
): Promise<void> {
  await prisma.customer.update({
    where: { id: customerId },
    data: { isVip },
  });
  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "CUSTOMER_VIP_UPDATED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({ isVip }),
    },
  });
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
