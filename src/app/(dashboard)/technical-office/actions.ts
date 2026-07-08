"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTecJobs } from "@/lib/services/tec";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import type { TecFilters } from "@/lib/services/tec";
import type { TecJobStatus, DrawingCategory, DrawingFileType } from "@prisma/client";

const TEC_ROLES = ["ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER"] as const;
const APPROVER_ROLES = ["ADMIN", "TEC_APPROVER"] as const;

export async function getTecJobsAction(filters?: TecFilters) {
  try {
    const auth = await requireRole([...TEC_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };
    return await getTecJobs(auth.userId, auth.role, filters);
  } catch {
    return { error: "errors.serverError" as const };
  }
}

const updateStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "ON_HOLD", "DONE"]),
});

export async function updateTecJobStatusAction(input: unknown) {
  try {
    const auth = await requireRole([...TEC_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, status } = parsed.data;

    const job = await prisma.quotationRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true } },
        quotation: { select: { number: true } },
      },
    });
    if (!job) return { error: "errors.notFound" as const };

    await prisma.quotationRequest.update({
      where: { id },
      data: { status: status as TecJobStatus },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "TEC_STATUS_UPDATED",
        entity: "QuotationRequest",
        entityId: id,
        details: JSON.stringify({ from: job.status, to: status }),
      },
    });

    if (status === "DONE") {
      await notifyRole("SALES_MANAGER", {
        title: "tec.jobDoneTitle",
        body: `${job.customer.name} — ${job.quotation.number}`,
        type: "TEC_JOB_DONE",
        entityId: id,
        entityType: "QuotationRequest",
      });
    }

    revalidatePath("/technical-office");
    return { success: true as const };
  } catch {
    return { error: "errors.serverError" as const };
  }
}

const assignEngineerSchema = z.object({
  id: z.string().min(1),
  engineerId: z.string().min(1),
});

export async function assignEngineerAction(input: unknown) {
  try {
    const auth = await requireRole([...APPROVER_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = assignEngineerSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, engineerId } = parsed.data;

    const job = await prisma.quotationRequest.findUnique({
      where: { id },
      include: { quotation: { select: { number: true } } },
    });
    if (!job) return { error: "errors.notFound" as const };

    await prisma.quotationRequest.update({
      where: { id },
      data: { engineerId, status: "IN_PROGRESS" },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "TEC_ENGINEER_ASSIGNED",
        entity: "QuotationRequest",
        entityId: id,
        details: JSON.stringify({ engineerId }),
      },
    });

    await sendNotification({
      userId: engineerId,
      title: "tec.assignedTitle",
      body: job.quotation.number,
      type: "TEC_ASSIGNED",
      entityId: id,
      entityType: "QuotationRequest",
    });

    revalidatePath("/technical-office");
    return { success: true as const };
  } catch {
    return { error: "errors.serverError" as const };
  }
}

const uploadDrawingSchema = z.object({
  quotationRequestId: z.string().min(1),
  category: z.enum([
    "DRAWINGS",
    "STRUCTURAL_CALC",
    "DATA_SHEET",
    "EXECUTION_DRAWINGS",
    "APPROVALS",
  ]),
  fileType: z.enum(["PDF", "DWG", "JPG"]),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  base64: z.string().min(1),
  label: z.string().optional(),
  notes: z.string().optional(),
  revision: z.string().optional(),
});

export async function uploadDrawingAction(input: unknown) {
  try {
    const auth = await requireRole(["ADMIN", "TECHNICAL_OFFICE"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = uploadDrawingSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const {
      quotationRequestId,
      category,
      fileType,
      originalName,
      mimeType,
      sizeBytes,
      base64,
      label,
      notes,
      revision,
    } = parsed.data;

    const job = await prisma.quotationRequest.findUnique({
      where: { id: quotationRequestId },
      select: { id: true },
    });
    if (!job) return { error: "errors.notFound" as const };

    const ext = fileType === "PDF" ? "pdf" : fileType === "DWG" ? "dwg" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "drawings");
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(base64, "base64");
    await writeFile(join(uploadDir, filename), buffer);
    const url = `/uploads/drawings/${filename}`;

    const drawing = await prisma.drawing.create({
      data: {
        quotationRequestId,
        category: category as DrawingCategory,
        fileType: fileType as DrawingFileType,
        filename,
        originalName,
        mimeType,
        sizeBytes,
        url,
        label: label ?? null,
        notes: notes ?? null,
        revision: revision ?? null,
        uploadedById: auth.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "DRAWING_UPLOADED",
        entity: "Drawing",
        entityId: drawing.id,
        details: JSON.stringify({ quotationRequestId, originalName, category }),
      },
    });

    revalidatePath(`/technical-office/${quotationRequestId}`);
    return { success: true as const, drawingId: drawing.id };
  } catch {
    return { error: "errors.serverError" as const };
  }
}

const approveDrawingSchema = z.object({
  drawingId: z.string().min(1),
});

export async function approveDrawingAction(input: unknown) {
  try {
    const auth = await requireRole(["ADMIN", "TEC_APPROVER"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = approveDrawingSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { drawingId } = parsed.data;

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
      select: { id: true, uploadedById: true, quotationRequestId: true },
    });
    if (!drawing) return { error: "errors.notFound" as const };

    if (drawing.uploadedById === auth.userId && auth.role !== "ADMIN") {
      return { error: "errors.cannotApproveSelf" as const };
    }

    await prisma.drawing.update({
      where: { id: drawingId },
      data: { approvedById: auth.userId, approvedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "DRAWING_APPROVED",
        entity: "Drawing",
        entityId: drawingId,
        details: JSON.stringify({ drawingId }),
      },
    });

    await notifyRole("TECHNICAL_OFFICE", {
      title: "tec.drawingApprovedTitle",
      body: drawing.quotationRequestId,
      type: "DRAWING_APPROVED",
      entityId: drawingId,
      entityType: "Drawing",
    });

    revalidatePath(`/technical-office/${drawing.quotationRequestId}`);
    return { success: true as const };
  } catch {
    return { error: "errors.serverError" as const };
  }
}

const updateNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string(),
});

export async function updateJobNotesAction(input: unknown) {
  try {
    const auth = await requireRole([...TEC_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateNotesSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, notes } = parsed.data;

    await prisma.quotationRequest.update({
      where: { id },
      data: { notes },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "TEC_NOTES_UPDATED",
        entity: "QuotationRequest",
        entityId: id,
        details: JSON.stringify({ notesLength: notes.length }),
      },
    });

    revalidatePath(`/technical-office/${id}`);
    return { success: true as const };
  } catch {
    return { error: "errors.serverError" as const };
  }
}
