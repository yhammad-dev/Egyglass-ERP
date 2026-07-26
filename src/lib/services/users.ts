import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export class LastAdminGuardError extends Error {
  constructor() {
    super("errors.lastActiveAdmin");
    this.name = "LastAdminGuardError";
  }
}

// BL-136: كلمة المرور الحالية المُدخلة لا تطابق المخزّنة — يمنع تغيير كلمة
// المرور دون معرفة الحالية (حماية ضد اختطاف الجلسة).
export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("errors.incorrectPassword");
    this.name = "InvalidCurrentPasswordError";
  }
}

// BL-136: كلمة المرور الجديدة مطابقة للحالية — تغيير بلا معنى، يُرفض.
export class SamePasswordError extends Error {
  constructor() {
    super("errors.passwordSameAsOld");
    this.name = "SamePasswordError";
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
  deletedAt: Date | null;
  lockedUntil: Date | null;
  // TO-23-B: مسار تيم ليدر المكتب الفني. غير null لـTEC_LEAD فقط (SCR-021).
  leadRoute: string | null;
  // TO-25: تيم ليدر المهندس. غير null لـTECHNICAL_OFFICE فقط (SCR-022).
  teamLeadId: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  // TO-23-B: `null` صريحة لكل دور غير TEC_LEAD — الأكشن يفرضها، لا الواجهة.
  leadRoute?: string | null;
  // TO-25: `null` صريحة لكل دور غير TECHNICAL_OFFICE — نفس القاعدة.
  teamLeadId?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  department?: string;
  isActive?: boolean;
  // TO-23-B: `null` تُكتب فعلًا (الشرط أدناه `!== undefined`) ⇒ تغيير الدور
  // بعيدًا عن TEC_LEAD **يمسح** المسار ولا يتركه قيمة يتيمة.
  leadRoute?: string | null;
  // TO-25: نفس القاعدة — مغادرة TECHNICAL_OFFICE تمسح ارتباط التيم ليدر.
  teamLeadId?: string | null;
}

/**
 * TO-25 — هل المُشار إليه تيم ليدر فعلي ونشط؟
 * zod يتحقق من **شكل** المعرّف لا من واقعه: معرّف سليم شكليًا قد يشير لمندوب مبيعات
 * أو لمستخدم معطّل، فيُربط المهندس بتيم ليدر لا وجود له عمليًا ⇒ لا يظهر لأحد.
 * `null`/`undefined` مقبولة (مهندس بلا تيم ليدر حالة صالحة — SCR-022).
 */
export async function isValidTeamLead(teamLeadId: string | null | undefined): Promise<boolean> {
  if (!teamLeadId) return true;

  const lead = await prisma.user.findUnique({
    where: { id: teamLeadId },
    select: { role: true, isActive: true, deletedAt: true },
  });

  return Boolean(lead && lead.role === "TEC_LEAD" && lead.isActive && !lead.deletedAt);
}

export async function getUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
      deletedAt: true,
      lockedUntil: true,
      leadRoute: true,
      teamLeadId: true,
    },
  });
  return users;
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
      // TO-23-B: الأكشن يمرّرها null صراحةً لغير TEC_LEAD (فُرضت server-side).
      leadRoute: (input.leadRoute ?? null) as any,
      // TO-25: نفس القاعدة لغير TECHNICAL_OFFICE.
      teamLeadId: input.teamLeadId ?? null,
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
    // TO-23-B: `!== undefined` عمدًا لا `!= null` — الأكشن يرسل `null` صريحة عند
    // مغادرة دور TEC_LEAD، وهي القيمة التي **يجب** أن تُكتب لمسح المسار القديم.
    if (input.leadRoute !== undefined) data.leadRoute = input.leadRoute;
    // TO-25: نفس منطق `!== undefined` — null صريحة تمسح الارتباط عند تغيير الدور.
    if (input.teamLeadId !== undefined) data.teamLeadId = input.teamLeadId;
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

// SCR-016: فك قفل الحساب — تصفير حقول القفل الثلاثة، دون لمس isActive
export async function unlockUser(id: string, actorId: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "ACCOUNT_UNLOCKED",
      entity: "User",
      entityId: user.id,
      details: JSON.stringify({ email: user.email, unlockedBy: actorId }),
    },
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

// BL-136: قراءة الملف الشخصي للمستخدم الحالي — حقول آمنة فقط. لا تُحمّل
// passwordHash إلى صفحة تُعرَض للعميل (حارس ضد أي تسريب مستقبلي).
export async function getOwnProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true, department: true },
  });
}

// BL-136: تحديث ذاتي للملف الشخصي — الاسم فقط. لا يمسّ role/department/email/
// isActive إطلاقًا (تُدار إداريًا — L-06). المُعرّف يأتي من الجلسة لا من العميل،
// والفاعل = الهدف (بصمة self-service في السجل).
export async function updateOwnProfile(userId: string, input: { name: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "PROFILE_UPDATED",
      entity: "User",
      entityId: userId,
      details: JSON.stringify({ name: input.name }),
    },
  });

  return user;
}

// BL-136: تغيير المستخدم كلمة مروره بنفسه — يتحقق من الحالية قبل التعيين.
// لا يُسجَّل أي مادة كلمة مرور في ActivityLog.
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("errors.notFound");

  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) throw new InvalidCurrentPasswordError();

  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) throw new SamePasswordError();

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // التغيير + قيد التدقيق ذرّيان معًا — حدث أمني لا يُكتب بلا أثر.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: userId,
        details: JSON.stringify({ self: true }),
      },
    });
  });

  return { success: true as const };
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
