import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCR-015: دالة ترقيم المستندات المالية — المكان الوحيد لصيغة الترقيم.
 *
 * ⚠️ الصيغة قابلة للتعديل هنا فقط (قرار يوسف): أي تغيير في شكل الرقم في UAT
 *    = تعديل هذا الملف وحده، بلا migration وبلا لمس منطق statements.ts
 *    (statements.ts يستدعي generateStatementDocumentNumber ولا يعرف الصيغة).
 *
 * الصيغة الحالية (مبدئية للـ UAT):
 * - مشروعات: EG{رقم المشروع مصفوف 4}/YY/M/D-{تسلسل المستخلص داخل العقد}
 *   · رقم المشروع ثابت للعقد (يتولّد أول إصدار: أعلى رقم مشروع حالي +1، ثم يثبت).
 *   · التاريخ = تاريخ الإصدار. اللاحقة -N تكسر تصادم اليوم الواحد.
 *   · مثال: EG0233/26/3/2-1 ثم EG0233/26/3/2-2
 * - سوشيال: C3_{تسلسل عام بعدد مستندات السوشيال} — مثال: C3_7306. بلا تاريخ.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Db = PrismaClient | Prisma.TransactionClient;

const PROJECTS_PREFIX = "EG";
const SOCIAL_PREFIX = "C3_";
const PROJECT_SEQ_PAD = 4;

/** يستخرج رقم المشروع من documentNumber بصيغة المشروعات (EG0233/... → 233) */
function parseProjectSeq(documentNumber: string): number | null {
  const m = documentNumber.match(/^EG(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
}

/** يستخرج التسلسل من documentNumber بصيغة السوشيال (C3_7306 → 7306) */
function parseSocialSeq(documentNumber: string): number | null {
  const m = documentNumber.match(/^C3_(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

async function resolveProjectSeq(db: Db, contractId: string): Promise<number> {
  // ثابت للعقد: رقم المشروع مشترك بين مستخلصات العقد وفواتيره —
  // أي مستند EG سابق لهذا العقد (مستخلص أو فاتورة) هو المرجع
  const existingStmt = await db.progressStatement.findFirst({
    where: { contractId, documentNumber: { startsWith: PROJECTS_PREFIX } },
    select: { documentNumber: true },
  });
  const existing =
    existingStmt ??
    (await db.invoice.findFirst({
      where: { contractId, documentNumber: { startsWith: PROJECTS_PREFIX } },
      select: { documentNumber: true },
    }));
  if (existing?.documentNumber) {
    const seq = parseProjectSeq(existing.documentNumber);
    if (seq !== null) return seq;
  }

  // أول إصدار لهذا العقد: أعلى رقم مشروع مستخدم في أي مستند EG (مستخلصات + فواتير) +1
  const [stmts, invs] = await Promise.all([
    db.progressStatement.findMany({
      where: { documentNumber: { startsWith: PROJECTS_PREFIX } },
      select: { documentNumber: true },
    }),
    db.invoice.findMany({
      where: { documentNumber: { startsWith: PROJECTS_PREFIX } },
      select: { documentNumber: true },
    }),
  ]);
  const max = [...stmts, ...invs].reduce((m, s) => {
    const seq = s.documentNumber ? parseProjectSeq(s.documentNumber) : null;
    return seq !== null && seq > m ? seq : m;
  }, 0);
  return max + 1;
}

/**
 * يولّد رقم مستخلص جديد. يُستدعى داخل transaction الإصدار.
 * route: مسار العقد (PROJECTS/SOCIAL_MEDIA) — يحدده المستدعي من quotationRequest.
 */
export async function generateStatementDocumentNumber(
  db: Db,
  contractId: string,
  route: "PROJECTS" | "SOCIAL_MEDIA",
  issueDate: Date
): Promise<string> {
  if (route === "SOCIAL_MEDIA") {
    const all = await db.progressStatement.findMany({
      where: { documentNumber: { startsWith: SOCIAL_PREFIX } },
      select: { documentNumber: true },
    });
    const max = all.reduce((m, s) => {
      const seq = s.documentNumber ? parseSocialSeq(s.documentNumber) : null;
      return seq !== null && seq > m ? seq : m;
    }, 0);
    return `${SOCIAL_PREFIX}${max + 1}`;
  }

  const projectSeq = await resolveProjectSeq(db, contractId);
  // تسلسل المستخلص داخل العقد: عدد المُصدَر سابقًا لهذا العقد +1
  const issuedCount = await db.progressStatement.count({
    where: { contractId, documentNumber: { not: null } },
  });
  const yy = String(issueDate.getFullYear() % 100).padStart(2, "0");
  const m = issueDate.getMonth() + 1;
  const d = issueDate.getDate();
  return `${PROJECTS_PREFIX}${String(projectSeq).padStart(PROJECT_SEQ_PAD, "0")}/${yy}/${m}/${d}-${issuedCount + 1}`;
}

/**
 * SCR-015 دفعة 2: رقم الفاتورة — نفس مبادئ المستخلص، والتمييز عن المستخلص = مقطع "INV".
 * - مشروعات (contractId إلزامي): EG{رقم المشروع الثابت للعقد}/YY/M/D-INV{تسلسل فواتير العقد}
 *   مثال: EG0001/26/7/11-INV1 — رقم المشروع مشترك مع مستخلصات نفس العقد.
 * - سوشيال (بلا عقد): C3_{تسلسل عام بعدد فواتير السوشيال} — فضاء ترقيم مستقل عن مستخلصات C3_.
 * الصيغة قابلة للتعديل هنا فقط.
 */
export async function generateInvoiceDocumentNumber(
  db: Db,
  contractId: string | null,
  route: "PROJECTS" | "SOCIAL_MEDIA",
  issueDate: Date
): Promise<string> {
  if (route === "SOCIAL_MEDIA" || !contractId) {
    const all = await db.invoice.findMany({
      where: { documentNumber: { startsWith: SOCIAL_PREFIX } },
      select: { documentNumber: true },
    });
    const max = all.reduce((m, s) => {
      const seq = s.documentNumber ? parseSocialSeq(s.documentNumber) : null;
      return seq !== null && seq > m ? seq : m;
    }, 0);
    return `${SOCIAL_PREFIX}${max + 1}`;
  }

  const projectSeq = await resolveProjectSeq(db, contractId);
  const issuedCount = await db.invoice.count({
    where: { contractId, documentNumber: { not: null } },
  });
  const yy = String(issueDate.getFullYear() % 100).padStart(2, "0");
  const m = issueDate.getMonth() + 1;
  const d = issueDate.getDate();
  return `${PROJECTS_PREFIX}${String(projectSeq).padStart(PROJECT_SEQ_PAD, "0")}/${yy}/${m}/${d}-INV${issuedCount + 1}`;
}
