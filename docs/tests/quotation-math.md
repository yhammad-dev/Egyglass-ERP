# Quotation Engine — Worked Examples (test reference)

> This is the required behavior of the quotation engine. Implement it server-side with
> Decimal. Use these examples as unit tests to confirm the numbers are correct.

## Calculation order (fixed)
1. `subtotal` = sum of line items = Σ (quantity × unit price)
2. `discountPct` = standard discount (0–19). Any value > 19 ⇒ `needsApproval = true`,
   status `PENDING_APPROVAL`.
3. `cashbackPct` = 5 automatically if `customer.isRepeat = true`, else 0.
4. `totalDiscountPct` = discountPct + cashbackPct (both applied additively to subtotal).
5. `discountAmount` = subtotal × totalDiscountPct ÷ 100
6. `net` = subtotal − discountAmount
7. `taxAmount` = net × 14 ÷ 100  (VAT)
8. `total` = net + taxAmount
9. Rounding: 2 decimal places at each stored step.

`validUntil` = issue date + 3 calendar days.

---

## Example 1 — standard discount, non-repeat customer
- subtotal = 100,000.00
- discountPct = 10, cashbackPct = 0
- discountAmount = 10,000.00 → net = 90,000.00
- taxAmount = 12,600.00
- **total = 102,600.00** ✔ status = SENT (no approval)

## Example 2 — max standard discount + cashback (repeat customer)
- subtotal = 100,000.00
- discountPct = 19, cashbackPct = 5 → totalDiscountPct = 24
- discountAmount = 24,000.00 → net = 76,000.00
- taxAmount = 10,640.00
- **total = 86,640.00** ✔ status = SENT (19 is the standard cap, no approval)

## Example 3 — discount over the cap ⇒ approval
- subtotal = 50,000.00
- discountPct = 25 ⇒ **needsApproval = true**, status = **PENDING_APPROVAL**
- (quotation is not approved until SALES_MANAGER/ADMIN approves)
- after approval: discountAmount = 12,500.00 → net = 37,500.00 → tax = 5,250.00 → **total = 42,750.00**

## Example 4 — no discount
- subtotal = 8,500.00, discount = 0, cashback = 0
- net = 8,500.00 → tax = 1,190.00 → **total = 9,690.00**

## Example 5 — multiple items
- item 1: 12 × 750.00 = 9,000.00
- item 2: 3 × 1,250.00 = 3,750.00
- subtotal = 12,750.00, discount 5%, repeat customer (cashback 5) → totalDiscount 10%
- discountAmount = 1,275.00 → net = 11,475.00 → tax = 1,606.50 → **total = 13,081.50**

---

## Edge cases to test
- Discount 0 with fractional quantity (e.g. 2.5 m²) — confirm Decimal multiplication is exact.
- Repeat customer with 0 discount → the 5% cashback applies on its own.
- Over 19% with no cashback → approval required.
- After `validUntil` passes → status auto-transitions to EXPIRED (job or check-on-view).
