"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { uploadDirFor, uploadUrl } from "@/lib/storage/paths";
import { getTecJobs, canAssignEngineer } from "@/lib/services/tec";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import type { TecFilters } from "@/lib/services/tec";
import type { TecJobStatus, DrawingCategory, DrawingFileType } from "@prisma/client";

const TEC_ROLES = ["ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER"] as const;
const APPROVER_ROLES = ["ADMIN", "TEC_APPROVER"] as const;
// TO-25: مَن يوزّع الطلبات على المهندسين. التيم ليدر مضاف، **مقيَّدًا بفريقه**
// عبر `canAssignEngineer` داخل الأكشن — القائمة في الواجهة عرض لا حارس.
// ⚠️ منفصلة عن APPROVER_ROLES عمدًا: تلك للاعتماد الفني (G1) ولا يدخلها التيم ليدر.
const ASSIGN_ROLES = ["ADMIN", "TEC_APPROVER", "TEC_LEAD"] as const;

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
    // TO-25: التيم ليدر يوزّع أيضًا (كان APPROVER_ROLES وحدها).
    const auth = await requireRole([...ASSIGN_ROLES]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = assignEngineerSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { id, engineerId } = parsed.data;

    // 🔴 TO-25 — الحارس النافذ: الدور وحده لا يكفي. التيم ليدر لا يسند إلا لمهندس
    // **فريقه**، ولا أحد يسند لغير مهندس نشط. الواجهة تعرض قائمة مقصورة، لكن
    // الطلب قابل للتزوير بلا مرور بها ⇒ الفحص هنا هو ما يمنع فعلًا.
    if (!(await canAssignEngineer(auth.userId, auth.role, engineerId))) {
      return { error: "errors.notAuthorized" as const };
    }

    const job = await prisma.quotationRequest.findUnique({
      where: { id },
      // دفعة هـ: العرض nullable — الطلب المُسنَد لا عرض له بعد (W-01). لا تفترض وجوده.
      include: { quotation: { select: { number: true } } },
    });
    if (!job) return { error: "errors.notFound" as const };

    // الإسناد يسجّل المهندس فقط — الحالة تبقى مشتقّة (Phase 4)، لا تُكتب يدويًا.
    await prisma.quotationRequest.update({
      where: { id },
      data: { engineerId },
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
      // العرض قد لا يوجد بعد — استخدم كود الطلب كمرجع بديل آمن
      body: job.quotation?.number ?? job.code,
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
  // TO-02: يُقبل للتوافق مع الكلاينت لكنه **لا يُستخدم إطلاقًا** — الحجم المكتوب في
  // القاعدة يُحسب من الـBuffer الفعلي. رقم قادم من العميل ليس دليلًا على شيء.
  sizeBytes: z.number().int().positive(),
  base64: z.string().min(1),
  label: z.string().optional(),
  notes: z.string().optional(),
  revision: z.string().optional(),
});

/** TO-02: سقف حجم الرسمة الفعلي — يُفرض على الـBuffer لا على رقم العميل. */
const MAX_DRAWING_BYTES = 10 * 1024 * 1024;

/**
 * TO-02 — تحقق من توقيع الملف الفعلي (magic bytes) مقروءًا من الـBuffer.
 * الشرط: التوقيع يطابق `fileType` المُرسَل تحديدًا — لا يكفي أن يكون توقيعًا صالحًا
 * لنوع آخر (ملف محتواه PDF مُرسَل كـJPG يُرفض).
 * DWG: best-effort — كل إصدارات AutoCAD الحديثة (R13+: AC1012/AC1015/AC1018/AC1021/
 * AC1024/AC1027/AC1032) تشترك في البادئة "AC10"؛ إصدارات ما قبل R13 لا تُقبل.
 */
function matchesFileSignature(buffer: Buffer, fileType: DrawingFileType): boolean {
  switch (fileType) {
    case "PDF":
      // %PDF
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    case "JPG":
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case "DWG":
      return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "AC10";
    default:
      return false;
  }
}

export async function uploadDrawingAction(input: unknown) {
  try {
    const auth = await requireRole(["ADMIN", "TECHNICAL_OFFICE"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = uploadDrawingSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    // TO-02: sizeBytes عمدًا خارج التفكيك — لا يُقرأ من العميل في أي مسار.
    const {
      quotationRequestId,
      category,
      fileType,
      originalName,
      mimeType,
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

    // TO-02: التحقق يسبق أي كتابة على القرص — الملف المرفوض لا يلمس الـfilesystem أصلًا.
    const buffer = Buffer.from(base64, "base64");

    if (buffer.length > MAX_DRAWING_BYTES) {
      return { error: "errors.fileTooLarge" as const };
    }

    if (!matchesFileSignature(buffer, fileType)) {
      return { error: "errors.invalidFileContent" as const };
    }

    const ext = fileType === "PDF" ? "pdf" : fileType === "DWG" ? "dwg" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    // TO-11: الجذر خارج public/ — الـURL المخزَّن لا يتغيّر (/uploads/drawings/…)
    const uploadDir = uploadDirFor("drawings");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);
    const url = uploadUrl("drawings", filename);

    const drawing = await prisma.drawing.create({
      data: {
        quotationRequestId,
        category: category as DrawingCategory,
        fileType: fileType as DrawingFileType,
        filename,
        originalName,
        mimeType,
        // TO-02: الحجم الحقيقي المحسوب من المحتوى — لا رقم العميل
        sizeBytes: buffer.length,
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
      select: { id: true, uploadedById: true, quotationRequestId: true, status: true },
    });
    if (!drawing) return { error: "errors.notFound" as const };

    // دفعة ب — G1 يكتب DrawingStatus: التسلسل الشرعي DRAFT→TEC_APPROVED فقط
    if (drawing.status !== "DRAFT") {
      return { error: "errors.illegalStatusTransition" as const };
    }

    if (drawing.uploadedById === auth.userId && auth.role !== "ADMIN") {
      return { error: "errors.cannotApproveSelf" as const };
    }

    // SCR-017 PHASE 4 (BL-78): رسمة نافذة واحدة — اعتماد رسمة يُلغي (SUPERSEDED)
    // كل TEC_APPROVED أخرى على نفس الطلب، في transaction واحدة مع الاعتماد.
    const superseded = await prisma.drawing.findMany({
      where: {
        quotationRequestId: drawing.quotationRequestId,
        status: "TEC_APPROVED",
        id: { not: drawingId },
      },
      select: { id: true, originalName: true },
    });

    await prisma.$transaction([
      prisma.drawing.update({
        where: { id: drawingId },
        data: {
          approvedById: auth.userId,
          approvedAt: new Date(),
          status: "TEC_APPROVED",
        },
      }),
      ...(superseded.length
        ? [
            prisma.drawing.updateMany({
              where: { id: { in: superseded.map((d) => d.id) } },
              data: { status: "SUPERSEDED" },
            }),
          ]
        : []),
    ]);

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "DRAWING_APPROVED",
        entity: "Drawing",
        entityId: drawingId,
        details: JSON.stringify({ drawingId }),
      },
    });

    for (const old of superseded) {
      await prisma.activityLog.create({
        data: {
          userId: auth.userId,
          action: "DRAWING_SUPERSEDED",
          entity: "Drawing",
          entityId: old.id,
          details: `أُلغيت الرسمة ${old.originalName} باعتماد رسمة أحدث (${drawingId}) — رسمة نافذة واحدة (BL-78)`,
        },
      });
    }

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

// ── دفعة هـ · PHASE 1 — بوابتا G2/G3 مُعطَّلتان (كانتا مخترَعتين — D-02/D-05) ──

/**
 * G2 — بوابة تحقق المعاينات: **مُعطَّلة (PHASE 1 · BL-03 · D-05).**
 * حسن بهاء (INSPECTION_MANAGER) بلا بوابة اعتماد على الرسمة. سلسلة الرسمة الصحيحة
 * = DRAFT → TEC_APPROVED وانتهى. حذف الحالة/العمود = SCR منفصل ليوسف (BL-20).
 */
export async function verifyDrawingAction(_input: unknown) {
  return { error: "errors.gateRemoved" as const };
}

/**
 * G3 — بوابة اعتماد CEO: **مُعطَّلة (PHASE 1 · BL-02 · D-02).**
 * عمرو (ADMIN) خارج سلسلة اعتماد الرسومات تمامًا — البوابة كانت اختراعًا.
 * حذف الحالة/العتبة = SCR منفصل ليوسف (BL-20).
 */
export async function ceoApproveDrawingAction(_input: unknown) {
  return { error: "errors.gateRemoved" as const };
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
