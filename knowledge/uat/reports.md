---
module: Reports (Executive Dashboard)
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 9
ready_for_uat: YES
note: "The requested 'Reports' module maps to the Executive KPI dashboard at /executive. There is no separate /reports route."
---

# Reports / Executive Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/executive` | Executive KPI + reports dashboard | `executive/page.tsx` (199 LOC, server component) |

| Action | File | Roles |
|---|---|---|
| `getDashboardKPIs` | `lib/executive/actions.ts` | ADMIN |

- Page guard: `requireRole(["ADMIN"])` → else redirect; also redirects if `getDashboardKPIs` returns null (`page.tsx:22,25`).
- **This is the real analytics surface** (the `/dashboard` landing is an empty stub — see `knowledge/uat/dashboard.md`).

## Screen — Executive dashboard (read-only)
- **6 KPI cards:** active customers, quotations this month, conversion rate (%), mfg in production, installations scheduled this week, approved revenue.
- **4 report tables:** recent quotations, recent manufacturing orders, new customers this week, top products.
- No inputs/mutations — pure read. Numbers formatted en-US; dates ar-EG.

## Missing features
- No date-range / period filter (fixed "this month" / "this week").
- No export (PDF/Excel) of reports.
- No charts (tables only) — MVP-SPEC may want a pipeline chart.
- ADMIN-only — SALES_MANAGER has no analytics view (confirm intended; managers often need pipeline KPIs).

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| RPT-OBS-1 | Low | Verify KPI math (conversion rate denominator, approved revenue = sum of APPROVED totals) against business definitions. |
| RPT-OBS-2 | Low | ADMIN-only analytics; SALES_MANAGER excluded. Confirm. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| RPT-01 | Login ADMIN, open `/executive` | 6 KPI cards + 4 tables render |
| RPT-02 | Login SALES_MANAGER, open `/executive` | Redirected to `/dashboard` |
| RPT-03 | Verify "quotations this month" vs raw data | Count matches |
| RPT-04 | Verify "approved revenue" vs sum of APPROVED quotation totals | Matches (RPT-OBS-1) |
| RPT-05 | Verify conversion rate definition | Matches business formula |
| RPT-06 | Empty datasets | Tables show "No results" |

**Ready for UAT? YES.** Validate KPI formulas (RPT-01→05) during execution.
