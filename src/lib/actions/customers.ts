"use server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notifyRole, notifyDepartment, sendNotification } from "@/lib/notifications/send";
// SCR-INS-I (C2-fix): تصنيف حالات المعاينة — نفس المصدر الذي تقرؤه الخدمة والحرّاس
import { TERMINAL_INSPECTION_STATUSES } from "@/lib/services/inspection-status";
import { z } from "zod";

const stageChangeSchema = z.object({
  customerId: z.string(),
  newStage: z.enum([
    "NEW",
    "PRICED",
    "FOLLOW_UP",
    "INSPECTION",
    "EXECUTION",
    "RE_INSPECTION_FOLLOWUP",
    "REJECTED",
  ]),
  rejectReason: z.string().optional(),
});

export async function changeCustomerStage(
  input: z.infer<typeof stageChangeSchema>
): Promise<{ success: true } | { error: string }> {
  // دفعة هـ · Phase 4: المرحلة مشتقّة آليًا — التغيير اليدوي هو الاستثناء. SF-03
  // (قرار حوكمة صريح، يوسف 2026-07-25): فُتِح لإدارة المبيعات والمندوب حقُّ **تسجيل
  // الرفض فقط** (REJECTED) — تقييد لا توسيع. باقي انتقالات PipelineStage (override
  // للحالة المشتقّة) تبقى محصورة على ADMIN وحده كما كانت. requireRole يسمح للأدوار
  // الثلاثة بالدخول، ثم الحارس أدناه يفرض REJECTED-only على غير-ADMIN (least privilege).
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, newStage, rejectReason } = parsed.data;

  // SF-03: غير-ADMIN (SALES_MANAGER/SALES_REP) مسموح له بانتقال REJECTED فقط — تسجيل
  // قرار رفض العميل. أي انتقال آخر من هذين الدورين = override محصور بـADMIN → يُرفض.
  if (roleCheck.role !== "ADMIN" && newStage !== "REJECTED") {
    return { error: "errors.notAuthorized" };
  }

  // إلزام سبب الرفض ساري لكل الأدوار الثلاثة عند REJECTED — لا استثناء، لا تخفيف.
  if (newStage === "REJECTED" && !rejectReason?.trim()) {
    return { error: "errors.rejectReasonRequired" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, ownerId: true, stage: true, name: true, address: true, phone: true },
  });

  if (!customer) return { error: "errors.notFound" };

  // SF-03 (قيد ملكية): SALES_REP يرفض عملاءه فقط (ownerId === نفسه). مع قيد REJECTED-only
  // أعلاه ⇒ المندوب يرفض عملاءه لا غير. ownerId مُحمَّل سلفًا في الـselect (بلا استعلام
  // إضافي — صفر أثر أداء). عميل موجود لكن لمندوب آخر ⇒ خطأ صلاحيات صريح (لا "غير موجود"؛
  // ذاك للـid المفقود أعلاه). SALES_MANAGER بلا هذا القيد (نطاق إشرافي عام يوافق
  // assignCustomer/setCustomerCoverage). ADMIN بلا قيد.
  if (roleCheck.role === "SALES_REP" && customer.ownerId !== roleCheck.userId) {
    return { error: "errors.notAuthorized" };
  }

  const oldStage = customer.stage;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      stage: newStage,
      ...(newStage === "REJECTED" ? { rejectReason: rejectReason!.trim() } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "STAGE_CHANGED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: oldStage,
        to: newStage,
        ...(newStage === "REJECTED" ? { rejectReason: rejectReason!.trim() } : {}),
      }),
    },
  });

  /**
   * ══ SCR-INS-I / D-IN-20 (موجة C2-fix): إغلاق المعاينات تتاليًا عند رفض العميل ══
   *
   * **الفجوة المُغلَقة:** موجة C2 بنت **تسجيل** الانحراف ولم تبنِ **إغلاقه**، فمعاينة
   * ألغاها العميل تبقى «نشطة» للأبد: تُعدّ معلّقة، وتُبقي الطلب `ON_HOLD` والعميل في
   * مرحلة «معاينة». **مُتحقَّق أن العيب حيّ:** عميل في `REJECTED` وله معاينة مفتوحة.
   *
   * **D-IN-20:** رفض العميل = خروج من الصفقة، والقفل مسؤولية **المبيعات** لا
   * المعاينات ⇒ لا إجراء جديد ولا شاشة، بل **أثر جانبي لهذا الإجراء القائم**.
   * 🔴 حرّاس الإجراء وصلاحياته **لم تُمَس** — من يملك الرفض يملك أثره.
   *
   * ⚠️ **تعارض في نصّ التكليف حُسم بوعي:** طُلب التتالي «في نفس المعاملة» وطُلب أيضًا
   * أن «فشل التتالي لا يُبطل رفض العميل» — والاثنان لا يجتمعان (المعاملة الواحدة
   * تعني أن فشل التتالي **يُرجِع** الرفض). والإجراء أصلًا **بلا معاملة**: تحديث
   * العميل وسجلّه نداءان منفصلان. فالحلّ: التتالي في **معاملته الخاصة** (ذرّي داخل
   * نفسه — لا معاينة تُغلق بلا سجلّها) **بعد** نجاح الرفض، محوَّطًا بـtry/catch.
   * القيد النافذ هو الثاني: رفض العميل قرار بشري تمّ، ولا يُنقض بفشل أثر جانبي.
   */
  if (newStage === "REJECTED") {
    try {
      const openInspections = await prisma.inspectionRequest.findMany({
        where: {
          customerId,
          deletedAt: null,
          // الحدود: `DONE` لا تُمَس (تمّت فعلًا وهي جزء من K2) · `CANCELLED` لا تُمَس
          // (تشغيل مكرر للإجراء لا يُنتج سجلات مكرّرة).
          status: { notIn: [...TERMINAL_INSPECTION_STATUSES] },
        },
        select: {
          id: true,
          status: true,
          assigneeId: true,
          deviationReason: true,
        },
      });

      if (openInspections.length > 0) {
        const reason = rejectReason!.trim();
        const now = new Date();

        await prisma.$transaction(async (tx) => {
          for (const inspection of openInspections) {
            /**
             * 🔴 **لا يُدهس انحراف مسجَّل سلفًا.** لو قسم المعاينات سجّل السبب أولًا
             * (تأجيل العميل مثلًا) فذاك هو السبب الأدقّ — كتابته فوقه تُبدّل حقيقة
             * ميدانية بتخمين من شاشة أخرى. نكتب الحالة فقط، ونترك السبب لصاحبه.
             */
            const keepExistingDeviation = inspection.deviationReason !== null;

            await tx.inspectionRequest.update({
              where: { id: inspection.id },
              data: {
                status: "CANCELLED",
                ...(keepExistingDeviation
                  ? {}
                  : {
                      deviationReason: "CUSTOMER_REJECTED",
                      deviationRequestedBy: "CUSTOMER",
                      deviationAt: now,
                      deviationById: roleCheck.userId,
                      // سبب الرفض المُلزَم في هذا الإجراء يُعاد استخدامه —
                      // لا يُطلب سبب ثانٍ لنفس القرار.
                      deviationNote: reason,
                    }),
              },
            });

            await tx.activityLog.create({
              data: {
                userId: roleCheck.userId,
                action: "INSPECTION_CANCELLED_BY_REJECTION",
                entity: "InspectionRequest",
                entityId: inspection.id,
                details: JSON.stringify({
                  status: { from: inspection.status, to: "CANCELLED" },
                  cause: "CUSTOMER_REJECTED",
                  rejectReason: reason,
                  customerId,
                  deviationPreserved: keepExistingDeviation,
                }),
              },
            });
          }
        });

        // إشعار المندوب المُسنَد — هو ذاهب لموقع لن يُعاين. خارج المعاملة
        // (D-39: نظام الإشعارات بالع ولا يُبطل إغلاقًا وقع).
        for (const inspection of openInspections) {
          if (!inspection.assigneeId) continue;
          try {
            await sendNotification({
              userId: inspection.assigneeId,
              title: "notifications.inspectionCancelledTitle",
              body: `أُلغيت معاينة العميل ${customer.name} — رفض العميل: ${reason}`,
              type: "INSPECTION_CANCELLED",
              entityId: inspection.id,
              entityType: "InspectionRequest",
            });
          } catch {
            // notification failure must not block the operation
          }
        }
      }
    } catch (error) {
      // 🔴 يُسجَّل ولا يُبتلع (نمط D-39): رفض العميل نجح، والفشل هنا يترك معاينات
      // مفتوحة تحتاج تدخّلًا — صمتٌ عنه يعني عيبًا لا يعلم به أحد.
      console.error("[changeCustomerStage/cancelInspections]", error);
    }
  }

  /**
   * 🔴 **التتالي أحادي الاتجاه عمدًا.** إعادة العميل من `REJECTED` إلى أي مرحلة
   * أخرى **لا تُعيد فتح** المعاينات الملغاة — الفتح يكون بطلب معاينة **جديد**.
   * السبب: الإلغاء واقعة حدثت (أُخطر المندوب، وربما وُزّع وقته على غيرها)، وبعثها
   * آليًا يُنتج معاينة بلا موعد ولا التزام. ولا يوجد شرط هنا يعكس التتالي بقصد.
   */

  try {
    if (newStage === "INSPECTION") {
      // D-31 (BL-91): حُذف التوليد التلقائي للمعاينة نهائيًا — كان جذر الـ13 معاينة
      // اليتيمة (معاينة بلا طلب صريح). المرحلة تتغيّر فقط + إشعار المدير؛ المعاينة
      // تُطلَب صراحةً من شاشة العميل باختيار طلب محدّد (createInspection).
      await notifyRole("INSPECTION_MANAGER", {
        title: "notifications.stageInspectionTitle",
        body: `تم نقل العميل ${customer.name} إلى مرحلة المعاينة`,
        type: "STAGE_CHANGED",
        entityId: customerId,
        entityType: "Customer",
      });
    } else if (newStage === "PRICED") {
      await notifyDepartment("TECHNICAL_OFFICE", {
        title: "notifications.stagePricedTitle",
        body: `تم نقل العميل ${customer.name} إلى مرحلة التسعير`,
        type: "STAGE_CHANGED",
        entityId: customerId,
        entityType: "Customer",
      });
    }
  } catch {
    // notification failure must not block the operation
  }

  return { success: true };
}

const assignSchema = z.object({
  customerId: z.string(),
  ownerId: z.string().nullable(),
});

export async function assignCustomer(
  input: z.infer<typeof assignSchema>
): Promise<{ success: true } | { error: string }> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, ownerId } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { error: "errors.notFound" };

  const oldOwner = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { ownerId: true },
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: { ownerId },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "OWNER_ASSIGNED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: oldOwner?.ownerId,
        to: ownerId,
      }),
    },
  });

  return { success: true };
}

const coverageSchema = z.object({
  customerId: z.string(),
  coveredById: z.string().nullable(),
});

export async function setCustomerCoverage(
  input: z.infer<typeof coverageSchema>
): Promise<{ success: true } | { error: string }> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = coverageSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, coveredById } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, coveredById: true, name: true },
  });
  if (!customer) return { error: "errors.notFound" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { coveredById },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "COVERAGE_UPDATED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        from: customer.coveredById,
        to: coveredById,
      }),
    },
  });

  // SF-05 (الجزء 1): إشعار المستخدم المُسنَد حديثًا لتغطية العميل — فقط عند إسناد فعلي
  // جديد (coveredById غير فارغ ومختلف عن السابق): لا عند إلغاء التغطية (null)، ولا عند
  // إعادة تعيين نفس المستخدم (لا "جديد"). النمط مطابق للموجود: title=مفتاح t()، body=نص
  // عربي مُدرَج. sendNotification بالع + تسجيل (send.ts:45-65، D-39) — لا يرمي أبدًا،
  // فلا يكسر مسار setCustomerCoverage لو فشل الإشعار (لا حاجة try/catch حوله).
  if (coveredById && coveredById !== customer.coveredById) {
    await sendNotification({
      userId: coveredById,
      title: "notifications.coverageAssignedTitle",
      body: `تم إسنادك لتغطية العميل ${customer.name}`,
      type: "COVERAGE_UPDATED",
      entityId: customerId,
      entityType: "Customer",
    });
  }

  return { success: true };
}

const addInteractionSchema = z.object({
  customerId: z.string(),
  type: z.enum(["CALL", "WHATSAPP", "VISIT", "NOTE"]),
  note: z.string().min(1, "errors.required"),
});

export async function addInteraction(
  input: z.infer<typeof addInteractionSchema>
): Promise<
  | { success: true; data: { id: string; type: string; note: string; userName: string; createdAt: Date } }
  | { error: string }
> {
  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

  const parsed = addInteractionSchema.safeParse(input);
  if (!parsed.success) return { error: "errors.invalidInput" };

  const { customerId, type, note } = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { error: "errors.notFound" };

  const interaction = await prisma.interaction.create({
    data: {
      customerId,
      userId: roleCheck.userId,
      type: type as any,
      note: note.trim(),
    },
    include: {
      user: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: roleCheck.userId,
      action: "INTERACTION_ADDED",
      entity: "Customer",
      entityId: customerId,
      details: JSON.stringify({
        interactionId: interaction.id,
        type: interaction.type,
      }),
    },
  });

  return {
    success: true,
    data: {
      id: interaction.id,
      type: interaction.type,
      note: interaction.note,
      userName: interaction.user.name,
      createdAt: interaction.createdAt,
    },
  };
}
