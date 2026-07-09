"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFinanceScope } from "./scope";
import { allocateMilestoneAmounts, validateMilestonesSum } from "./engine";

const D = Prisma.Decimal;

// R-03 alignment: same read/write split as lib/accounting/actions.ts.
const FINANCE_READ_ROLES = ["ADMIN", "ACCOUNTING", "PROJECTS", "TECHNICAL_OFFICE"];
const FINANCE_WRITE_ROLES = ["ADMIN", "ACCOUNTING"];

// ─── savePaymentPlan — replace the contract's planned milestones ─────────────

const savePlanSchema = z.object({
  contractId: z.string().min(1, "errors.invalidInput"),
  milestones: z
    .array(
      z.object({
        label: z.string().min(1, "errors.required"),
        // Percentages travel as strings to keep Decimal precision end-to-end
        // (a float here would defeat the whole Decimal pipeline).
        percentage: z.union([z.string(), z.number()]),
      })
    )
    .min(1, "errors.invalidInput"),
});

export async function savePaymentPlan(input: unknown) {
  try {
    const roleCheck = await requireRole(FINANCE_WRITE_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = savePlanSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const { contractId, milestones } = parsed.data;

    // String() before Decimal: never let a JS float touch the pipeline.
    let percentages: InstanceType<typeof D>[];
    try {
      percentages = milestones.map((m) => new D(String(m.percentage)));
    } catch {
      return { error: "errors.invalidPercentage" as const };
    }

    const validation = validateMilestonesSum(percentages);
    if (!validation.ok) return { error: validation.error };

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        totalValue: true,
        quotation: { select: { number: true } },
      },
    });
    if (!contract) return { error: "errors.notFound" as const };

    // Clear rejection: a plan cannot be computed without the frozen snapshot
    // value (pre-SCR-014 contracts have NULL until backfilled).
    if (contract.totalValue === null) {
      return { error: "errors.contractValueMissing" as const };
    }

    const amounts = allocateMilestoneAmounts(percentages, contract.totalValue);

    await prisma.$transaction([
      // Replace semantics: old plan rows go away; actual Payments survive
      // (Payment.milestoneId is onDelete: SetNull — the money record is kept,
      // only its link to a planned line is cleared).
      prisma.paymentMilestone.deleteMany({ where: { contractId } }),
      prisma.paymentMilestone.createMany({
        data: milestones.map((m, i) => ({
          contractId,
          label: m.label,
          percentage: percentages[i],
          plannedAmount: amounts[i],
          sortOrder: i + 1,
        })),
      }),
      prisma.activityLog.create({
        data: {
          userId: roleCheck.userId,
          action: "PAYMENT_PLAN_SAVED",
          entity: "Contract",
          entityId: contractId,
          details: `خطة دفعات لعقد عرض السعر ${contract.quotation.number}: ${milestones
            .map((m, i) => `${m.label} ${percentages[i].toFixed(2)}% = ${amounts[i].toFixed(2)}`)
            .join(" · ")}`,
        },
      }),
    ]);

    return {
      success: true as const,
      milestones: milestones.map((m, i) => ({
        label: m.label,
        percentage: percentages[i].toNumber(),
        plannedAmount: amounts[i].toNumber(),
        sortOrder: i + 1,
      })),
    };
  } catch (error) {
    console.error("[savePaymentPlan]", error);
    return { error: "errors.serverError" as const };
  }
}

// ─── getContractBalances — live balances, computed in Decimal, scoped ────────

export type ContractBalances = {
  contractId: string;
  totalValue: number;
  totalPaid: number;
  remaining: number;
  completionPct: number;
  milestones: Array<{
    id: string;
    label: string;
    percentage: number;
    plannedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    sortOrder: number;
  }>;
  unlinkedPaid: number; // payments not attached to any milestone
};

export async function getContractBalances(
  contractId: string
): Promise<ContractBalances | { error: string }> {
  try {
    const roleCheck = await requireRole(FINANCE_READ_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        quotationId: true,
        totalValue: true,
        paymentMilestones: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!contract) return { error: "errors.notFound" };

    // R-03 scope: Contract ↔ Quotation is 1:1, so scoping the contract's
    // quotation scopes the contract (same defense-in-depth pattern as
    // getContractByQuotation / getPayments).
    const scope = getFinanceScope(roleCheck.role, roleCheck.userId);
    if (scope.kind === "none") return { error: "errors.notAuthorized" };
    if (scope.kind === "filtered") {
      const inScope = await prisma.quotation.findFirst({
        where: { id: contract.quotationId, ...scope.quotationWhere },
        select: { id: true },
      });
      if (!inScope) return { error: "errors.notAuthorized" };
    }

    if (contract.totalValue === null) {
      return { error: "errors.contractValueMissing" };
    }

    // A contract's actual payments = the payments of its (unique) quotation.
    const payments = await prisma.payment.findMany({
      where: { quotationId: contract.quotationId },
      select: { amount: true, milestoneId: true },
    });

    // All aggregation in Decimal; .toNumber() only at the serialization boundary.
    const zero = new D(0);
    const totalPaid = payments.reduce((acc, p) => acc.add(p.amount), zero);
    const remaining = contract.totalValue.sub(totalPaid);
    const completionPct = contract.totalValue.gt(0)
      ? totalPaid.div(contract.totalValue).mul(100).toDecimalPlaces(2, D.ROUND_HALF_UP)
      : zero;

    const paidByMilestone = new Map<string, InstanceType<typeof D>>();
    let unlinkedPaid = zero;
    for (const p of payments) {
      if (p.milestoneId === null) {
        unlinkedPaid = unlinkedPaid.add(p.amount);
      } else {
        paidByMilestone.set(
          p.milestoneId,
          (paidByMilestone.get(p.milestoneId) ?? zero).add(p.amount)
        );
      }
    }

    return {
      contractId: contract.id,
      totalValue: contract.totalValue.toNumber(),
      totalPaid: totalPaid.toNumber(),
      remaining: remaining.toNumber(),
      completionPct: completionPct.toNumber(),
      milestones: contract.paymentMilestones.map((m) => {
        const paid = paidByMilestone.get(m.id) ?? zero;
        return {
          id: m.id,
          label: m.label,
          percentage: m.percentage.toNumber(),
          plannedAmount: m.plannedAmount.toNumber(),
          paidAmount: paid.toNumber(),
          remainingAmount: m.plannedAmount.sub(paid).toNumber(),
          sortOrder: m.sortOrder,
        };
      }),
      unlinkedPaid: unlinkedPaid.toNumber(),
    };
  } catch (error) {
    console.error("[getContractBalances]", error);
    return { error: "errors.serverError" };
  }
}
