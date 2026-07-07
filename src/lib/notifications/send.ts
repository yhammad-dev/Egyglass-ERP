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
