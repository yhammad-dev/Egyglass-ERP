"use server";

import { z } from "zod";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const PROJECT_ROLES = ["ADMIN", "PROJECTS"];

export async function getProjects() {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return [];

  const projects = await prisma.project.findMany({
    include: {
      customer: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      _count: { select: { quotations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((p) => ({
    id: p.id,
    nameAr: p.nameAr,
    customerId: p.customerId,
    customerName: p.customer.name,
    manager: p.manager ? { id: p.manager.id, name: p.manager.name } : null,
    status: p.status,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    endDate: p.endDate ? p.endDate.toISOString() : null,
    notes: p.notes,
    quotationsCount: p._count.quotations,
  }));
}

const projectSchema = z.object({
  nameAr: z.string().min(1, "errors.required"),
  customerId: z.string().min(1, "errors.invalidInput"),
  managerId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function createProject(input: unknown) {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
  });
  if (!customer) return { error: "errors.notFound" as const };

  const project = await prisma.project.create({
    data: {
      nameAr: parsed.data.nameAr,
      customerId: parsed.data.customerId,
      managerId: parsed.data.managerId || undefined,
      status: parsed.data.status,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      notes: parsed.data.notes,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "CREATE",
      entity: "Project",
      entityId: project.id,
      details: `تم إنشاء مشروع ${project.nameAr} للعميل ${customer.name}`,
    },
  });

  return { success: true as const, data: { id: project.id } };
}

const updateProjectSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  nameAr: z.string().min(1, "errors.required"),
  customerId: z.string().min(1, "errors.invalidInput"),
  managerId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateProject(input: unknown) {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.id },
  });
  if (!project) return { error: "errors.notFound" as const };

  await prisma.project.update({
    where: { id: parsed.data.id },
    data: {
      nameAr: parsed.data.nameAr,
      customerId: parsed.data.customerId,
      managerId: parsed.data.managerId || null,
      status: parsed.data.status,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      notes: parsed.data.notes,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "UPDATE",
      entity: "Project",
      entityId: project.id,
      details: `تم تحديث بيانات مشروع ${parsed.data.nameAr}`,
    },
  });

  return { success: true as const };
}

const linkQuotationSchema = z.object({
  projectId: z.string().min(1, "errors.invalidInput"),
  quotationId: z.string().min(1, "errors.invalidInput"),
});

export async function linkQuotationToProject(input: unknown) {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

  const parsed = linkQuotationSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" as const };

  const [project, quotation] = await Promise.all([
    prisma.project.findUnique({ where: { id: parsed.data.projectId } }),
    prisma.quotation.findUnique({ where: { id: parsed.data.quotationId } }),
  ]);
  if (!project || !quotation) return { error: "errors.notFound" as const };

  await prisma.quotation.update({
    where: { id: parsed.data.quotationId },
    data: { projectId: parsed.data.projectId },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "LINK_QUOTATION",
      entity: "Project",
      entityId: project.id,
      details: `تم ربط عرض السعر ${quotation.number} بمشروع ${project.nameAr}`,
    },
  });

  return { success: true as const };
}

export async function getUnlinkedQuotations(customerId?: string) {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return [];

  const quotations = await prisma.quotation.findMany({
    where: {
      projectId: null,
      ...(customerId ? { customerId } : {}),
    },
    select: { id: true, number: true, customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return quotations.map((q) => ({
    id: q.id,
    number: q.number,
    customerName: q.customer.name,
  }));
}

export async function getAssignableManagers() {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return [];

  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getCustomersForProjects() {
  const roleCheck = await requireRole(PROJECT_ROLES);
  if (!roleCheck.authorized) return [];

  return prisma.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
