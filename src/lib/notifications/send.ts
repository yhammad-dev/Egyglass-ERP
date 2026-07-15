import { prisma } from "@/lib/prisma";

export interface SendNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  entityId?: string;
  entityType?: string;
}

// D-39 (يوسف، 2026-07-15): نظام الإشعارات النافذ = **بالع + تسجيل**. فشل الإشعار لا يوقف
// أي عملية (لا يرمي في أي مسار)، ولا يختفي (يُكتب أثرًا). systemActor = أقدم ADMIN،
// نفس نمط NOTIFICATION_ZERO_RECIPIENTS القائم. آخر خط دفاع: حتى التسجيل نفسه لا يرمي.
async function logNotificationFailure(
  entityId: string,
  context: string,
  error: unknown
): Promise<void> {
  try {
    console.error(`[notifications] ${context}`, error);
    const systemActor = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (systemActor) {
      await prisma.activityLog.create({
        data: {
          userId: systemActor.id,
          action: "NOTIFICATION_FAILED",
          entity: "Notification",
          entityId,
          details: `[تحذير آلي] فشل إشعار (${context}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      });
    }
  } catch {
    // آخر خط دفاع — تسجيل الفشل نفسه لا يجوز أن يرمي (وإلا أوقف العملية)
  }
}

export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type,
        entityId: input.entityId ?? null,
        entityType: input.entityType ?? null,
      },
    });
  } catch (error) {
    // D-39: بالع + تسجيل — لا رمي
    await logNotificationFailure(
      input.entityId ?? input.type,
      `sendNotification type=${input.type} user=${input.userId}`,
      error
    );
  }
}

export async function notifyRole(
  role: string,
  notification: Omit<SendNotificationInput, "userId">
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: role as any, isActive: true, deletedAt: null },
      select: { id: true },
    });

    // دفعة ب: لا فشل صامت — إشعار لدور بلا مستخدمين نشطين يُسجَّل تحذيرًا (console + ActivityLog)
    if (users.length === 0) {
      console.warn(
        `[notifyRole] ZERO active recipients for role "${role}" — notification "${notification.type}" lost`
      );
      // ActivityLog.userId له FK — نُسند التحذير النظامي لأقدم ADMIN (details توضح أنه تحذير آلي)
      const systemActor = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (systemActor) {
        await prisma.activityLog.create({
          data: {
            userId: systemActor.id,
            action: "NOTIFICATION_ZERO_RECIPIENTS",
            entity: "Notification",
            entityId: notification.entityId ?? role,
            details: `[تحذير آلي] إشعار ${notification.type} لدور ${role} ضاع — لا مستخدمين نشطين بهذا الدور`,
          },
        });
      }
      return;
    }

    await Promise.all(
      users.map((user) => sendNotification({ userId: user.id, ...notification }))
    );
  } catch (error) {
    // D-39: بالع + تسجيل — فشل جلب المستلمين/تسجيل الصفر لا يوقف العملية
    await logNotificationFailure(
      notification.entityId ?? role,
      `notifyRole role=${role} type=${notification.type}`,
      error
    );
  }
}

export async function notifyDepartment(
  department: string,
  notification: Omit<SendNotificationInput, "userId">
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { department: department as any, isActive: true, deletedAt: null },
      select: { id: true },
    });

    await Promise.all(
      users.map((user) => sendNotification({ userId: user.id, ...notification }))
    );
  } catch (error) {
    // D-39: بالع + تسجيل
    await logNotificationFailure(
      notification.entityId ?? department,
      `notifyDepartment dept=${department} type=${notification.type}`,
      error
    );
  }
}
