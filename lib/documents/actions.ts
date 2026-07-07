"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const ALL_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP", "INSPECTION_MANAGER", "REVIEW", "VIEWER"];
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "documents");

export async function uploadDocument(
  entityType: string,
  entityId: string,
  formData: FormData
) {
  try {
    const roleCheck = await requireRole(ALL_ROLES);
    if (!roleCheck.authorized) return { error: "غير مخول" };
    const userId = roleCheck.userId;

    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "لم يتم اختيار ملف" };
    if (file.size > 10 * 1024 * 1024) return { error: "حجم الملف يتجاوز 10 ميغابايت" };

    const label = (formData.get("label") as string) || "";

    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = file.name.split(".").pop() ?? "bin";
    const stored = `${randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(join(UPLOAD_DIR, stored), Buffer.from(bytes));

    const url = `/uploads/documents/${stored}`;

    const doc = await prisma.document.create({
      data: {
        entityType,
        entityId,
        filename: stored,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        url,
        label: label || null,
        uploadedById: userId,
      },
    });

    return { success: true, doc };
  } catch (e) {
    console.error(e);
    return { error: "فشل رفع الملف" };
  }
}

export async function getDocuments(entityType: string, entityId: string) {
  try {
    const roleCheck = await requireRole(ALL_ROLES);
    if (!roleCheck.authorized) return [];

    return await prisma.document.findMany({
      where: { entityType, entityId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function deleteDocument(id: string) {
  try {
    const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
    if (!roleCheck.authorized) return { error: "غير مخول" };

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { error: "المستند غير موجود" };

    await prisma.document.delete({ where: { id } });
    return { success: true };
  } catch {
    return { error: "فشل الحذف" };
  }
}
