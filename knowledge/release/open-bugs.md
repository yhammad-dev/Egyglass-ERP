---
artifact: Open Bugs
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Release Manager
---

# Open Bugs — EgyGlass ERP

> Only bugs with a recorded investigation artifact in `knowledge/bugs/` are listed.
> Modules without UAT discovery have **unknown** bug counts — absence here does NOT mean clean.

## Bug dashboard

| ID | Module | Severity | Status | Assigned | ETA | Blocking release | Investigated |
|---|---|---|---|---|---|---|---|
| CRM-001 | CRM (Customers) | High | Investigated — plan written, NOT fixed | Unassigned | ~60 min dev + 30 min QA | **YES** | 2026-07-06 |

### Counts

- **Critical:** 0 known
- **High:** 1 known (CRM-001)
- **Medium:** 0 known
- **Low:** 0 known
- **Total investigated:** 1
- **Total fixed:** 0

> The "0 known" counts for Critical/Medium/Low reflect **no investigation**, not a clean bill of health. 13 of 14 modules have no UAT discovery and no bug investigation pass.

## Bug detail

### CRM-001 — Data-loss on Edit from Customers List

| Field | Value |
|---|---|
| ID | CRM-001 |
| Severity | **High** |
| Type | Data-loss / silent corruption |
| Module | CRM (Customers) |
| Screen | Customers List — `/customers` |
| Status | Investigated; fix plan written (`knowledge/bugs/CRM-001-plan.md`); **code not changed** |
| Assigned agent | Unassigned (awaiting implementation approval) |
| ETA | ~60 min minimum fix / ~85 min with hardening (per plan) |
| Blocking release | **YES** — fails the "Database integrity" release gate |
| Reproduction | UAT Case 18 in `knowledge/uat/customers.md` |

**Root cause (summary):**
Two-layer defect.
1. `src/lib/services/customers.ts:48-62` `getCustomers` `select` omits `altPhone`, `address`, `notes`, `isRepeat`; `CustomerRow` (`:4-16`) correspondingly omits them.
2. `src/app/(dashboard)/customers/customers-client.tsx:150-164` `openEdit` `reset()`s the form with hard-coded `""` / `false` defaults because the fields are not on `CustomerRow`.
3. `src/app/(dashboard)/customers/actions.ts:22-33` `updateSchema` accepts `""` and `false` as valid; `src/lib/services/customers.ts:146-181` `updateCustomer` writes them; Prisma overwrites the DB.

**Effect:**
Every Edit+Save from `/customers` silently sets `altPhone = NULL`, `address = NULL`, `notes = NULL`, `isRepeat = false`. A success toast is shown. The `ActivityLog` records the wipe as a normal `CUSTOMER_UPDATED`. Previous values are unrecoverable without a DB backup.

**Files involved:**
- `src/app/(dashboard)/customers/customers-client.tsx`
- `src/app/(dashboard)/customers/actions.ts`
- `src/lib/services/customers.ts`
- `prisma/schema.prisma` (no change required)

**Proposed fix (per `CRM-001-plan.md`):**
1. Widen `CustomerRow` to include the four fields.
2. Extend `getCustomers` `select` and `toRow` to map them.
3. Fix `openEdit` to pre-populate from the row.
4. (Optional hardening) Build a dirty-fields payload in `onSubmit` so the server only writes what the user changed.

**Regression risk:** Medium — three adjacent dialogs (`assign-owner`, `set-coverage`, `stage-change`) share `updateCustomer` and must be re-tested.

**Verification:** 18 regression cases in `CRM-001-plan.md` §4. Central acceptance test: UAT Case 18 must PASS.

## Bugs presumed to exist but not yet investigated

These are NOT in the bug tracker because no discovery pass has run. They are flags for the next investigation wave:

| Suspected area | Why suspected | Suggested ID |
|---|---|---|
| Quotations math | Service file only 86 LOC for the most math-sensitive module; `quotation-math.md` compliance unverified | QUOT-001 (TBD) |
| Review module | 85 LOC client — likely stub; REVIEW role exists in schema but may have no functioning approval flow | REV-001 (TBD) |
| Manufacturing module | 138 LOC client — likely stub | MFG-001 (TBD) |
| Dashboard KPIs | 13 LOC page — likely empty; MVP-SPEC §2 item 2 unmet | DASH-001 (TBD) |
| Audit log completeness | No cross-module check that every write hits `ActivityLog` (MVP-SPEC §5 DoD) | AUDIT-001 (TBD) |
| RBAC matrix enforcement | Users module uninspected; cross-module RBAC unverified | SEC-001 (TBD) |
| Soft-delete consistency | `deletedAt` exists on Customer; need to verify filter is applied everywhere | DATA-001 (TBD) |

## Process note

The bug backlog is **not** "1 bug". It is **"1 known bug + an unknown number of bugs in 13 uninspected modules"**. The release decision must treat uninspected modules as carrying unknown risk, not zero risk.
