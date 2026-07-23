import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateStatementDocumentNumber } from "@/lib/finance/document-number";

// SCR-015 دفعة 1: منطق المستخلص — كل الحسابات Decimal (لا float)
const D = Prisma.Decimal;

export class StatementError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "StatementError";
  }
}

export interface CreateStatementInput {
  contractId: string;
  progressPct: number;
  milestoneId?: string;
  notes?: string;
}

/**
 * ⚠️ حاجز أمان احترازي مؤقت — وليس الحل النهائي.
 * السلوك الصحيح للمستخلصات (هل كل مستخلص نسبة تراكمية تعوّض السابق، أم نسبة إضافية
 * فوق آخر مستخلص؟) قرار عمل غير محسوم بعد. حتى يُحسم: نمنع فقط الحالة المستحيلة
 * منطقيًا في أي تفسير — تجاوز إجمالي إنجاز العقد لـ 100%.
 * الدالة نقية (بلا DB) عمدًا حتى تُختبر مباشرة.
 */
export function assertProgressWithinContractCap(
  issuedPctSum: Prisma.Decimal,
  newProgressPct: Prisma.Decimal
) {
  if (issuedPctSum.add(newProgressPct).gt(100)) {
    throw new StatementError("errors.statementProgressExceeds100");
  }
}

/** ينشئ مستخلص DRAFT — القيمة تُحسب Decimal من snapshot العقد، وتُجمَّد نهائيًا عند الإصدار */
export async function createStatement(input: CreateStatementInput, actorId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    select: { id: true, totalValue: true },
  });
  if (!contract) throw new StatementError("errors.notFound");
  if (!contract.totalValue) throw new StatementError("errors.contractValueMissing");

  const progressPct = new D(String(input.progressPct));

  // مجموع نسب المستخلصات الصادرة فعلًا على نفس العقد.
  // PAID مشمولة: المدفوع صدر بالضرورة، واستبعاده يفتح الثغرة من جديد على عقد مكتمل.
  const issuedAgg = await prisma.progressStatement.aggregate({
    where: { contractId: input.contractId, status: { in: ["ISSUED", "PAID"] } },
    _sum: { progressPct: true },
  });
  const issuedPctSum = issuedAgg._sum.progressPct ?? new D(0);
  assertProgressWithinContractCap(issuedPctSum, progressPct);

  const statementValue = contract.totalValue.mul(progressPct).div(100);

  const statement = await prisma.progressStatement.create({
    data: {
      contractId: input.contractId,
      progressPct,
      statementValue,
      milestoneId: input.milestoneId ?? null,
      notes: input.notes ?? null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "STATEMENT_CREATED",
      entity: "ProgressStatement",
      entityId: statement.id,
      details: `مستخلص مسودة لعقد ${input.contractId} — نسبة إنجاز ${progressPct}% بقيمة ${statementValue}`,
    },
  });

  return statement;
}

/**
 * يُصدر مستخلص DRAFT: يولّد documentNumber (عبر الدالة المركزية — الصيغة ليست شأن هذا الملف)،
 * يعيد حساب القيمة من العقد لحظة الإصدار ويجمّدها (snapshot)، ويكتب issuedAt/issuedById.
 */
export async function issueStatement(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const statement = await tx.progressStatement.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            totalValue: true,
            quotation: {
              select: { quotationRequest: { select: { technicalRoute: true } } },
            },
          },
        },
      },
    });
    if (!statement) throw new StatementError("errors.notFound");
    if (statement.status !== "DRAFT") throw new StatementError("errors.statementNotDraft");
    if (!statement.contract.totalValue) throw new StatementError("errors.contractValueMissing");

    // BL-130 (Q2 — قرار صاحب العمل 2026-07-23): نفس حاجز السقف المطبَّق في createStatement
    // يُطبَّق أيضًا هنا عند الإصدار — كي لا تُفلت مسودة أُنشئت قبل هذا الحاجز من الحد وقت إصدارها.
    // المسودة نفسها DRAFT فلا تدخل مجموع ISSUED+PAID؛ نجمع الصادر + نسبتها ونتحقق ≤ 100 (نفس منطق createStatement، PAID مشمولة).
    // BL-130 (Q3، غير محسوم): "تراكمي أم إضافي" لا يزال فجوة معرفة — لا تغيير في معادلة statementValue أدناه.
    const issuedAgg = await tx.progressStatement.aggregate({
      where: { contractId: statement.contractId, status: { in: ["ISSUED", "PAID"] } },
      _sum: { progressPct: true },
    });
    const issuedPctSum = issuedAgg._sum.progressPct ?? new D(0);
    assertProgressWithinContractCap(issuedPctSum, statement.progressPct);

    const now = new Date();
    const route =
      statement.contract.quotation.quotationRequest?.technicalRoute ?? "PROJECTS";
    const documentNumber = await generateStatementDocumentNumber(
      tx,
      statement.contractId,
      route,
      now
    );

    // لحظة التجميد: القيمة من snapshot العقد الحالي — بعدها لا تُقرأ لايف أبدًا
    const frozenValue = statement.contract.totalValue
      .mul(statement.progressPct)
      .div(100);

    const issued = await tx.progressStatement.update({
      where: { id },
      data: {
        status: "ISSUED",
        documentNumber,
        statementValue: frozenValue,
        issuedAt: now,
        issuedById: actorId,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "STATEMENT_ISSUED",
        entity: "ProgressStatement",
        entityId: id,
        details: `صدر المستخلص ${documentNumber} — نسبة ${issued.progressPct}% بقيمة مجمّدة ${frozenValue}`,
      },
    });

    return issued;
  });
}
