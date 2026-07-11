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

/** ينشئ مستخلص DRAFT — القيمة تُحسب Decimal من snapshot العقد، وتُجمَّد نهائيًا عند الإصدار */
export async function createStatement(input: CreateStatementInput, actorId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    select: { id: true, totalValue: true },
  });
  if (!contract) throw new StatementError("errors.notFound");
  if (!contract.totalValue) throw new StatementError("errors.contractValueMissing");

  const progressPct = new D(String(input.progressPct));
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
