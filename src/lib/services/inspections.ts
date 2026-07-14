import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import {
  recomputeQuotationRequestStatus,
  recomputeCustomerStage,
} from "@/lib/services/status-derivation";

// D-31 (BL-91): خطأ مُوجَّه حين لا يكون الطلب المختار مؤهَّلًا للربط
export class InspectionError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "InspectionError";
  }
}

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
  // BL-94 (نطاق جزئي): INSPECTION_REP يرى المعاينات المسندة إليه فقط — نفس
  // تضييق الملكية المفروض في getInspectionDetail. لا توسيع لأي دور آخر:
  // ADMIN/INSPECTION_MANAGER يريان الكل كما كانا (المدير يوزّع فيلزمه الكل).
  const where: Prisma.InspectionRequestWhereInput = { deletedAt: null };
  if (role === "INSPECTION_REP") {
    where.assigneeId = userId;
  }

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
  /** D-31 (BL-91): الطلب الذي يختاره المندوب صراحةً — إلزامي، لا تخمين */
  quotationRequestId: string;
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
  // D-31 (BL-91): الطلب يُختار صراحةً — تحقّق server-side قبل أي إنشاء:
  // نفس العميل · غير مربوط بمعاينة · غير DONE · غير محذوف. وإلا رفض بلا إنشاء.
  const request = await prisma.quotationRequest.findUnique({
    where: { id: input.quotationRequestId },
    select: { id: true, customerId: true, inspectionRequestId: true, status: true, deletedAt: true },
  });
  if (
    !request ||
    request.deletedAt !== null ||
    request.customerId !== input.customerId ||
    request.inspectionRequestId !== null ||
    request.status === "DONE"
  ) {
    throw new InspectionError("errors.requestNotSelectable");
  }

  const dueDate = computeDueDate(input.location);

  // D-31 (BL-91): الإنشاء + السجل + الربط في transaction واحدة — لا معاينة يتيمة
  // حتى لو سبق ربطٌ آخر (updateMany الشرطي يُرجِع 0 → rollback كامل للمعاينة).
  const inspection = await prisma.$transaction(async (tx) => {
    const created = await tx.inspectionRequest.create({
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
        customer: { select: { name: true, ownerId: true } },
        assignee: { select: { name: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "INSPECTION_CREATED",
        entity: "InspectionRequest",
        entityId: created.id,
        details: JSON.stringify({
          customerId: created.customerId,
          location: created.location,
          type: created.type,
        }),
      },
    });

    // الربط الشرطي (سباق): لو سبقنا ربطٌ آخر → count=0 → throw → rollback المعاينة
    const linked = await tx.quotationRequest.updateMany({
      where: {
        id: request.id,
        inspectionRequestId: null,
        status: { not: "DONE" },
        deletedAt: null,
      },
      data: { inspectionRequestId: created.id },
    });
    if (linked.count === 0) throw new InspectionError("errors.requestNotSelectable");

    return created;
  });

  try {
    await notifyRole("INSPECTION_MANAGER", {
      title: "notifications.newInspectionTitle",
      body: `تم إنشاء طلب معاينة جديد للعميل ${inspection.customer.name}`,
      type: "INSPECTION_CREATED",
      entityId: inspection.id,
      entityType: "InspectionRequest",
    });
  } catch {
    // notification failure must not block the operation
  }

  // D-32 (BL-93): التغطية مسموحة (نموذج R-02) بلا حارس ملكية — لكن الحوكمة إلزامية:
  // يُخطَر مالك العميل (الضابط = الأثر + الرؤية، D-11/D-24). الفاعل الحقيقي مُسجَّل
  // بالفعل في ActivityLog أعلاه (INSPECTION_CREATED, userId=actorId).
  // 🔴 الشرط = **أي فاعل غير المالك** (ADMIN/مدير معاينات/مندوب مغطٍّ) — مُقرّ صراحةً
  // من يوسف: لا تُضيَّق لـSALES_REP. المالك يستحق أن يعرف أن أحدًا لمس عميله، أيًا كان.
  if (inspection.customer.ownerId && inspection.customer.ownerId !== actorId) {
    try {
      await sendNotification({
        userId: inspection.customer.ownerId,
        title: "notifications.inspectionByColleagueTitle",
        body: `زميل طلب معاينة لعميلك ${inspection.customer.name}`,
        type: "INSPECTION_BY_COLLEAGUE",
        entityId: inspection.id,
        entityType: "InspectionRequest",
      });
    } catch {
      // notification failure must not block the operation
    }
  }

  await recomputeQuotationRequestStatus(request.id, actorId);
  await recomputeCustomerStage(inspection.customerId, actorId);

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

  try {
    await sendNotification({
      userId: assigneeId,
      title: "notifications.inspectionScheduledTitle",
      body: `تم جدولة معاينة للعميل ${inspection.customer.name}`,
      type: "INSPECTION_SCHEDULED",
      entityId: id,
      entityType: "InspectionRequest",
    });
  } catch {
    // notification failure must not block the operation
  }

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
