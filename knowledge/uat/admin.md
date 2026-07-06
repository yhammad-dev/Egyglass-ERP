---
module: Admin (Pricing Catalog)
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 10
ready_for_uat: YES
---

# Admin / Pricing Catalog Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/admin/pricing` | Materials + pricing factors catalog | `admin/pricing/page.tsx` → `pricing-catalog-client.tsx` (304 LOC) |

| Action | File | Roles |
|---|---|---|
| `getMaterials` | `lib/admin/actions.ts:9` | ADMIN |
| `getPricingFactors` | `:33` | ADMIN |
| `updateMaterialCost` | `:59` | ADMIN |
| `toggleMaterialActive` | `:98` | ADMIN |
| `togglePricingFactorActive` | `:133` | ADMIN |

- **ADMIN-only** (`ADMIN_ROLES = ["ADMIN"]`), every action `requireRole` + `safeParse` + `activityLog`.
- Drives Quotations math: materials `cost` and `pricingFactor` feed `lib/pricing/calculateRecipe`. Misconfiguration → revenue leak, so this is a **high-business-impact** config surface.

## Screen — Pricing catalog
- **Materials table:** name, cost, active badge, actions. Edit-cost inline (`openEditCost` → `updateMaterialCost`); toggle active.
- **Pricing factors table:** label, value, active; toggle active.
- **Validation:** cost parsed `Number(costInput)`; invalid → `errors.invalidInput`; server `updateMaterialCostSchema`.
- **Permissions:** ADMIN only; others redirected.

## Cross-module linkage (must verify in UAT)
- **ADM-001 (P2/verify):** After changing a material cost here, a **new** quotation must price using the new cost. Confirm `calculateProductPricing` reads live catalog (no stale cache) and that **existing** quotations are not retroactively repriced.
- Factor de-activation should remove it from quotation factor options.

## Missing features
- No create/delete material or factor from UI (edit/toggle only) — catalog seeded via migration/seed. Confirm this is acceptable (new product lines need a path).
- No audit of *old→new* cost value shown in UI (it is in ActivityLog details).
- No confirm dialog on toggling a factor used by live quotations.

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| ADM-001 | P2 | Verify catalog→quotation propagation + no retroactive reprice (see above). |
| ADM-OBS-2 | Low | No create/delete catalog entries via UI. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| ADM-01 | Login ADMIN, open `/admin/pricing` | Materials + factors render |
| ADM-02 | Login SALES_MANAGER | Redirected to `/dashboard` |
| ADM-03 | Edit a material cost to a valid number | Persists; audit logs old→new |
| ADM-04 | Edit cost to non-numeric | Inline `invalidInput` error |
| ADM-05 | Toggle material inactive | Badge updates; excluded from new quotations |
| ADM-06 | Toggle a pricing factor inactive | Removed from factor options in new quotation |
| ADM-07 | Change cost, create NEW quotation | New quotation uses updated cost (validates ADM-001) |
| ADM-08 | Confirm existing quotation total unchanged after ADM-07 | No retroactive reprice |

**Ready for UAT? YES.** ADM-001 propagation is the key thing to prove during execution.
