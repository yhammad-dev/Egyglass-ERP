"use server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PostInstallStatus } from "@prisma/client";

const createSchema = z.object({
  customerId: z.string().min(1),
  contractId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  issues: z.string().optional(),
});

export async function createPostInstallReview(
  input: z.infer<typeof createSchema>
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole([
      "ADMIN",
      "SALES_MANAGER",
      "SALES_REP",
      "INSTALLATIONS",
    ]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { customerId, contractId, rating, notes, issues } = parsed.data;

    await prisma.$transaction([
      prisma.postInstallReview.create({
        data: {
          customerId,
          contractId: contractId ?? null,
          rating,
          notes: notes ?? null,
          issues: issues ?? null,
          createdById: roleCheck.userId,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "POST_INSTALL_REVIEW_CREATED",
          entity: "PostInstallReview",
          entityId: customerId,
          details: JSON.stringify({ customerId, rating }),
        },
      }),
    ]);

    revalidatePath(`/customers/${customerId}`);
    return { success: true };
  } catch {
    return { error: "errors.serverError" };
  }
}

const updateStatusSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["PENDING", "CONTACTED", "RESOLVED", "CLOSED"]),
});

export async function updatePostInstallStatus(
  input: z.infer<typeof updateStatusSchema>
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { reviewId, status } = parsed.data;

    const review = await prisma.postInstallReview.findUnique({
      where: { id: reviewId },
      select: { id: true, customerId: true },
    });
    if (!review) return { error: "errors.notFound" };

    await prisma.$transaction([
      prisma.postInstallReview.update({
        where: { id: reviewId },
        data: { status: status as PostInstallStatus },
      }),
      prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "POST_INSTALL_STATUS_UPDATED",
          entity: "PostInstallReview",
          entityId: reviewId,
          details: JSON.stringify({ status }),
        },
      }),
    ]);

    revalidatePath(`/customers/${review.customerId}`);
    return { success: true };
  } catch {
    return { error: "errors.serverError" };
  }
}

export interface PostInstallReviewRow {
  id: string;
  customerId: string;
  contractId: string | null;
  rating: number;
  notes: string | null;
  issues: string | null;
  status: PostInstallStatus;
  createdById: string;
  createdByName: string;
  createdAt: Date;
}

export async function getPostInstallReviews(
  customerId: string
): Promise<PostInstallReviewRow[] | { error: string }> {
  try {
    const roleCheck = await requireRole([
      "ADMIN",
      "SALES_MANAGER",
      "SALES_REP",
      "INSTALLATIONS",
    ]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const reviews = await prisma.postInstallReview.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    });

    return reviews.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      contractId: r.contractId,
      rating: r.rating,
      notes: r.notes,
      issues: r.issues,
      status: r.status,
      createdById: r.createdById,
      createdByName: r.createdBy.name,
      createdAt: r.createdAt,
    }));
  } catch {
    return { error: "errors.serverError" };
  }
}
