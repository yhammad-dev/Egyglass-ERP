# Quotation Engine — Worked Examples (test reference)

> **UPDATED to match Amr's official rules (effective 2026-05-24).** This supersedes the
> earlier 19%/5%-repeat model. Source of truth: AGENTS.md + SCHEMA-CHANGE-REQUESTS.md.
> Implement server-side with Decimal. Use these examples as unit tests.

## Two distinct concepts — do NOT conflate them

1. **Negotiated discount** — applied on the CURRENT quotation. Base cap is configurable
   (default 18%). Above the base requires a discount request; an approver (Amr or a
   delegate) may approve, reject, or set a different % (ADJUSTED), up to a configurable
   max (default 25%).
2. **Referral cashback** — a SEPARATE referral system. A current customer refers a NEW
   customer; the referrer earns cashback computed on the NEW customer's completed deal.
   It is NOT a discount on the current quotation. See "Referral cashback" below.

> ⚠ All numbers (18, 25, 14, validity days, cashback tiers) are CONFIGURABLE from
> SystemSettings / CashbackTier — never hardcode them. Defaults shown for illustration.

---

## Discount calculation order (on the current quotation)
1. `subtotal` = Σ (quantity × unit price)
2. `discountPct` = negotiated discount. ≤ base (default 18) ⇒ rep applies directly.
   > base ⇒ a DiscountRequest is created; status PENDING until decided.
3. `discountAmount` = subtotal × discountPct ÷ 100
4. `net` = subtotal − discountAmount
5. `taxAmount` = net × VAT ÷ 100   (VAT default 14, from settings)
6. `total` = net + taxAmount
7. Rounding: 2 decimal places at each stored step.

`validUntil` = issue date + (quotationValidDays, default 3) calendar days.
A general price change (fuel/state pricing) can invalidate an active quotation early.

---

## Example 1 — discount within base, no referral
- subtotal = 100,000.00
- discountPct = 10 (≤ 18, applied by rep) → discountAmount = 10,000.00 → net = 90,000.00
- taxAmount = 12,600.00
- **total = 102,600.00** ✔ status = SENT (no approval)

## Example 2 — discount AT base cap
- subtotal = 100,000.00
- discountPct = 18 (= base, no approval) → discountAmount = 18,000.00 → net = 82,000.00
- taxAmount = 11,480.00
- **total = 93,480.00** ✔ status = SENT

## Example 3 — discount above base ⇒ discount request
- subtotal = 50,000.00
- discountPct requested = 22 (> 18) ⇒ **DiscountRequest created, status = PENDING**
- approver decides:
  - APPROVED 22 → discountAmount = 11,000.00 → net = 39,000.00 → tax = 5,460.00 → **total = 44,460.00**
  - or ADJUSTED to 20 → discountAmount = 10,000.00 → net = 40,000.00 → tax = 5,600.00 → **total = 45,600.00**
  - or REJECTED → quotation stays at the pre-approval discount.

## Example 4 — no discount
- subtotal = 8,500.00, discount = 0
- net = 8,500.00 → tax = 1,190.00 → **total = 9,690.00**

## Example 5 — multiple items
- item 1: 12 × 750.00 = 9,000.00
- item 2: 3 × 1,250.00 = 3,750.00
- subtotal = 12,750.00, discountPct = 10 → discountAmount = 1,275.00
- net = 11,475.00 → tax = 1,606.50 → **total = 13,081.50**

---

## Referral cashback (SEPARATE system — not part of quotation totals)

A referral record links a referrer (current customer) to a new customer's completed deal.
Cashback is computed and DISBURSED only after the new customer's deal is fully executed
AND fully collected (no dues/disputes).

**Eligibility (all required):**
- New customer was contacted/contracted via the referrer (written referral).
- New customer is fully new (no prior dealing with the company).
- Work fully executed; new customer paid in full, no disputes.

**Value rule:** full % if the new contract value is NOT less than the referrer's contract
value. If the new value is less, cashback is computed on the LOWER (new actual) value only.

**Tiered % by referral order (independent counter PER referrer) — from CashbackTier:**
| Referred customer order | % (default) |
|---|---|
| 1st | 5 |
| 2nd | 4 |
| 3rd | 3 |
| 4th | 2 |
| 5th onward | 2 |

**Cashback statuses (Referral.status):** PENDING → ELIGIBLE → PAID (or CANCELLED on
contract cancellation / incomplete execution / dispute).

> 📌 Assumption flagged for review: referral order counted per-referrer (1st/2nd... that
> THIS referrer brought). Confirm before building Stream B's cashback logic.

### Referral example
- Referrer Ahmed's contract value = 100,000. He refers a new customer (his 1st referral, 5%).
- New customer's completed deal = 120,000 (≥ Ahmed's) → cashback = 5% × 100,000 = 5,000
  (full % applies; base is min(new, referrer) per the value rule — here capped at referrer logic;
   confirm exact base interpretation during Stream B build).
- If new customer's deal were 80,000 (< Ahmed's) → cashback = 5% × 80,000 = 4,000.

---

## Edge cases to test
- Fractional quantity (e.g. 2.5 m²) — confirm Decimal multiplication is exact.
- Discount above base with no approver decision yet → quotation not finalized.
- After `validUntil` passes → status auto-transitions to EXPIRED (job or check-on-view).
- Referral where new value < referrer value → cashback on the lower value.
- Referral cancelled after a dispute → status CANCELLED, no disbursement.
- All config numbers pulled from settings (changing base 18→20 must not require code change).
