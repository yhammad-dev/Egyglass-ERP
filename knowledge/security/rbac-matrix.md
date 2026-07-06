---
artifact: RBAC Matrix
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Security Officer
source_of_truth: src/lib/rbac.ts + per-action requireRole(...) calls
---

# RBAC Matrix — EgyGlass ERP

Roles (from `roleEnum`, `users/actions.ts:14`): ADMIN, SALES_MANAGER, SALES_REP, INSPECTION_MANAGER, VIEWER.
> `REVIEW` appears in domain discussion but is **absent** from both `roleEnum` and `roleHierarchy` — see P3 RBAC-001.

Enforcement model: **exact-match allowlist** via `requireRole([...])` per action. The `hasRole`
hierarchy helper (`rbac.ts:11`) exists but is **not used** by any gate.

## Action → allowed roles (verified by `file:line`)

| Action | ADMIN | SALES_MANAGER | SALES_REP | INSPECTION_MANAGER | VIEWER | Evidence |
|---|:-:|:-:|:-:|:-:|:-:|---|
| Create customer | ✅ | ✅ | ✅¹ | — | — | `customers/actions.ts:35` |
| Update customer | ✅ | ✅ | ✅ | — | — | `customers/actions.ts:35` |
| Change stage | ✅ | ✅ | ✅² | — | — | `lib/actions/customers.ts:24` |
| Assign owner | ✅ | ✅ | — | — | — | `lib/actions/customers.ts:82` |
| Set coverage | ✅ | ✅ | — | — | — | `lib/actions/customers.ts:130` |
| Add interaction | ✅ | ✅ | ✅ | — | — | `lib/actions/customers.ts:177` |
| Create inspection | ✅ | — | — | ✅ | — | `inspections/actions.ts:21` |
| Schedule / measure / status | ✅ | — | — | ✅ | — | `inspections/actions.ts:21` |
| Create/price/update quotation | ✅ | ✅ | ✅ | — | — | `lib/pricing/actions.ts:10` |
| **Approve quotation (status=APPROVED)** | ✅ | ✅ | ⚠✅³ | — | — | `lib/pricing/actions.ts:347` |
| User CRUD / list | ✅ | — | — | — | — | `users/actions.ts:52,59,85,116` |
| Read notifications | own | own | own | own | own | `notifications/route.ts:12` (session-scoped) |

¹ SALES_REP create is forced to self-ownership (`ownerId = auth.userId`, `customers/actions.ts:51`).
² SALES_REP stage change requires `customer.ownerId === userId` (`lib/actions/customers.ts:43`).
³ **BIZ-001 (P1):** SALES_REP is inside `PRICING_ROLES` with no elevated check on the `APPROVED`
transition → can self-approve. Should be `["ADMIN","SALES_MANAGER"]` for approval.

## Data-scoping (row-level authorization)

| Resource | SALES_REP scope | Others | Evidence |
|---|---|---|---|
| Customer list | own `ownerId` only | all | `customers.ts:47` |
| Customer detail | `ownerId` OR `coveredById` | all | `customers.ts:250` |
| Quotation list | `createdById` OR customer `ownerId` | all | `quotations.ts:56` |
| Notifications | `userId` = self | self | `notifications/route.ts:18,49` |

## Gaps
- **BIZ-001 (P1):** approval segregation-of-duties.
- **RBAC-001 (P3):** `REVIEW` role not modeled; unused `hasRole` hierarchy.
- **VIEWER** has no explicit write path (correct — read-only), but no test proves it; add to REG-001.
