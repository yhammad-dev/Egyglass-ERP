import { prisma } from "@/lib/prisma";
import type { TecJobStatus, TechnicalRoute } from "@prisma/client";

export interface DrawingRow {
  id: string;
  category: string;
  fileType: string;
  filename: string;
  originalName: string;
  url: string;
  sizeBytes: number;
  label: string | null;
  notes: string | null;
  revision: string | null;
  uploadedByName: string;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  status: string;
}

export interface TecJobRow {
  id: string;
  code: string;
  status: TecJobStatus;
  technicalRoute: TechnicalRoute;
  summary: string | null;
  customerName: string;
  customerId: string;
  quotationId: string;
  quotationNumber: string;
  engineerName: string | null;
  engineerId: string | null;
  salesOwnerName: string | null;
  inspectionOwnerName: string | null;
  drawingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TecJobDetail extends TecJobRow {
  notes: string | null;
  inspectionRequestId: string | null;
  drawings: DrawingRow[];
}

export interface TecFilters {
  route?: TechnicalRoute;
  status?: TecJobStatus;
  search?: string;
}

export interface EngineerOption {
  id: string;
  name: string;
}

function buildWhere(userId: string, role: string, filters?: TecFilters) {
  const where: Record<string, any> = { deletedAt: null };

  if (role === "TECHNICAL_OFFICE") {
    where.engineerId = userId;
  }

  if (filters?.route) where.technicalRoute = filters.route;
  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function getTecJobs(
  userId: string,
  role: string,
  filters?: TecFilters
): Promise<TecJobRow[]> {
  const where = buildWhere(userId, role, filters);

  const jobs = await prisma.quotationRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      quotation: { select: { id: true, number: true } },
      engineer: { select: { id: true, name: true } },
      salesOwner: { select: { name: true } },
      inspectionOwner: { select: { name: true } },
      _count: { select: { drawings: true } },
    },
  });

  return jobs.map((j) => ({
    id: j.id,
    code: j.code,
    status: j.status,
    technicalRoute: j.technicalRoute,
    summary: j.summary,
    customerName: j.customer.name,
    customerId: j.customer.id,
    quotationId: j.quotation.id,
    quotationNumber: j.quotation.number,
    engineerName: j.engineer?.name ?? null,
    engineerId: j.engineer?.id ?? null,
    salesOwnerName: j.salesOwner?.name ?? null,
    inspectionOwnerName: j.inspectionOwner?.name ?? null,
    drawingsCount: j._count.drawings,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  }));
}

export async function getTecJobDetail(
  id: string,
  userId: string,
  role: string
): Promise<TecJobDetail | null> {
  const where = buildWhere(userId, role);
  where.id = id;

  const job = await prisma.quotationRequest.findFirst({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      quotation: { select: { id: true, number: true } },
      engineer: { select: { id: true, name: true } },
      salesOwner: { select: { name: true } },
      inspectionOwner: { select: { name: true } },
      _count: { select: { drawings: true } },
      drawings: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    code: job.code,
    status: job.status,
    technicalRoute: job.technicalRoute,
    summary: job.summary,
    notes: job.notes,
    customerName: job.customer.name,
    customerId: job.customer.id,
    quotationId: job.quotation.id,
    quotationNumber: job.quotation.number,
    engineerName: job.engineer?.name ?? null,
    engineerId: job.engineer?.id ?? null,
    salesOwnerName: job.salesOwner?.name ?? null,
    inspectionOwnerName: job.inspectionOwner?.name ?? null,
    inspectionRequestId: job.inspectionRequestId,
    drawingsCount: job._count.drawings,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    drawings: job.drawings.map((d) => ({
      id: d.id,
      category: d.category,
      fileType: d.fileType,
      filename: d.filename,
      originalName: d.originalName,
      url: d.url,
      sizeBytes: d.sizeBytes,
      label: d.label,
      notes: d.notes,
      revision: d.revision,
      uploadedByName: d.uploadedBy.name,
      approvedByName: d.approvedBy?.name ?? null,
      approvedAt: d.approvedAt,
      createdAt: d.createdAt,
      status: d.status,
    })),
  };
}

export async function getEngineers(): Promise<EngineerOption[]> {
  return prisma.user.findMany({
    where: { role: "TECHNICAL_OFFICE", isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
