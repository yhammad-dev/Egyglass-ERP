"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sendNotification } from "@/lib/notifications/send";

/**
 * TO-24 — بوابة الاعتماد المبدئي من التيم ليدر.
 *
 * 🔴 هذه البوابة هي **بوابة وصول العميل** (الطباعة)، وليست بوابة التعاقد/التصنيع.
 * بوابة التعاقد/التصنيع تبقى `reviewStatus` كما هي — لم تُمس هنا إطلاقًا
 * (`contract-core.ts:47` · `manufacturing/actions.ts:80`).
 *
 * النطاق: العروض **المرتبطة بطلب تسعير فقط** (عروض المكتب الفني). العرض بلا طلب
 * لا يمر بالمكتب الفني أصلًا فلا معنى لبوابة ليدر عليه — انظر `isGated` أدناه.
 */

const SUBMIT_ROLES = ["ADMIN", "TECHNICAL_OFFICE", "TEC_LEAD"];
const LEAD_DECISION_ROLES = ["ADMIN", "TEC_LEAD"];

const idSchema = z.object({ id: z.string().min(1, "errors.invalidInput") });
const returnSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  // سبب الإرجاع **إلزامي**: إرجاع بلا سبب يترك المهندس بلا ما يصحّحه.
  note: z.string().trim().min(1, "errors.leadNoteRequired"),
});

type ActionResult =
  | { success: true; warning?: string }
  | { error: string };

/**
 * جلب العرض بما يكفي لكل الحراس: حالته الحالية، منشئه، ومسار طلبه.
 * `quotationRequest` هو ما يحدّد أن العرض داخل البوابة أصلًا.
 */
async function loadGatedQuotation(id: string) {
  return prisma.quotation.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      createdById: true,
      leadApprovalStatus: true,
      customerId: true,
      quotationRequest: { select: { id: true, technicalRoute: true } },
    },
  });
}

/**
 * TO-24 — جدول الانتقالات المسموحة، مصدر واحد يمنع أي انتقال غير مذكور صراحةً
 * (نفس مبدأ حارس الانتقال في TO-04). أي حالة غير مدرجة ⇒ ممنوع.
 */
const ALLOWED_FROM: Record<string, string[]> = {
  SUBMIT: ["NOT_SUBMITTED", "LEAD_RETURNED"],
  APPROVE: ["PENDING_LEAD"],
  RETURN: ["PENDING_LEAD"],
};

/**
 * صلاحية القرار: ADMIN بلا قيد، وTEC_LEAD **فقط** إن كان مساره يطابق مسار الطلب.
 * ليدر السوشيال لا يعتمد عرض مشروعات ولو كان مُقدَّمًا.
 */
async function canDecide(
  userId: string,
  role: string,
  technicalRoute: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "TEC_LEAD") return false;

  const lead = await prisma.user.findUnique({
    where: { id: userId },
    select: { leadRoute: true },
  });
  return lead?.leadRoute === technicalRoute;
}

// ─── 1) تقديم المهندس ────────────────────────────────────────────────────────

export async function submitForLeadApproval(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireRole(SUBMIT_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" };

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const quotation = await loadGatedQuotation(parsed.data.id);
    if (!quotation) return { error: "errors.notFound" };
    if (!quotation.quotationRequest) return { error: "errors.quotationNotGated" };

    // ملكية: المنشئ يقدّم عرضه. TEC_LEAD/ADMIN يقدّران التقديم نيابةً (التقاط متأخر).
    if (
      auth.role === "TECHNICAL_OFFICE" &&
      quotation.createdById !== auth.userId
    ) {
      return { error: "errors.notAuthorized" };
    }

    if (!ALLOWED_FROM.SUBMIT.includes(quotation.leadApprovalStatus)) {
      return { error: "errors.leadTransitionNotAllowed" };
    }

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        leadApprovalStatus: "PENDING_LEAD",
        // KPI: أساس قياس زمن انتظار قرار الليدر. يُعاد ضبطه عند كل تقديم —
        // الدورة الجديدة تُقاس من تقديمها هي لا من الأول.
        submittedAt: new Date(),
        updatedById: auth.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "LEAD_APPROVAL_SUBMITTED",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم تقديم عرض السعر ${quotation.number} للاعتماد المبدئي`,
      },
    });

    // المستقبِل: تيم ليدر المنشئ أولًا؛ فإن لم يكن مربوطًا فكل تيم ليدر يطابق
    // مساره مسار الطلب. لا `notifyRole` هنا لأنها تُرسل لكل TEC_LEAD بلا تمييز مسار.
    const creator = await prisma.user.findUnique({
      where: { id: quotation.createdById },
      select: { teamLeadId: true },
    });

    let recipientIds: string[] = [];
    if (creator?.teamLeadId) {
      recipientIds = [creator.teamLeadId];
    } else {
      const leads = await prisma.user.findMany({
        where: {
          role: "TEC_LEAD",
          isActive: true,
          deletedAt: null,
          leadRoute: quotation.quotationRequest.technicalRoute,
        },
        select: { id: true },
      });
      recipientIds = leads.map((l) => l.id);
    }

    for (const userId of recipientIds) {
      await sendNotification({
        userId,
        title: "notifications.leadApprovalRequestedTitle",
        body: `عرض السعر ${quotation.number} بانتظار اعتمادك المبدئي`,
        type: "LEAD_APPROVAL_REQUESTED",
        entityId: quotation.id,
        entityType: "Quotation",
      });
    }

    // لا فشل صامت: التقديم صحيح ومسجَّل، لكن لا مستقبِل له ⇒ يُبلَّغ المستخدم
    // ويُسجَّل تحذير، بدل أن يظن أن أحدًا أُخطر.
    if (recipientIds.length === 0) {
      console.warn(
        `[lead-approval] NO_LEAD_RECIPIENT quotation=${quotation.id} route=${quotation.quotationRequest.technicalRoute}`
      );
      await prisma.activityLog.create({
        data: {
          userId: auth.userId,
          action: "LEAD_APPROVAL_NO_RECIPIENT",
          entity: "Quotation",
          entityId: quotation.id,
          details: `[تحذير آلي] لا تيم ليدر لمسار ${quotation.quotationRequest.technicalRoute} — التقديم مسجَّل بلا إشعار`,
        },
      });
      return { success: true, warning: "errors.noLeadRecipient" };
    }

    return { success: true };
  } catch (error) {
    console.error("[submitForLeadApproval]", error);
    return { error: "errors.serverError" };
  }
}

// ─── 2) اعتماد الليدر ────────────────────────────────────────────────────────

export async function leadApproveQuotation(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireRole(LEAD_DECISION_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" };

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const quotation = await loadGatedQuotation(parsed.data.id);
    if (!quotation) return { error: "errors.notFound" };
    if (!quotation.quotationRequest) return { error: "errors.quotationNotGated" };

    if (!(await canDecide(auth.userId, auth.role, quotation.quotationRequest.technicalRoute))) {
      return { error: "errors.notAuthorized" };
    }

    if (!ALLOWED_FROM.APPROVE.includes(quotation.leadApprovalStatus)) {
      return { error: "errors.leadTransitionNotAllowed" };
    }

    // TO-24: اعتماد الذات **مسموح** هنا بقرار المالك (بعكس الاعتماد النهائي في
    // TO-01). لا يُمنع — لكنه يُسجَّل صراحةً ويظهر وسمًا في الشاشة ليراه
    // TEC_APPROVER عند الاعتماد النهائي.
    const isSelfApproval = quotation.createdById === auth.userId;

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        leadApprovalStatus: "LEAD_APPROVED",
        leadDecidedAt: new Date(),
        leadDecidedById: auth.userId,
        // سبب الإرجاع السابق يُمسح — الدورة انتهت باعتماد، وإبقاؤه يضلّل القارئ.
        leadNote: null,
        updatedById: auth.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "LEAD_APPROVED",
        entity: "Quotation",
        entityId: quotation.id,
        details: `اعتماد مبدئي لعرض السعر ${quotation.number}${isSelfApproval ? " — ⚠️ اعتماد ذاتي (المُقرِّر هو المنشئ)" : ""}`,
      },
    });

    // إشعار المبيعات — نفس نمط QUOTATION_READY (review/actions.ts:168) بنوع ونص
    // مختلفين كي لا يُخلط الاعتماد المبدئي بالنهائي.
    const customer = await prisma.customer.findUnique({
      where: { id: quotation.customerId },
      select: { ownerId: true },
    });

    if (customer?.ownerId) {
      await sendNotification({
        userId: customer.ownerId,
        title: "notifications.leadApprovedTitle",
        body: `عرض السعر ${quotation.number} اعتُمد مبدئيًا — جاهز للعرض على العميل`,
        type: "QUOTATION_LEAD_APPROVED",
        entityId: quotation.id,
        entityType: "Quotation",
      });
      return { success: true };
    }

    // لا فشل صامت: العميل بلا مالك ⇒ لا أحد في المبيعات يعلم.
    console.warn(`[lead-approval] NO_CUSTOMER_OWNER quotation=${quotation.id}`);
    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "LEAD_APPROVAL_NO_RECIPIENT",
        entity: "Quotation",
        entityId: quotation.id,
        details: "[تحذير آلي] العميل بلا مالك — الاعتماد المبدئي تم بلا إشعار للمبيعات",
      },
    });
    return { success: true, warning: "errors.noCustomerOwner" };
  } catch (error) {
    console.error("[leadApproveQuotation]", error);
    return { error: "errors.serverError" };
  }
}

// ─── 3) إرجاع الليدر ─────────────────────────────────────────────────────────

export async function leadReturnQuotation(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireRole(LEAD_DECISION_ROLES);
    if (!auth.authorized) return { error: "errors.notAuthorized" };

    const parsed = returnSchema.safeParse(input);
    if (!parsed.success) {
      // رسالة الحقل نفسها مفتاح ترجمة — السبب الفارغ يُميَّز عن أي مدخل خاطئ.
      return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
    }

    const quotation = await loadGatedQuotation(parsed.data.id);
    if (!quotation) return { error: "errors.notFound" };
    if (!quotation.quotationRequest) return { error: "errors.quotationNotGated" };

    if (!(await canDecide(auth.userId, auth.role, quotation.quotationRequest.technicalRoute))) {
      return { error: "errors.notAuthorized" };
    }

    if (!ALLOWED_FROM.RETURN.includes(quotation.leadApprovalStatus)) {
      return { error: "errors.leadTransitionNotAllowed" };
    }

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        leadApprovalStatus: "LEAD_RETURNED",
        leadDecidedAt: new Date(),
        leadDecidedById: auth.userId,
        leadNote: parsed.data.note,
        updatedById: auth.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "LEAD_RETURNED",
        entity: "Quotation",
        entityId: quotation.id,
        details: `إرجاع عرض السعر ${quotation.number} للمهندس — السبب: ${parsed.data.note}`,
      },
    });

    // المهندس المنشئ يُخطَر بالسبب — بعكس الإرجاع من TEC_APPROVER الصامت اليوم
    // (رُصد في TO-24-DIAG: rejectQuotationAction بلا أي إشعار).
    await sendNotification({
      userId: quotation.createdById,
      title: "notifications.leadReturnedTitle",
      body: `عرض السعر ${quotation.number} أُرجع إليك — ${parsed.data.note}`,
      type: "QUOTATION_LEAD_RETURNED",
      entityId: quotation.id,
      entityType: "Quotation",
    });

    return { success: true };
  } catch (error) {
    console.error("[leadReturnQuotation]", error);
    return { error: "errors.serverError" };
  }
}
