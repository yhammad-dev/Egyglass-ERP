"use server";

import { z } from "zod";
import { MfgStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sendNotification } from "../notifications/send";
import { notifyRole } from "@/lib/notifications/send";
import { createInstallationOrder } from "../installations/actions";

const MFG_ROLES = ["ADMIN", "PROCUREMENT"];

export async function getMfgOrders() {
  try {
    const roleCheck = await requireRole(MFG_ROLES);
    if (!roleCheck.authorized) return [];

    const orders = await prisma.manufacturingOrder.findMany({
      include: {
        quotation: {
          select: {
            id: true,
            number: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((order) => ({
      id: order.id,
      quotationId: order.quotationId,
      number: order.quotation.number,
      customerName: order.quotation.customer.name,
      status: order.status,
      expectedAt: order.expectedAt ? order.expectedAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[getMfgOrders]", error);
    return [];
  }
}

// PHASE 2 (ج): إصدار أمر التصنيع = المدير التنفيذي (TEC_APPROVER) حصرًا (BL-01)،
// محكوم بـ: رسمة TEC_APPROVED على نفس الطلب (BL-08) + التزام تعاقدي (مشروعات: عقد؛
// السوشيال: بلا حارس — لا حقل يسجّل موافقة العميل، BL-18 مفتوح).
export async function createManufacturingOrder(quotationId: string) {
  try {
    const roleCheck = await requireRole(["TEC_APPROVER", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        number: true,
        contract: { select: { id: true } },
        quotationRequest: {
          select: {
            id: true,
            technicalRoute: true,
            drawings: { where: { status: "TEC_APPROVED" }, select: { id: true } },
          },
        },
      },
    });
    if (!quotation) return { error: "errors.notFound" as const };

    // BL-08: لا أمر تصنيع بلا رسمة معتمدة فنيًا (TEC_APPROVED) على نفس الطلب
    const hasApprovedDrawing =
      (quotation.quotationRequest?.drawings.length ?? 0) > 0;
    if (!hasApprovedDrawing) return { error: "errors.noApprovedDrawing" as const };

    // حارس الالتزام: المشروعات تتطلب عقدًا. السوشيال بلا حارس (BL-18 — لا حقل موافقة عميل).
    const route = quotation.quotationRequest?.technicalRoute ?? "PROJECTS";
    if (route === "PROJECTS" && !quotation.contract) {
      return { error: "errors.noContractForManufacturing" as const };
    }

    // "أمر أصلي واحد لكل عرض" يُفرض منطقيًا (القيد الصلب رُفع لتمكين بدائل W-06)
    const existing = await prisma.manufacturingOrder.findFirst({
      where: { quotationId, parentOrderId: null },
      select: { id: true },
    });
    if (existing) return { success: true as const, id: existing.id };

    const order = await prisma.manufacturingOrder.create({
      data: { quotationId },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "MFG_ORDER_CREATED",
        entity: "ManufacturingOrder",
        entityId: order.id,
        details: `أصدر المدير التنفيذي أمر تصنيع لعرض السعر ${quotation.number}`,
      },
    });

    // إشعار PROCUREMENT (شكري) — الأمر جاهز لدخول بوابة المراجعة
    await notifyRole("PROCUREMENT", {
      title: "notifications.newMfgOrderTitle",
      body: `أمر تصنيع جديد لعرض السعر ${quotation.number}`,
      type: "MFG_ORDER_CREATED",
      entityId: order.id,
      entityType: "ManufacturingOrder",
    });

    return { success: true as const, id: order.id };
  } catch (error) {
    console.error("[createManufacturingOrder]", error);
    return { error: "errors.serverError" as const };
  }
}

const updateStatusSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(MfgStatus),
});

export async function updateMfgStatus(input: unknown) {
  try {
    const roleCheck = await requireRole(MFG_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const order = await prisma.manufacturingOrder.findUnique({
      where: { id: parsed.data.id },
    });
    if (!order) return { error: "errors.notFound" as const };

    // دفعة أ: فرض التسلسل الشرعي server-side — القفزات غير الشرعية مرفوضة.
    // الانتقالات إلى/من بوابة المراجعة تتم حصريًا عبر actions البوابة (submit/approve/reject).
    const LEGAL_TRANSITIONS: Record<string, string[]> = {
      PENDING: ["UNDER_REVIEW"],
      UNDER_REVIEW: [], // موافقة/رفض عبر actions البوابة فقط (أدوار مختلفة)
      REJECTED: ["UNDER_REVIEW"],
      IN_PRODUCTION: ["READY"],
      READY: ["DELIVERED"],
      DELIVERED: [],
    };
    if (!LEGAL_TRANSITIONS[order.status]?.includes(parsed.data.status)) {
      return { error: "errors.illegalStatusTransition" as const };
    }

    await prisma.manufacturingOrder.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_STATUS",
        entity: "ManufacturingOrder",
        entityId: order.id,
        details: `تم تغيير حالة أمر التصنيع من ${order.status} إلى ${parsed.data.status}`,
      },
    });

    if (parsed.data.status === "READY" && order.status !== "READY") {
      const installationOrder = await createInstallationOrder(order.id);

      const installationUsers = await prisma.user.findMany({
        where: { role: "INSTALLATIONS", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        installationUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.mfgReadyTitle",
            body: "مواد جاهزة للتركيب",
            type: "MFG_READY_FOR_INSTALLATION",
            entityId: installationOrder.id,
            entityType: "InstallationOrder",
          })
        )
      );
    }

    return { success: true as const };
  } catch (error) {
    console.error("[updateMfgStatus]", error);
    return { error: "errors.serverError" as const };
  }
}
