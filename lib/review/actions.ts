"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
// TO-31: نفس حارس المسار المستعمل في التسعير — تعريف واحد في المشروع كله.
import { checkEngineerRoute } from "@/lib/services/engineer-route";
import { notifyRole, sendNotification } from "@/lib/notifications/send";

// PHASE 2 (D-03): اعتماد عرض السعر ملك المدير التنفيذي (مدير المكتب الهندسي = TEC_APPROVER).
// محمد حسام (REVIEW) لا علاقة له بالتسعير — دوره على أمر التصنيع (PHASE 3).
const QUOTATION_APPROVAL_ROLES = ["TEC_APPROVER", "ADMIN"];

// TO-04: بوابة الدور لإعادة التقديم = الأدوار القادرة على إنشاء عرض أصلًا
// (نفس PRICING_ROLES في lib/pricing/actions.ts — تُكرَّر صراحةً لأن الملف "use server"
// فلا يُصدَّر منه إلا async؛ نفس أسلوب quotations/new/page.tsx).
// الصلاحية الفعلية تُضيَّق بعدها داخل الأكشن: المنشئ نفسه أو TECHNICAL_OFFICE أو ADMIN.
const RESUBMIT_GATE_ROLES = ["ADMIN", "SALES_MANAGER", "TECHNICAL_OFFICE", "TEC_APPROVER"];

export async function getPendingReviewQuotations() {
  try {
    const roleCheck = await requireRole(QUOTATION_APPROVAL_ROLES);
    if (!roleCheck.authorized) return [];

    const quotations = await prisma.quotation.findMany({
      where: { reviewStatus: "PENDING_REVIEW" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return quotations.map((q) => ({
      id: q.id,
      number: q.number,
      customerName: q.customer.name,
      total: q.total.toNumber(),
      createdByName: q.createdBy.name,
      createdAt: q.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[getPendingReviewQuotations]", error);
    return [];
  }
}

export async function getReviewQuotationDetail(id: string) {
  try {
    const roleCheck = await requireRole(QUOTATION_APPROVAL_ROLES);
    if (!roleCheck.authorized) return null;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
        items: true,
      },
    });

    if (!quotation) return null;

    return {
      id: quotation.id,
      number: quotation.number,
      reviewStatus: quotation.reviewStatus,
      reviewNote: quotation.reviewNote,
      createdAt: quotation.createdAt.toISOString(),
      subtotal: quotation.subtotal.toNumber(),
      taxPct: quotation.taxPct.toNumber(),
      taxAmount: quotation.taxAmount.toNumber(),
      total: quotation.total.toNumber(),
      customer: quotation.customer,
      createdBy: quotation.createdBy,
      items: quotation.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
    };
  } catch (error) {
    console.error("[getReviewQuotationDetail]", error);
    return null;
  }
}

const approveSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
});

export async function approveQuotationAction(input: unknown) {
  try {
    const roleCheck = await requireRole(QUOTATION_APPROVAL_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const quotation = await prisma.quotation.findUnique({
      where: { id: parsed.data.id },
    });
    if (!quotation) return { error: "errors.notFound" as const };

    // TO-04 — حارس انتقال الحالة: الاعتماد شرعي من PENDING_REVIEW فقط.
    // يسبق فحص اعتماد الذات مطابقةً لنمط اعتماد الرسمة المرجعي
    // (technical-office/actions.ts: فحص الحالة أولًا ثم cannotApproveSelf).
    // بدونه: عرض مرفوض (RETURNED) يُقلب إلى APPROVED بلا تصحيح فيصير سبب الرفض
    // في reviewNote أثرًا ميتًا، وعرض APPROVED يُعاد اعتماده فتتكرر إشعارات العميل
    // ويُستبدل المعتمِد المسجَّل. رسالتان متمايزتان لأن الإجراء المطلوب مختلف:
    // APPROVED = لا فعل، RETURNED = يلزم إعادة تقديم عبر resubmitQuotationAction.
    if (quotation.reviewStatus === "APPROVED") {
      return { error: "errors.quotationAlreadyApproved" as const };
    }
    if (quotation.reviewStatus === "RETURNED") {
      return { error: "errors.quotationMustBeResubmitted" as const };
    }

    // TO-01 — فصل الواجبات: من أنشأ العرض لا يعتمده. الحارس هنا (server-side) لا في
    // الواجهة، فهو الحد الفاصل الحقيقي. نفس نمط اعتماد الرسمة
    // (technical-office/actions.ts — فحص errors.cannotApproveSelf) وقرار الخصم D-20
    // (lib/actions/discount.ts — منع تمرير المدير لطلبه).
    // 🔴 فرق مقصود عن نمط الرسمة: **بلا استثناء لـADMIN**. الرسمة تعفي ADMIN، أما اعتماد
    // التسعير فرقابة مالية على قيمة تُجمَّد في العقد ⇒ القاعدة تسري على الجميع، ومن ضمنهم
    // ADMIN و TEC_APPROVER، متى كان هو المنشئ (قرار المالك — Wave TO-A).
    if (quotation.createdById === roleCheck.userId) {
      return { error: "errors.selfApprovalNotAllowed" as const };
    }

    await prisma.quotation.update({
      where: { id: parsed.data.id },
      data: {
        // TO-23: `updatedById` **فقط** — منطق reviewStatus/TO-04 لم يُمس إطلاقًا.
        updatedById: roleCheck.userId,
        reviewStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: roleCheck.userId,
        // BL-16 (د): المعتمِد الفعلي = المدير التنفيذي — يظهر في قالب الطباعة
        approvedById: roleCheck.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "APPROVE",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تمت الموافقة على عرض السعر ${quotation.number}`,
      },
    });

    await sendNotification({
      userId: quotation.createdById,
      title: "notifications.quotationApprovedTitle",
      body: `تم اعتماد عرض السعر ${quotation.number}`,
      type: "QUOTATION_APPROVED",
      entityId: quotation.id,
      entityType: "Quotation",
    });

    const quotationWithCustomer = await prisma.quotation.findUnique({
      where: { id: parsed.data.id },
      include: { customer: { select: { ownerId: true } } },
    });

    if (quotationWithCustomer?.customer?.ownerId) {
      await sendNotification({
        userId: quotationWithCustomer.customer.ownerId,
        title: "notifications.quotationReadyTitle",
        body: `عرض السعر ${quotation.number} جاهز للعميل`,
        type: "QUOTATION_READY",
        entityId: quotation.id,
        entityType: "Quotation",
      });
    }

    // PHASE 2 (أ · D-04): أُلغي التوليد التلقائي لأمر التصنيع من اعتماد العرض.
    // أمر التصنيع يُصدره المدير التنفيذي (TEC_APPROVER) كخطوة مستقلة عبر
    // createManufacturingOrder المحروسة (رسمة TEC_APPROVED + التزام تعاقدي)،
    // ثم يعتمده محمد حسام (REVIEW) في PHASE 3.

    return { success: true as const };
  } catch (error) {
    console.error("[approveQuotationAction]", error);
    return { error: "errors.serverError" as const };
  }
}

const rejectSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  reason: z.string().min(1, "errors.rejectReasonRequired"),
});

export async function rejectQuotationAction(input: unknown) {
  try {
    const roleCheck = await requireRole(QUOTATION_APPROVAL_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error:
          parsed.error.flatten().fieldErrors.reason?.[0] ?? "errors.invalidInput",
      };
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: parsed.data.id },
    });
    if (!quotation) return { error: "errors.notFound" as const };

    await prisma.quotation.update({
      where: { id: parsed.data.id },
      data: {
        // TO-23: `updatedById` **فقط** — منطق reviewStatus/TO-04 لم يُمس إطلاقًا.
        updatedById: roleCheck.userId,
        reviewStatus: "RETURNED",
        reviewNote: parsed.data.reason,
        reviewedAt: new Date(),
        reviewedById: roleCheck.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "REJECT",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم إرجاع عرض السعر ${quotation.number} بسبب: ${parsed.data.reason}`,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[rejectQuotationAction]", error);
    return { error: "errors.serverError" as const };
  }
}

const resubmitSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
});

/**
 * TO-04 — إعادة تقديم عرض مرتجع للمراجعة (RETURNED → PENDING_REVIEW).
 *
 * سبب وجوده: مُتحقَّق بالـgrep أن كاتبَي reviewStatus في المشروع كله اثنان فقط
 * (APPROVED و RETURNED)، وأن **لا كود يكتب PENDING_REVIEW إطلاقًا** — مصدرها الوحيد
 * `@default(PENDING_REVIEW)` في الـschema. فبمجرد إضافة حارس الانتقال في
 * approveQuotationAction يصير RETURNED طريقًا مسدودًا بلا هذا الأكشن.
 *
 * الصلاحية: بوابة دور أولًا (L-05)، ثم تضييق على المورد نفسه — المنشئ أو المكتب
 * الفني (مالك إعادة التسعير — W-02) أو ADMIN. مدير المبيعات لا يُعيد تقديم عرض غيره.
 *
 * سبب الإرجاع: يُصفَّر من `reviewNote` (العمود = حالة حيّة تخصّ الدورة الجارية)
 * لكنه **يُحفظ في ActivityLog** قبل التصفير — الأثر التدقيقي append-only لا يُمس.
 */
export async function resubmitQuotationAction(input: unknown) {
  try {
    const roleCheck = await requireRole(RESUBMIT_GATE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = resubmitSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const quotation = await prisma.quotation.findUnique({
      where: { id: parsed.data.id },
      // TO-31: مسار الطلب — مدخل حارس المسار أدناه.
      include: { quotationRequest: { select: { technicalRoute: true } } },
    });
    if (!quotation) return { error: "errors.notFound" as const };

    // إعادة التقديم شرعية من RETURNED فقط (PENDING_REVIEW مُعاد تقديمه أصلًا،
    // و APPROVED سند نهائي لا يُعاد فتحه من هنا).
    if (quotation.reviewStatus !== "RETURNED") {
      return { error: "errors.illegalStatusTransition" as const };
    }

    // تضييق على المورد: بوابة الدور وحدها لا تكفي — SALES_MANAGER داخل البوابة
    // لكنه لا يملك إعادة تقديم عرض أنشأه غيره.
    const isOwner = quotation.createdById === roleCheck.userId;
    const isAdmin = roleCheck.role === "ADMIN";

    // 🔴 TO-31 — كان `isTechnicalOffice` وحده يمرّر **أي** مهندس على **أي** عرض
    // مُرجَع في الشركة. صار: عرضه هو، أو عرض **داخل مساره** (زميل في نفس الفريق —
    // وهو الغرض المشروع من فتحه للمكتب الفني لا للمنشئ وحده).
    // ⚠️ منطق الانتقال نفسه (RETURNED → PENDING_REVIEW) لم يُمس — الحارس فقط.
    let isTechnicalOfficeAllowed = false;
    if (roleCheck.role === "TECHNICAL_OFFICE") {
      isTechnicalOfficeAllowed =
        isOwner ||
        (await checkEngineerRoute(
          roleCheck.role,
          roleCheck.userId,
          quotation.quotationRequest?.technicalRoute,
          "resubmitQuotation"
        )) === null;
    }

    if (!isOwner && !isTechnicalOfficeAllowed && !isAdmin) {
      return { error: "errors.notAuthorized" as const };
    }

    const previousNote = quotation.reviewNote;

    await prisma.quotation.update({
      where: { id: parsed.data.id },
      data: {
        // TO-23: `updatedById` **فقط** — منطق reviewStatus/TO-04 لم يُمس إطلاقًا.
        updatedById: roleCheck.userId,
        reviewStatus: "PENDING_REVIEW",
        // الدورة الجديدة تبدأ نظيفة — السبب القديم محفوظ في ActivityLog أدناه
        reviewNote: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "QUOTATION_RESUBMITTED",
        entity: "Quotation",
        entityId: quotation.id,
        details: `أُعيد تقديم عرض السعر ${quotation.number} للمراجعة${
          previousNote ? ` — سبب الإرجاع السابق: ${previousNote}` : ""
        }`,
      },
    });

    await notifyRole("TEC_APPROVER", {
      title: "notifications.quotationResubmittedTitle",
      body: `عرض السعر ${quotation.number} أُعيد تقديمه للمراجعة`,
      type: "QUOTATION_RESUBMITTED",
      entityId: quotation.id,
      entityType: "Quotation",
    });

    return { success: true as const };
  } catch (error) {
    console.error("[resubmitQuotationAction]", error);
    return { error: "errors.serverError" as const };
  }
}
