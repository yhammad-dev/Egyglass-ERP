import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export class LastAdminGuardError extends Error {
  constructor() {
    super("لا يمكن تنفيذ العملية — يجب أن يبقى مدير نظام واحد نشط على الأقل.");
    this.name = "LastAdminGuardError";
  }
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  department?: string;
  isActive?: boolean;
}

export async function getUsers(): Promise<UserRow[]> {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createUser(input: CreateUserInput, actorId: string) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role as any,
      department: input.department as any,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      details: JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      }),
    },
  });

  return user;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const willRemoveActiveAdmin =
      (input.role !== undefined && input.role !== "ADMIN") ||
      input.isActive === false;

    if (willRemoveActiveAdmin) {
      const activeAdminCount = await tx.user.count({
        where: { role: "ADMIN", isActive: true, deletedAt: null },
      });

      if (activeAdminCount === 1) {
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true, isActive: true, deletedAt: true },
        });

        if (target?.role === "ADMIN" && target?.isActive === true && target?.deletedAt === null) {
          await tx.activityLog.create({
            data: {
              userId: actorId,
              action: "LAST_ADMIN_GUARD_BLOCKED",
              entity: "User",
              entityId: id,
              details: JSON.stringify({ operation: "update", reason: "last active admin" }),
            },
          });
          throw new LastAdminGuardError();
        }
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    if (input.department !== undefined) data.department = input.department;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 12);
    }

    const user = await tx.user.update({ where: { id }, data });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "USER_UPDATED",
        entity: "User",
        entityId: user.id,
        details: JSON.stringify({ changes: Object.keys(input) }),
      },
    });

    return user;
  });
}

export async function deleteUser(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const activeAdminCount = await tx.user.count({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
    });

    if (activeAdminCount === 1) {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true, isActive: true, deletedAt: true },
      });

      if (target?.role === "ADMIN" && target?.isActive === true && target?.deletedAt === null) {
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: "LAST_ADMIN_GUARD_BLOCKED",
            entity: "User",
            entityId: id,
            details: JSON.stringify({ operation: "delete", reason: "last active admin" }),
          },
        });
        throw new LastAdminGuardError();
      }
    }

    const user = await tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "USER_DELETED",
        entity: "User",
        entityId: user.id,
        details: JSON.stringify({ name: user.name, email: user.email }),
      },
    });

    return user;
  });
}

export async function reactivateUser(id: string, actorId: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { deletedAt: null, isActive: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "USER_REACTIVATED",
      entity: "User",
      entityId: user.id,
    },
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
