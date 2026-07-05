import { prisma } from "@/lib/prisma";

type NotificationInput = {
  userId: string;
  title: string;
  body: string;
  type: string;
  entityId?: string;
  entityType?: string;
};

export async function sendNotification({
  userId,
  title,
  body,
  type,
  entityId,
  entityType,
}: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      entityId,
      entityType,
    },
  });
}
