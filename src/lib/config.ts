import { prisma } from "@/lib/prisma";
import type { SystemSettings } from "@prisma/client";

/** SCR-016: النطاق الوحيد المسموح لإيميلات المستخدمين الجدد (forward-looking — القدامى بند ترحيل منفصل). */
export const ALLOWED_EMAIL_DOMAIN = "@egyglass.net";

/**
 * نقطة القراءة الموحدة لإعدادات النظام (singleton).
 * refactor بحت: نفس سلوك findUnique تمامًا — بلا caching (كل الصفحات force-dynamic)
 * وبلا ابتلاع أخطاء (معالجة الخطأ تبقى مسؤولية المستدعي كما كانت).
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  return prisma.systemSettings.findUnique({ where: { id: "singleton" } });
}
