---
artifact: Server Action Audit
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Security Officer
---

# Server Action Audit — EgyGlass ERP

Every `"use server"` module inspected. Columns: **Auth** = `requireRole`/`auth()` present;
**Zod** = `safeParse` on input; **Audit** = writes `ActivityLog`; **Scope** = row-level owner check.

## `src/app/(dashboard)/customers/actions.ts`
| Action | Auth | Zod | Audit | Scope | Notes |
|---|:-:|:-:|:-:|:-:|---|
| createCustomerAction | ✅ | ✅ | via service | ✅ (rep→self) | `:37` |
| updateCustomerAction | ✅ | ✅ | via service | rep drops ownerId | `:62` |

## `src/lib/actions/customers.ts`
| Action | Auth | Zod | Audit | Scope | Notes |
|---|:-:|:-:|:-:|:-:|---|
| changeCustomerStage | ✅ | ✅ | ✅ | ✅ rep owns | `:21` |
| assignCustomer | ✅ (ADMIN/MGR) | ✅ | ✅ | n/a | `:79` |
| setCustomerCoverage | ✅ (ADMIN/MGR) | ✅ | ✅ | n/a | `:127` |
| addInteraction | ✅ | ✅ | ✅ | — | `:171` |

## `src/app/(dashboard)/inspections/actions.ts`
| Action | Auth | Zod | Audit | Notes |
|---|:-:|:-:|:-:|---|
| scheduleInspectionAction | ✅ | ✅ | via service | `:29` |
| createInspectionAction | ✅ | ✅ | via service | `:55` |
| getInspectionDetail | ✅ | — (id read) | read | `:76` |
| addMeasurements | ✅ | ✅ | ✅ | `:138` |
| addInspectionAttachment | ✅ | ✅ | ✅ | **UPL-001**: path unvalidated `:172` |
| updateInspectionStatus | ✅ | ✅ | ✅ | `:232` |

## `src/app/(dashboard)/users/actions.ts`
| Action | Auth (ADMIN) | Zod | Notes |
|---|:-:|:-:|---|
| listUsersAction | ✅ | — | `:51` |
| createUserAction | ✅ | ✅ | `:58` |
| updateUserAction | ✅ | ✅ | last-admin guard `:99` |
| deleteUserAction | ✅ | id | soft-delete + guard `:115` |
| reactivateUserAction | ✅ | id | `:130` |

## `lib/pricing/actions.ts`
| Action | Auth | Zod | Audit | Notes |
|---|:-:|:-:|:-:|---|
| getProductRecipes | ❌ | — | — | **AUTHZ-002 (P3)** ungated read `:13` |
| getPricingFactors | ❌ | — | — | **AUTHZ-002** `:25` |
| getConfigTypes | ❌ | — | — | **AUTHZ-002** `:37` |
| getConfigTypeOptions | ❌ | — | — | **AUTHZ-002** `:49` |
| getProductTypes | ❌ | — | — | **AUTHZ-002** `:71` |
| calculateProductPricing | ✅ | ✅ | — | `:91` |
| createQuotation | ✅ | ✅ | ⚠ verify | `:176` — confirm ActivityLog (AUDIT-001) |
| updateQuotation | ✅ | ✅ | ⚠ verify | `:281` |
| updateQuotationStatus | ✅ | ✅ | ✅ | **BIZ-001 (P1)** rep can APPROVE `:347` |
| requestFactorApproval | ✅ | ✅ | — | `:389` |

## `src/lib/actions/auth.ts`
| Action | Notes |
|---|---|
| signOutAction | delegates to Auth.js `signOut` — safe `:5` |

## Summary
- **Mutations:** 100% carry `requireRole` + `safeParse`. ✅
- **Open items:** BIZ-001 (P1 approval scope), AUTHZ-002 (P3 ungated pricing reads), AUDIT-001 (P2 confirm quotation-create audit), UPL-001 (P2 attachment path validation).
