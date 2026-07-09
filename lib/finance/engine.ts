import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const D = Prisma.Decimal;

const HUNDRED = new D(100);

/**
 * SCR-014 payment engine — pure Decimal arithmetic, no DB, no floats.
 * All money math goes through Prisma.Decimal (decimal.js) to avoid
 * binary floating-point rounding errors.
 */

/** One planned milestone's nominal amount: percentage × totalValue ÷ 100, rounded to 2dp (half-up). */
export function calculateMilestoneAmount(percentage: Decimal, totalValue: Decimal): Decimal {
  return percentage.mul(totalValue).div(HUNDRED).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/**
 * Σ percentages must equal exactly 100.00 — compared in Decimal, never float.
 * Each percentage must be > 0 and carry at most 2 decimal places
 * (matches the Decimal(5,2) column — anything finer would be silently truncated).
 */
export function validateMilestonesSum(
  percentages: Decimal[]
): { ok: true } | { ok: false; error: "errors.invalidPercentage" | "errors.milestonesSumNot100" } {
  if (percentages.length === 0) return { ok: false, error: "errors.milestonesSumNot100" };

  for (const pct of percentages) {
    if (pct.lte(0) || pct.gt(HUNDRED) || pct.decimalPlaces() > 2) {
      return { ok: false, error: "errors.invalidPercentage" };
    }
  }

  const sum = percentages.reduce((acc, pct) => acc.add(pct), new D(0));
  if (!sum.eq(HUNDRED)) return { ok: false, error: "errors.milestonesSumNot100" };

  return { ok: true };
}

/**
 * ROUNDING POLICY (approved): "last milestone takes the remainder".
 *
 * Every milestone except the LAST is percentage × totalValue ÷ 100 rounded
 * to 2dp half-up. The LAST milestone is NOT computed from its percentage —
 * it is totalValue − Σ(previous amounts), so that:
 *
 *     Σ plannedAmount === Contract.totalValue   (exact to the piaster, always)
 *
 * The last milestone may therefore drift a piaster or two from its nominal
 * percentage on fractional splits (e.g. 33.33/33.33/33.34) — accepted:
 * "amounts sum to the contract value" outranks "each amount matches its
 * nominal percentage" in accounting terms.
 *
 * Call validateMilestonesSum() first — this function assumes a valid plan.
 */
export function allocateMilestoneAmounts(percentages: Decimal[], totalValue: Decimal): Decimal[] {
  if (percentages.length === 0) return [];

  const amounts: Decimal[] = [];
  let allocated = new D(0);

  for (let i = 0; i < percentages.length - 1; i++) {
    const amount = calculateMilestoneAmount(percentages[i], totalValue);
    amounts.push(amount);
    allocated = allocated.add(amount);
  }

  // Last milestone = remainder, NOT percentage × total (see policy above).
  amounts.push(totalValue.sub(allocated).toDecimalPlaces(2, D.ROUND_HALF_UP));

  return amounts;
}
