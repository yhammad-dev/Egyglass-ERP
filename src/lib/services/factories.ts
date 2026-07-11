import { prisma } from "@/lib/prisma";

// دفعة أ: منطق المصانع الصرف — الحراسة في actions (النمط المثبت)
export class FactoryError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "FactoryError";
  }
}

export interface FactoryInput {
  name: string;
  code: string;
  contact?: string;
  notes?: string;
}

export async function listFactories() {
  return prisma.factory.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createFactory(input: FactoryInput, actorId: string) {
  const existing = await prisma.factory.findUnique({ where: { code: input.code } });
  if (existing) throw new FactoryError("errors.factoryCodeTaken");

  const factory = await prisma.factory.create({
    data: {
      name: input.name,
      code: input.code,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "FACTORY_CREATED",
      entity: "Factory",
      entityId: factory.id,
      details: `أُنشئ مصنع ${factory.name} بكود ${factory.code}`,
    },
  });

  return factory;
}

export async function updateFactory(
  id: string,
  input: Partial<FactoryInput>,
  actorId: string
) {
  if (input.code) {
    const existing = await prisma.factory.findUnique({ where: { code: input.code } });
    if (existing && existing.id !== id) throw new FactoryError("errors.factoryCodeTaken");
  }

  const factory = await prisma.factory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.contact !== undefined ? { contact: input.contact || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "FACTORY_UPDATED",
      entity: "Factory",
      entityId: id,
      details: `تحديث المصنع ${factory.code}: ${Object.keys(input).join(", ")}`,
    },
  });

  return factory;
}

/** تعطيل لا حذف — المصنع قد يكون مرتبطًا بأوامر (سياسة deactivate-not-delete) */
export async function setFactoryActive(id: string, isActive: boolean, actorId: string) {
  const factory = await prisma.factory.update({ where: { id }, data: { isActive } });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: isActive ? "FACTORY_REACTIVATED" : "FACTORY_DEACTIVATED",
      entity: "Factory",
      entityId: id,
      details: `${isActive ? "تفعيل" : "تعطيل"} المصنع ${factory.code}`,
    },
  });

  return factory;
}
