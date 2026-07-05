import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "errors.notAuthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id as string, isRead: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notifications });
}

const patchSchema = z.object({
  id: z.string().min(1),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "errors.notAuthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: parsed.data.id },
  });

  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: parsed.data.id },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
