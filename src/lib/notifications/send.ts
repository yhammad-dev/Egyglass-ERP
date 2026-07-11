import { prisma } from "@/lib/prisma";

export interface SendNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  entityId?: string;
  entityType?: string;
}

export async function sendNotification(input: SendNotificationInput) {
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
}

export async function notifyRole(
  role: string,
  notification: Omit<SendNotificationInput, "userId">
) {
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
    users.map((user) =>
      sendNotification({ userId: user.id, ...notification })
    )
  );
}

export async function notifyDepartment(
  department: string,
  notification: Omit<SendNotificationInput, "userId">
) {
  const users = await prisma.user.findMany({
    where: { department: department as any, isActive: true, deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    users.map((user) =>
      sendNotification({ userId: user.id, ...notification })
    )
  );
}
