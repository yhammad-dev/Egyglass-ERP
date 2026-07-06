---
module: Review (Quotation Approval)
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 2
ready_for_uat: YES
---

# Review Module — UAT Discovery

> **Correction to prior release-dashboard:** Review was flagged as an "85 LOC stub". It is a
> **functional approval workflow** and the segregation-of-duties control gate for the whole
> quotation→manufacturing pipeline. Evidence: `review-client.tsx` (list) + `[id]/review-detail.tsx`
> (approve/reject) + `lib/review/actions.ts`.

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/review` | Pending-review quotations list | `review/page.tsx` → `review-client.tsx` |
| `/review/[id]` | Quotation review detail (approve/reject) | `[id]/page.tsx` → `review-detail.tsx` |

| Action | File | Roles |
|---|---|---|
| `getPendingReviewQuotations` | `lib/review/actions.ts:11` | ADMIN, REVIEW |
| `getReviewQuotationDetail` | `:39` | ADMIN, REVIEW |
| `approveQuotationAction` | `:85` | ADMIN, REVIEW |
| `rejectQuotationAction` | `:158` | ADMIN, REVIEW |

- Page guard: `requireRole(["ADMIN","REVIEW"])` (`page.tsx:7`).
- Model: `Quotation.reviewStatus` (PENDING_REVIEW | APPROVED | RETURNED), `reviewNote`, `reviewedAt`, `reviewedById`.
- **On approve:** sets reviewStatus=APPROVED, notifies creator, **creates a ManufacturingOrder**, notifies PROCUREMENT users (`:107-144`). This is the pipeline handoff.
- **On reject:** sets reviewStatus=RETURNED, stores `reviewNote` reason, logs REJECT.

## Screen 1 — Pending Review list
- Table: Number, Customer, Total, Created-by, Date. Rows clickable → `/review/[id]`.
- Only `reviewStatus = PENDING_REVIEW` quotations listed.
- Permission: ADMIN/REVIEW only; others redirected.

## Screen 2 — Review detail
- Header (number, date, customer, creator) + status Badge.
- Line-items table + subtotal / VAT / total summary.
- **When PENDING_REVIEW:** reason `Textarea` + **Approve** and **Reject** buttons.
- **Validation:** Reject requires non-empty reason (`rejectSchema.reason.min(1)` + client guard → `errors.rejectReasonRequired`). Approve needs only id.
- **Expected:** Approve → toast `review.approved`, status→APPROVED, mfg order created; Reject → toast `review.rejected`, status→RETURNED, note shown red.

## Segregation-of-duties note (links [[security-review]])
This gated `reviewStatus` flow — **not** the SALES_REP-writable `status` field — is what triggers
manufacturing. This **mitigates P1 BIZ-001**: a rep marking `status=APPROVED` does not create a
manufacturing order. BIZ-001 remains a labelling/pipeline-consistency issue, not a manufacturing-gate bypass.

## Missing features
- No filter/search on the pending list.
- No "history" view of already-approved/returned quotations from within Review (only PENDING shown).
- Approver can approve a quotation they created (no "not your own" guard) — confirm policy.

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| REV-OBS-1 | Low | Self-approval by the same user if they hold REVIEW+creator — confirm policy. |
| REV-OBS-2 | Low | Idempotency: approving an already-APPROVED quotation would re-create mfg order? `createManufacturingOrder` — verify dedupe. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| REV-01 | Login REVIEW, open `/review` | Pending quotations listed |
| REV-02 | Login SALES_REP, open `/review` | Redirected to `/dashboard` |
| REV-03 | Open a pending quotation | Items + totals render; Approve/Reject shown |
| REV-04 | Click Reject with empty reason | Inline error `rejectReasonRequired`; no state change |
| REV-05 | Reject with reason | Status→RETURNED; note stored; toast |
| REV-06 | Approve a quotation | Status→APPROVED; toast; mfg order appears in `/manufacturing` |
| REV-07 | Verify creator notification after approve | Creator receives QUOTATION_APPROVED notification |
| REV-08 | Verify PROCUREMENT notification after approve | PROCUREMENT users receive MFG_ORDER_CREATED |
| REV-09 | Re-open an APPROVED quotation | Approve/Reject hidden (not pending) |
| REV-10 | (Audit) After approve/reject | APPROVE/REJECT actions logged in `/audit` |

**Ready for UAT? YES.** Confirm REV-OBS-2 idempotency during execution.
