"use server";

import { z } from "zod";
import { Department, LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const HR_ROLES = ["ADMIN", "HR"];

export async function getEmployees() {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return [];

  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
  });

  return employees.map((e) => ({
    id: e.id,
    nameAr: e.nameAr,
    department: e.department,
    position: e.position,
    hireDate: e.hireDate.toISOString(),
    salary: e.salary ? e.salary.toNumber() : null,
    isActive: e.isActive,
  }));
}

const employeeSchema = z.object({
  nameAr: z.string().min(1, "errors.required"),
  department: z.nativeEnum(Department),
  position: z.string().min(1, "errors.required"),
  hireDate: z.string().min(1, "errors.required"),
  salary: z.coerce.number().nonnegative("errors.invalidInput").optional(),
});

export async function createEmployee(input: unknown) {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const employee = await prisma.employee.create({
    data: {
      nameAr: parsed.data.nameAr,
      department: parsed.data.department,
      position: parsed.data.position,
      hireDate: new Date(parsed.data.hireDate),
      salary: parsed.data.salary,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      details: `تم إضافة الموظف ${employee.nameAr}`,
    },
  });

  return { success: true as const, data: { id: employee.id } };
}

const updateEmployeeSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  nameAr: z.string().min(1, "errors.required"),
  department: z.nativeEnum(Department),
  position: z.string().min(1, "errors.required"),
  hireDate: z.string().min(1, "errors.required"),
  salary: z.coerce.number().nonnegative("errors.invalidInput").optional(),
  isActive: z.boolean(),
});

export async function updateEmployee(input: unknown) {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = updateEmployeeSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const employee = await prisma.employee.findUnique({
    where: { id: parsed.data.id },
  });
  if (!employee) return { error: "errors.notFound" as const };

  await prisma.employee.update({
    where: { id: parsed.data.id },
    data: {
      nameAr: parsed.data.nameAr,
      department: parsed.data.department,
      position: parsed.data.position,
      hireDate: new Date(parsed.data.hireDate),
      salary: parsed.data.salary,
      isActive: parsed.data.isActive,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "UPDATE",
      entity: "Employee",
      entityId: employee.id,
      details: `تم تحديث بيانات الموظف ${parsed.data.nameAr}`,
    },
  });

  return { success: true as const };
}

export async function getLeaveRequests() {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return [];

  const requests = await prisma.leaveRequest.findMany({
    include: { employee: { select: { id: true, nameAr: true } } },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.nameAr,
    type: r.type,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    status: r.status,
    notes: r.notes,
  }));
}

const leaveRequestSchema = z.object({
  employeeId: z.string().min(1, "errors.invalidInput"),
  type: z.string().min(1, "errors.required"),
  startDate: z.string().min(1, "errors.required"),
  endDate: z.string().min(1, "errors.required"),
  notes: z.string().optional(),
});

export async function createLeaveRequest(input: unknown) {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = leaveRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const employee = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
  });
  if (!employee) return { error: "errors.notFound" as const };

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: parsed.data.employeeId,
      type: parsed.data.type,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      notes: parsed.data.notes,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "CREATE",
      entity: "LeaveRequest",
      entityId: leaveRequest.id,
      details: `تم تقديم طلب إجازة للموظف ${employee.nameAr}`,
    },
  });

  return { success: true as const, data: { id: leaveRequest.id } };
}

const updateLeaveStatusSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(LeaveStatus),
});

export async function updateLeaveStatus(input: unknown) {
  const roleCheck = await requireRole(HR_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = updateLeaveStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    include: { employee: { select: { nameAr: true } } },
  });
  if (!leaveRequest) return { error: "errors.notFound" as const };

  await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "UPDATE_STATUS",
      entity: "LeaveRequest",
      entityId: leaveRequest.id,
      details: `تم تغيير حالة طلب إجازة ${leaveRequest.employee.nameAr} إلى ${parsed.data.status}`,
    },
  });

  return { success: true as const };
}
