---
artifact: Quotation Math Certification Report
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Math Certification Agent
spec: docs/quotation-math.md (baseline existed — STEP 1 generation not required)
implementation:
  - lib/pricing/calculateRecipe.ts
  - lib/pricing/actions.ts (calculateProductPricing, createQuotation, updateQuotation, requestFactorApproval)
  - prisma/seeds/shower-recipes.ts
  - prisma/schema.prisma (Quotation, SystemSettings, FactorMode, QtyRule)
code_changes: NONE
verdict: CONDITIONAL FAIL — recipe engine certified; quotation-totals layer diverges materially from spec
---

# Quotation Math Certification — EgyGlass ERP

> **Architectural note.** The system has **two math layers**:
> 1. **Recipe layer** (`calculateRecipe.ts`) — turns dimensions + materials + factor into a `grandTotal` (a per-product price preview).
> 2. **Quotation-totals layer** (`createQuotation`/`updateQuotation`) — turns client-supplied line items into subtotal/tax/total and persists them.
>
> `docs/quotation-math.md` specifies **layer 2** (discount → net → VAT → total, plus referral cashback).
> The requested certification items (area, QtyRule, FactorMode, grandTotal) live in **layer 1**.
> **The two layers are not connected**: the recipe `grandTotal` is a preview only; the persisted
> quotation trusts the client's `unitPrice`. This disconnect is the report's central finding.

## STEP 1 — Baseline spec
`docs/quotation-math.md` present (5,299 bytes, dated 2026-06-21). No extraction/generation performed.

## STEP 2 — Certification results

| # | Certified item | Layer | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Area = H × W | Recipe | ✅ **PASS** | `actions.ts:144` `area: height * width` |
| 2 | QtyRule resolution | Recipe | ✅ **PASS** | `calculateRecipe.ts:26-39` all 5 rules |
| 3 | FactorMode application | Recipe | ✅ **PASS** | `calculateRecipe.ts:60-73`; enum = 3/3 handled |
| 4 | grandTotal formula | Recipe | ✅ **PASS** (isolated) / ❌ **not persisted** | `calculateRecipe.ts:90`; not written by `createQuotation` |
| 5 | VAT 14% | Quotation | ⚠ **PARTIAL** | `actions.ts:193,196` correct on subtotal, but on subtotal **not net** |
| 6 | Factor < 1.5 approval gate | Quotation | ❌ **FAIL** | `actions.ts:11,151` hardcoded + client-trusted, bypassable |
| 7 | Rounding (Decimal precision) | Both | ❌ **FAIL** | all math in JS float via `.toNumber()`; no per-step 2dp |

### Item-by-item

**1. Area = H × W — PASS.** `dimensions.area = height * width` (`actions.ts:144`). Inputs validated `positive()` (`calculateProductPricingSchema:85-86`).
> Undocumented sibling: `length = height + width + width` (H + 2W) at `actions.ts:145`, consumed by `BY_LENGTH`. Not in spec — see Missing Rules MR-7.

**2. QtyRule resolution — PASS.** `resolveQty` matches all five:
| Rule | Formula | Default when null |
|---|---|---|
| FIXED | `defaultQty ?? 1` | 1 |
| BY_AREA | `(defaultQty ?? 0) × area` | 0 |
| BY_LENGTH | `(defaultQty ?? 0) × length` | 0 |
| BY_CONFIG | `(defaultQty ?? 0) × configCount` | 0 |
| MANUAL | `defaultQty ?? 0` | 0 |
Seed confirms real usage (`shower-recipes.ts`): glass = BY_AREA, sections = BY_LENGTH, handles/tension/elbow/silicon = FIXED. `configCount = configType.anglesCount ?? 0` (`actions.ts:146`).

**3. FactorMode application — PASS.**
- STANDARD → `qty × unitCost × globalFactor` → `subtotalBeforeFixed`
- FIXED_AFTER → `qty × unitCost` (factor NOT applied) → `fixedTotal`
- CUSTOM_FACTOR → `qty × unitCost × (customFactor ?? 1)` → `subtotalBeforeFixed`
`FactorMode` enum (`schema.prisma:569`) has exactly these 3 members — switch is exhaustive, no missing case. Inactive materials skipped (`calculateRecipe.ts:52`).

**4. grandTotal — PASS in isolation, but NOT persisted.** `grandTotal = subtotalBeforeFixed + fixedTotal` (`calculateRecipe.ts:90`) is arithmetically correct. **However** `createQuotation` (`actions.ts:195`) computes `subtotal = Σ(item.quantity × item.unitPrice)` from **client-supplied** items and never calls `calculateRecipe`. The certified recipe price is a UI preview; the server does not re-derive or verify it. → see Finding RD-2 (revenue risk).

**5. VAT — PARTIAL.** `vatPct = settings.vatPct ?? 14` (config-driven ✓); `taxAmount = subtotal × vat / 100`; `total = subtotal + taxAmount`. **But the spec computes VAT on `net` (after discount), not `subtotal`** (spec step 5). Because discount is unimplemented (discountPct always 0), the two are numerically identical *today*. The moment discount is applied, VAT will be computed on the wrong base unless this is fixed. `updateQuotation` correctly reuses the stored `taxPct` (`actions.ts:299`).

**6. Factor < 1.5 gate — FAIL (two defects).**
- (a) **Hardcoded threshold.** `LOW_FACTOR_THRESHOLD = 1.5` (`actions.ts:11`). Spec §17/§"config" mandates all thresholds live in SystemSettings. It does not.
- (b) **Server does not enforce the gate.** `calculateProductPricing` *returns* `requiresApproval:true` when `factor < 1.5` (`actions.ts:151`), but `createQuotation` only sets `PENDING_APPROVAL`/creates `QuotationApproval` **if the client passes `needsApproval:true`** (`actions.ts:215-216,238`). The server never re-computes the factor to force approval. A caller can compute at factor 1.2, then create with `needsApproval:false` → quotation is finalized with a below-floor margin and **no manager sign-off**.

**7. Rounding — FAIL.** Spec §step-7: "2 decimal places at each stored step," implemented "with Decimal." Actual: every computation uses `.toNumber()` (JS `number`/IEEE-754 float) — `calculateRecipe` lines, `subtotal`, `taxAmount`, `total`. No `Decimal` arithmetic and no explicit round-to-2dp between steps. Only the final Prisma `@db.Decimal(12,2)` store rounds. Multi-line recipes and % math can accumulate sub-cent float error before the single terminal rounding.

## STEP 3

### A. Formula Differences (spec vs implementation)

| ID | Spec says | Implementation does | Impact |
|---|---|---|---|
| FD-1 | subtotal → discountAmount → **net** → VAT(net) → total | discount skipped; VAT(subtotal); `discountPct`/`discountAmount` left at 0 | Examples 1,2,3,5 **cannot be reproduced**; only Ex4 (0 discount) matches |
| FD-2 | Discount ≤ base(18) applied by rep; > base ⇒ DiscountRequest (max 25) | **No discount logic at all**; no DiscountRequest wired to totals | Reps cannot grant approved discounts in-system |
| FD-3 | Approval gate = negotiated **discount > base%** | Approval gate = **pricing factor < 1.5** (a different concept, not in spec) | Two different governance models; neither fully matches the other doc |
| FD-4 | Referral cashback engine (tiers 5/4/3/2%, statuses) | `cashbackPct` field exists, default 0, **no logic** | Cashback tracked/paid manually |
| FD-5 | VAT default 14, all config from settings | VAT ✅ from settings; **factor 1.5 hardcoded** | Partial compliance |
| FD-6 | Decimal, 2dp each step | JS float, round only at DB store | Precision drift |
| FD-7 | `validUntil` = issue + validDays; early-invalidate on price change; auto-EXPIRED | `validUntil` set ✓; **no early-invalidation; EXPIRED auto-transition unverified** | Stale quotations may remain active |

### B. Missing Rules (in spec, absent in code)

| ID | Missing rule | Where it should live |
|---|---|---|
| MR-1 | Negotiated discount calc (discountPct → discountAmount → net) | `createQuotation`/`updateQuotation` |
| MR-2 | DiscountRequest workflow (base 18 / max 25, PENDING/APPROVED/ADJUSTED/REJECTED) | new action + gate |
| MR-3 | VAT applied on **net**, not subtotal | `createQuotation:196` |
| MR-4 | Referral cashback engine + CashbackTier + Referral statuses | new module (Stream B) |
| MR-5 | Config-driven factor-approval threshold (move 1.5 → SystemSettings) | `actions.ts:11,151` |
| MR-6 | Server-side enforcement of the approval gate (re-derive factor on save) | `createQuotation` |
| MR-7 | Documented `BY_LENGTH` length formula (currently H+2W, undocumented) | `docs/quotation-math.md` |
| MR-8 | `validUntil` early-invalidation on price change + EXPIRED auto-transition | job/check-on-view |
| MR-9 | Decimal arithmetic + per-step 2dp rounding | both layers |
| MR-10 | Persisted quotation totals derived from certified recipe (not client unitPrice) | `createQuotation` |

### C. Revenue Risk Assessment

| ID | Finding | Risk | Rationale |
|---|---|---|---|
| RR-1 | **Discount system unimplemented** (FD-1/2, MR-1/2/3) | 🔴 **HIGH** | Reps cannot apply approved discounts in-system → deals negotiated off-system / manual overrides → uncontrolled, unaudited pricing. And if bolted on later without moving VAT to net, tax base is wrong. |
| RR-2 | **Factor<1.5 gate bypassable** (item 6, MR-5/6) | 🔴 **HIGH** | Below-floor-margin quotations can be finalized with no manager approval → direct margin erosion; the low-factor control is advisory only. |
| RR-3 | **Client-supplied unitPrice trusted; recipe not re-derived** (item 4, RD-2, MR-10) | 🟠 **MED-HIGH** | Persisted price ≠ certified recipe price; an internal actor (PRICING_ROLES) can submit arbitrary unit prices. Mitigated only by internal-role gating, not by server math. |
| RR-4 | **Float rounding, no per-step 2dp** (item 7, MR-9) | 🟡 **MEDIUM** | Sub-cent drift accumulates on multi-line quotes; totals may differ from Decimal-exact spec by cents; compounds across many quotations. |
| RR-5 | **Referral cashback unimplemented** (FD-4, MR-4) | 🟡 **MEDIUM** | Cashback liabilities computed/paid manually → payout errors, disputes. Not part of quotation total, so no direct mispricing. |
| RR-6 | **No early-invalidation / EXPIRED automation** (FD-7, MR-8) | 🟡 **MEDIUM** | Customer may accept a stale quotation after a fuel/state price change → honoring below-cost prices. |
| RR-7 | **BY_LENGTH formula undocumented** (MR-7) | 🟢 **LOW** | H+2W is plausible (3 exposed sides) but unverified against Amr's rule; maintenance/regression risk. |

## Verdict

**CONDITIONAL FAIL.**
- ✅ **Recipe engine certified**: area (H×W), all 5 QtyRules, all 3 FactorModes, and `grandTotal = subtotalBeforeFixed + fixedTotal` are correct and match the seed's real usage.
- ❌ **Quotation-totals layer diverges materially** from `docs/quotation-math.md`: the discount and cashback models are **modeled in the schema but not implemented**, VAT is computed on subtotal rather than net, the approval gate is a different (bypassable, hardcoded) mechanism, and all arithmetic is float rather than Decimal.

**Only spec Example 4 (zero discount) is reproducible today**; Examples 1, 2, 3, and 5 cannot be produced because no discount path exists.

**Recommended remediation order** (no code changed in this pass, per mandate):
1. RR-2 — enforce the factor gate server-side + move threshold to SystemSettings (small, high-value).
2. RR-1/MR-1-3 — implement discount → net → VAT(net); reconcile with DiscountRequest.
3. RR-3/MR-10 — re-derive persisted totals from `calculateRecipe` (stop trusting client unitPrice).
4. RR-4/MR-9 — switch to Decimal arithmetic with per-step rounding; add spec Examples 1–5 as unit tests (feeds REG-001).
5. RR-5/RR-6 — cashback engine + validity automation (later streams).

## Stop
Certification report issued. No source code modified.
