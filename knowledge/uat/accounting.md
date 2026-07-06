---
module: Accounting
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 6
ready_for_uat: YES (with 1 business-logic caveat)
---

# Accounting Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/accounting` | Collection dashboard + payments | `accounting/page.tsx` → `accounting-client.tsx` (279 LOC) |

| Action | File | Roles |
|---|---|---|
| `getAccountingDashboard` | `lib/accounting/actions.ts:9` | ADMIN, ACCOUNTING |
| `getPayments` | `:47` | ADMIN, ACCOUNTING |
| `addPayment` | `:80` | ADMIN, ACCOUNTING |

- Page guard: `requireRole(["ADMIN","ACCOUNTING"])`.
- Data: only quotations with `reviewStatus = APPROVED` (`:15`). Per row computes totalContract, totalPaid (sum payments), remaining, and status PAID/PARTIAL/UNPAID (`:35`).
- Model: `Payment` (quotationId, amount, paidAt, method, notes, createdById).

## Screen 1 — Collection dashboard
- Table of approved quotations: Number, Customer, Total, Paid, Remaining, Status badge.
- Drill-in to payments per quotation (`getPayments`); **Add payment** form.
- **Add-payment validation (`addPaymentSchema`):** amount `positive()`, paidAt required, method required, notes optional.
- **Permissions:** ADMIN/ACCOUNTING only.

## Business-logic caveat (P2)
- **ACC-001 — No over-payment guard.** `addPayment` accepts any positive amount; a user can record
  payments exceeding `remaining` (remaining goes negative; status still resolves PAID). Confirm whether
  over-payment should be blocked or allowed (deposits/credits). Financial-controls decision for the business.
- Money handled via Prisma `Decimal` → `.toNumber()` for display (precision OK at store; verify rounding on sums).

## Missing features
- No edit/void payment (append-only) — likely acceptable for an audit trail, but no correction path.
- No currency indication / multi-currency.
- No export of collection report.

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| ACC-001 | P2 | Over-payment not prevented (see above). |
| ACC-OBS-2 | Low | Payment on a quotation later un-approved? reviewStatus change after payment not reconciled. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| ACC-01 | Login ACCOUNTING, open `/accounting` | Approved quotations with paid/remaining |
| ACC-02 | Login SALES_REP | Redirected to `/dashboard` |
| ACC-03 | Add payment < remaining | Remaining decreases; status→PARTIAL |
| ACC-04 | Add payment = remaining | Status→PAID; remaining 0 |
| ACC-05 | Add payment > remaining | **Currently allowed** (validates ACC-001) — confirm desired behaviour |
| ACC-06 | Add payment amount 0 / negative | Rejected (positive required) |
| ACC-07 | Add payment missing method | Validation error |
| ACC-08 | (Audit) after add | Payment CREATE logged in `/audit` |

**Ready for UAT? YES** — with ACC-001 flagged for a business decision.
