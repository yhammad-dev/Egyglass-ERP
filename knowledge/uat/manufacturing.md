---
module: Manufacturing
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
stack: Next.js App Router + Auth.js v5 + Prisma + PostgreSQL + shadcn/ui + next-intl (ar primary)
priority: 1
ready_for_uat: YES
---

# Manufacturing Module — UAT Discovery

> **Correction to prior release-dashboard:** Manufacturing was previously flagged as a "138 LOC stub".
> It is in fact a **functional order-status board**. Evidence: `manufacturing-client.tsx` (151 LOC) +
> `lib/manufacturing/actions.ts`.

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/manufacturing` | Manufacturing orders board | `manufacturing/page.tsx` → `manufacturing-client.tsx` |

| Action | File | Roles |
|---|---|---|
| `getMfgOrders` | `lib/manufacturing/actions.ts:12` | ADMIN, PROCUREMENT |
| `updateMfgStatus` | `lib/manufacturing/actions.ts:66` | ADMIN, PROCUREMENT |
| `createManufacturingOrder` | `lib/manufacturing/actions.ts:45` | internal (called by Review approve) |

- Page guard: `requireRole(["ADMIN","PROCUREMENT"])` → else `redirect("/dashboard")` (`page.tsx:7`).
- Models: `ManufacturingOrder` (quotationId, number, status, expectedAt). Status enum: PENDING → IN_PRODUCTION → READY → DELIVERED.
- Auto-created when a quotation is **approved in the Review module** (`review/actions.ts:126`).

## Screen 1 — Manufacturing Orders Board
- **Components:** H1 title; table (Number, Customer, Status, Expected date).
- **Controls:** inline status `Select` per row (4 options); Badge reflecting status; row disabled while updating.
- **Forms/Validation:** no free-text form; status change validated server-side (`safeParse` of `{id,status}`); no-op guarded client-side (`status===order.status` returns).
- **Permissions:** ADMIN & PROCUREMENT only. All other roles redirected. Server action re-checks role (defense in depth).
- **Expected result:** changing status persists, shows success toast `manufacturing.statusUpdated`, updates badge; audit entry written (verify — see Known issues).

## Missing features
- No filter/search/pagination (fine for low volume; revisit at scale).
- No manual "create order" UI — orders arise only from Review approval (by design).
- No status-transition guard (any status → any status; e.g. DELIVERED → PENDING allowed). Business may want a forward-only workflow.

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| MFG-OBS-1 | Low | `updateMfgStatus` audit-log write not confirmed in this pass — verify an `ActivityLog` row is created on status change. |
| MFG-OBS-2 | Low | Free status transitions (no state machine). Confirm acceptable with ops. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| MFG-01 | Login as ADMIN, open `/manufacturing` | Board loads with approved-quotation orders |
| MFG-02 | Login as PROCUREMENT, open `/manufacturing` | Access granted, board loads |
| MFG-03 | Login as SALES_REP, open `/manufacturing` | Redirected to `/dashboard` |
| MFG-04 | Change a row status PENDING→IN_PRODUCTION | Success toast; badge updates; persists on refresh |
| MFG-05 | Re-select the same status | No network call, no error |
| MFG-06 | Approve a quotation in Review, return here | New PENDING order appears for that quotation |
| MFG-07 | Empty state (no orders) | "No results" row shown |
| MFG-08 | (Audit) After MFG-04, open `/audit` | Status-change activity is recorded (validates MFG-OBS-1) |

**Ready for UAT? YES.** Core flow is functional and gated. Address MFG-OBS-1 verification during execution.
