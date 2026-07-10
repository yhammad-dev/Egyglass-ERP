import { prisma } from "@/lib/prisma";
import type { SystemSettings } from "@prisma/client";

/**
 * نقطة القراءة الموحدة لإعدادات النظام (singleton).
 * refactor بحت: نفس سلوك findUnique تمامًا — بلا caching (كل الصفحات force-dynamic)
 * وبلا ابتلاع أخطاء (معالجة الخطأ تبقى مسؤولية المستدعي كما كانت).
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  return prisma.systemSettings.findUnique({ where: { id: "singleton" } });
}
