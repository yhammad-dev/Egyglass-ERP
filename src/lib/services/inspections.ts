import { prisma } from "@/lib/prisma";

export interface InspectionRow {
  id: string;
  customerId: string;
  customerName: string;
  location: string;
  address: string;
  phone: string;
  notes: string | null;
  status: string;
  type: string;
  scheduledAt: Date | null;
  dueDate: Date;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  /** Fractional days until dueDate — negative means past due */
  daysRemaining: number;
  /** 'OVERDUE' when dueDate < now and status !== DONE; otherwise the DB status */
  effectiveStatus: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export interface UserOption {
  id: string;
  name: string;
}

const INSIDE_CAIRO_DAYS = 2;
const OUTSIDE_CAIRO_DAYS = 4;

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    // Friday is 5 in JS getDay()
    if (result.getDay() !== 5) {
      added++;
    }
  }
  return result;
}

function computeDueDate(location: string): Date {
  const now = new Date();
  const days = location === "OUTSIDE_CAIRO" ? OUTSIDE_CAIRO_DAYS : INSIDE_CAIRO_DAYS;
  return addBusinessDays(now, days);
}

export async function getInspections(
  userId: string,
  role: string
): Promise<InspectionRow[]> {
  const where: Record<string, any> = { deletedAt: null };

  const inspections = await prisma.inspectionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  const now = new Date();
  return inspections.map((ins) => {
    const daysRemaining = (ins.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const effectiveStatus = ins.dueDate < now && ins.status !== "DONE" ? "OVERDUE" : ins.status;
    return {
      id: ins.id,
      customerId: ins.customerId,
      customerName: ins.customer.name,
      location: ins.location,
      address: ins.address,
      phone: ins.phone,
      notes: ins.notes,
      status: ins.status,
      type: ins.type,
      scheduledAt: ins.scheduledAt,
      dueDate: ins.dueDate,
      assigneeId: ins.assigneeId,
      assigneeName: ins.assignee?.name ?? null,
      createdAt: ins.createdAt,
      daysRemaining,
      effectiveStatus,
    };
  });
}

export async function getCustomers(): Promise<CustomerOption[]> {
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  return customers;
}

export async function getAssignableUsers(): Promise<UserOption[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export interface CreateInspectionInput {
  customerId: string;
  location: string;
  address: string;
  phone: string;
  type: string;
  notes?: string;
}

export async function createInspection(
  input: CreateInspectionInput,
  actorId: string
): Promise<InspectionRow> {
  const dueDate = computeDueDate(input.location);

  const inspection = await prisma.inspectionRequest.create({
    data: {
      customerId: input.customerId,
      location: input.location as any,
      address: input.address,
      phone: input.phone,
      type: input.type as any,
      notes: input.notes || null,
      dueDate,
    },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INSPECTION_CREATED",
      entity: "InspectionRequest",
      entityId: inspection.id,
      details: JSON.stringify({
        customerId: inspection.customerId,
        location: inspection.location,
        type: inspection.type,
      }),
    },
  });

  const now = new Date();
  const daysRemaining = (inspection.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const effectiveStatus =
    inspection.dueDate < now && inspection.status !== "DONE" ? "OVERDUE" : inspection.status;

  return {
    id: inspection.id,
    customerId: inspection.customerId,
    customerName: inspection.customer.name,
    location: inspection.location,
    address: inspection.address,
    phone: inspection.phone,
    notes: inspection.notes,
    status: inspection.status,
    type: inspection.type,
    scheduledAt: inspection.scheduledAt,
    dueDate: inspection.dueDate,
    assigneeId: inspection.assigneeId,
    assigneeName: inspection.assignee?.name ?? null,
    createdAt: inspection.createdAt,
    daysRemaining,
    effectiveStatus,
  };
}

export async function scheduleInspection(
  id: string,
  scheduledAt: Date,
  assigneeId: string,
  actorId: string
): Promise<InspectionRow> {
  const inspection = await prisma.inspectionRequest.update({
    where: { id },
    data: {
      status: "SCHEDULED" as any,
      scheduledAt,
      assigneeId,
    },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "INSPECTION_SCHEDULED",
      entity: "InspectionRequest",
      entityId: id,
      details: JSON.stringify({
        scheduledAt: scheduledAt.toISOString(),
        assigneeId,
      }),
    },
  });

  const now = new Date();
  const daysRemaining = (inspection.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const effectiveStatus =
    inspection.dueDate < now && inspection.status !== "DONE" ? "OVERDUE" : inspection.status;

  return {
    id: inspection.id,
    customerId: inspection.customerId,
    customerName: inspection.customer.name,
    location: inspection.location,
    address: inspection.address,
    phone: inspection.phone,
    notes: inspection.notes,
    status: inspection.status,
    type: inspection.type,
    scheduledAt: inspection.scheduledAt,
    dueDate: inspection.dueDate,
    assigneeId: inspection.assigneeId,
    assigneeName: inspection.assignee?.name ?? null,
    createdAt: inspection.createdAt,
    daysRemaining,
    effectiveStatus,
  };
}
