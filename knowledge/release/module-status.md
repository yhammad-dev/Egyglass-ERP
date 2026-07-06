---
artifact: Module Status
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Release Manager
---

# Module Status — EgyGlass ERP

> Per-module detail. "Evidence" column cites the file or observation that supports the status.
> "Not inspected" = no UAT discovery pass has been run for this module.

## Legend

- **Completion %** — rough heuristic from client-component LOC vs. mature-module baseline (CRM ~900 LOC ≈ 90%).
- **UAT %** — percentage of generated UAT test cases executed and passed.
- **Status** — NOT STARTED / IN PROGRESS / READY FOR UAT / READY FOR PRODUCTION / BLOCKED.

## Status table

### 1. CRM (Customers)

| Field | Value |
|---|---|
| Route group | `/customers`, `/customers/[id]` |
| Owner stream | A |
| Client LOC | 914 (customers-client 609 + customer-profile-client 305) |
| Service LOC | 317 (`src/lib/services/customers.ts`) |
| UAT discovery | DONE — `knowledge/uat/customers.md` (48 test cases, 2026-07-06) |
| Completion % | ~90% |
| UAT % | 0% (cases generated, none executed) |
| Critical bugs | 0 |
| High bugs | 1 — CRM-001 (data-loss on Edit) |
| Medium bugs | 0 cataloged |
| Low bugs | 0 cataloged |
| Missing features | Per UAT report: no export, no import, no bulk actions, raw enum labels in profile tabs, no success toasts on Stage/Owner/Coverage dialogs |
| Missing documentation | Module-level runbook not present |
| Technical debt | `CustomerRow` type narrows the Customer model; Edit dialog reuses list row as form source-of-truth (root cause of CRM-001) |
| Business risk | High if shipped unfixed — every edit silently wipes altPhone/address/notes/isRepeat |
| Recommendation | Fix CRM-001, then run UAT Case 18 + 47 siblings; module can be READY FOR UAT in ~1 day |
| Status | **READY FOR UAT (with caveats)** — gated on CRM-001 fix |

### 2. Quotations

| Field | Value |
|---|---|
| Route group | `/quotations`, `/quotations/new`, `/quotations/new/[productType]`, `/quotations/[id]`, `/quotations/[id]/edit` |
| Owner stream | B |
| Client LOC | ~850 (quotations-client 229 + new 29 + productType 46 + [id] 50 + edit 46; plus uncounted `_components`) |
| Service LOC | **86** (`src/lib/services/quotations.ts`) — suspiciously thin for the most math-sensitive module |
| UAT discovery | NOT STARTED |
| Completion % | ~70% UI / ~30% service |
| UAT % | 0% |
| Open bugs | Unknown (no investigation) |
| Missing features | Unknown — needs UAT discovery against `docs/quotation-math.md` |
| Missing documentation | No UAT artifact |
| Technical debt | Service file size suggests business logic may live in client or actions; math-location audit required |
| Business risk | **Very high** — financial math errors directly affect revenue; `docs/quotation-math.md` compliance unverified |
| Recommendation | UAT discovery urgently, with focus on discount/cashback/VAT math, approval flow, 3-day validity |
| Status | **IN PROGRESS** |

### 3. Inspections

| Field | Value |
|---|---|
| Route group | `/inspections`, `/inspections/[id]` |
| Owner stream | C |
| Client LOC | 945 (inspections-client 645 + inspection-detail-client 300) |
| Service LOC | 219 |
| UAT discovery | NOT STARTED |
| Completion % | ~80% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown — needs UAT discovery for SLA math, photo upload, scheduling |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Medium — SLA miscalculation affects operations but not revenue directly |
| Recommendation | UAT discovery next after Quotations |
| Status | **IN PROGRESS** |

### 4. Manufacturing

| Field | Value |
|---|---|
| Route group | `/manufacturing` |
| Owner stream | (not in original stream map) |
| Client LOC | **138** (`manufacturing-client.tsx`) — stub-sized |
| Service LOC | 0 (no `src/lib/services/manufacturing.ts`) |
| UAT discovery | NOT STARTED |
| Completion % | ~20% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Likely most of the module |
| Missing documentation | No UAT artifact, no module spec beyond MVP-SPEC |
| Technical debt | Likely a placeholder |
| Business risk | Low if MVP scope excludes it; High if it is in scope |
| Recommendation | Confirm with business whether Manufacturing is in MVP scope. If yes, build it. If no, hide the route. |
| Status | **IN PROGRESS** (or NOT STARTED if treated as placeholder) |

### 5. Installations

| Field | Value |
|---|---|
| Route group | `/installations` |
| Owner stream | (not in original stream map) |
| Client LOC | 267 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~50% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Unknown |
| Recommendation | UAT discovery |
| Status | **IN PROGRESS** |

### 6. Review

| Field | Value |
|---|---|
| Route group | `/review`, `/review/[id]` |
| Owner stream | D |
| Client LOC | **85** (`review-client.tsx`) — stub-sized |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~20% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Likely most of the review/approval flow |
| Missing documentation | No UAT artifact |
| Technical debt | Likely a placeholder despite REVIEW role being in the schema |
| Business risk | Medium — review/approval is a control; stub = no control |
| Recommendation | Build out or confirm scope. The REVIEW role exists in `Role` enum (`schema.prisma:432`) so the module is expected to function. |
| Status | **IN PROGRESS** (or NOT STARTED) |

### 7. Projects

| Field | Value |
|---|---|
| Route group | `/projects` |
| Owner stream | (not in original stream map) |
| Client LOC | 456 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~60% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Unknown |
| Recommendation | UAT discovery |
| Status | **IN PROGRESS** |

### 8. Accounting

| Field | Value |
|---|---|
| Route group | `/accounting` |
| Owner stream | (not in original stream map) |
| Client LOC | 262 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~50% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | High if it touches real financials; unknown until inspected |
| Recommendation | UAT discovery with financial-controls focus |
| Status | **IN PROGRESS** |

### 9. HR

| Field | Value |
|---|---|
| Route group | `/hr` |
| Owner stream | (not in original stream map) |
| Client LOC | 603 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~70% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Medium (payroll/leave data sensitive) |
| Recommendation | UAT discovery |
| Status | **IN PROGRESS** |

### 10. Executive

| Field | Value |
|---|---|
| Route group | `/executive` |
| Owner stream | (not in original stream map) |
| Client LOC | 188 (page.tsx, no separate -client.tsx) |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~60% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Low (read-only) |
| Recommendation | UAT discovery — verify it reads from real data, not stubs |
| Status | **IN PROGRESS** |

### 11. Dashboard

| Field | Value |
|---|---|
| Route group | `/dashboard` |
| Owner stream | D (per reconciled MULTI-AGENT.md, Dashboard is built last) |
| Client LOC | **13** (page.tsx) — almost certainly a stub or redirect |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~10% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | KPIs, pipeline chart, rep performance — all MVP-SPEC §2 item 2 |
| Missing documentation | No UAT artifact |
| Technical debt | Per roadmap, Dashboard is built last; this is expected to be sparse |
| Business risk | Low (read-only) but high visibility (first screen after login) |
| Recommendation | Build out after A/B/C merged; reads from real data |
| Status | **NOT STARTED** |

### 12. Users

| Field | Value |
|---|---|
| Route group | `/users` |
| Owner stream | Foundation (Milestone 1) |
| Client LOC | 457 |
| Service LOC | 190 |
| UAT discovery | NOT STARTED |
| Completion % | ~70% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown — verify role assignment, disable, department |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | High — RBAC enforcement point; a defect here compromises every other module |
| Recommendation | UAT discovery with RBAC matrix focus (MVP-SPEC §3) |
| Status | **IN PROGRESS** |

### 13. Audit

| Field | Value |
|---|---|
| Route group | `/audit` |
| Owner stream | (not in original stream map) |
| Client LOC | 228 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~50% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | Low (read-only) but is the evidence layer for compliance |
| Recommendation | UAT discovery — verify ActivityLog writes from all modules appear here |
| Status | **IN PROGRESS** |

### 14. Admin (Pricing)

| Field | Value |
|---|---|
| Route group | `/admin/pricing` |
| Owner stream | D (SystemSettings per reconciled MULTI-AGENT.md) |
| Client LOC | 283 |
| Service LOC | 0 |
| UAT discovery | NOT STARTED |
| Completion % | ~60% |
| UAT % | 0% |
| Open bugs | Unknown |
| Missing features | Unknown — verify price catalog, discount/cashback config |
| Missing documentation | No UAT artifact |
| Technical debt | Unknown |
| Business risk | High — drives Quotations math; misconfiguration = revenue leak |
| Recommendation | UAT discovery with linkage check to Quotations |
| Status | **IN PROGRESS** |

## Aggregate

- Total modules: 14
- READY FOR UAT: 0 (CRM is "READY FOR UAT (with caveats)" — gated on CRM-001 fix)
- IN PROGRESS: 12
- NOT STARTED: 1 (Dashboard, by design)
- BLOCKED: 0 explicit; effectively the whole release is blocked by gates (see release-readiness.md)
