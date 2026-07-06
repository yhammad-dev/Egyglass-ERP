---
module: Dashboard (landing)
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 3
ready_for_uat: NO
---

# Dashboard Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/dashboard` | Post-login landing | `dashboard/page.tsx` (15 LOC) |

## Finding: CONFIRMED STUB
`dashboard/page.tsx` renders only a title and a greeting: `مرحباً {session.user.name}`. No KPIs,
no charts, no data. It is the first screen after login (all authenticated users land here) and is
also the redirect target for role-denied pages — so **every user sees an empty screen first**.

- Auth: any authenticated session (gated by middleware after SEC-002). No role restriction.
- **The real KPI/analytics content already exists at `/executive`** (ADMIN-only) — see `knowledge/uat/reports.md`.

## Missing features (all of MVP-SPEC §2 item 2)
- KPI tiles (pipeline value, quotations this month, conversion rate…).
- Role-aware content (a SALES_REP and an ACCOUNTING user see the same blank page).
- Pipeline chart / rep performance.
- Quick links / recent activity.

## Known issues
| ID | Sev | Note |
|---|---|---|
| DASH-001 | Medium | Dashboard is empty; poor first impression in a customer demo. Recommend either (a) surface a role-aware subset of `/executive` KPIs here, or (b) redirect each role to its primary module. |

## UAT Test Cases
| # | Steps | Expected (current) | Desired |
|---|---|---|---|
| DASH-01 | Login as any role | Greeting only | Role-relevant KPIs/links |
| DASH-02 | Role denied on a module | Redirected to empty `/dashboard` | Redirected to a useful landing |

**Ready for UAT? NO.** Cosmetic/again-non-blocking for back-office flows, but **blocks a credible
customer demo**. Escalation to Youssif: build a minimal KPI landing (reuse `/executive` widgets) or
redirect-by-role before customer UAT. Not a code change under the current mandate.
