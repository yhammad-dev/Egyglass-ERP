---
artifact: Release Plan
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Release Manager
horizon: path from current state (BLOCKED) to READY FOR CUSTOMER UAT
---

# Release Plan — EgyGlass ERP

> This is a **release-coordination plan**, not a build plan. It sequences the work required to lift the release from BLOCKED to READY FOR CUSTOMER UAT. It does not write code.

## Current state (2026-07-06)

- Schema: frozen, Phase 1 applied (`schema-phase1-done`, commit 79b488d).
- Foundation (Phase A): complete.
- Feature code: present for 14 module route groups; maturity varies widely.
- UAT discovery: 1 of 14 modules (CRM).
- Bug investigation: 1 of 14 modules (CRM).
- Bug fixes: 0.
- Security review: not documented.
- Regression suite: not present.
- Release gates: 4 of 6 FAIL, 1 AT RISK, 1 UNKNOWN.

## Target state for "READY FOR CUSTOMER UAT"

All six release gates pass:
1. No Critical bug exists.
2. No more than 3 High bugs.
3. Business logic complete for in-scope modules.
4. Database integrity safe.
5. Security review complete and findings addressed.
6. Regression suite passes.

Plus: UAT discovery completed for every in-scope module; each module has a `knowledge/uat/<module>.md` with generated test cases; CRM-001 fixed and verified.

## Phases to lift the release

### Phase R1 — Stop the bleed (CRM-001 fix)
**Goal:** Restore database integrity for the CRM module.

| Step | Owner | Output | ETA |
|---|---|---|---|
| Approve CRM-001 plan | Youssif | Go-ahead on `knowledge/bugs/CRM-001-plan.md` | 5 min |
| Implement CRM-001 fix | Senior Engineer agent | Code change per plan §1 (Files 1–2 minimum) | ~60 min |
| Typecheck + lint | Senior Engineer | `npx tsc --noEmit` + `npm run lint` clean | 5 min |
| Run 18 regression cases | UAT Lead agent | Regression report | ~30 min |
| Update CRM-001 status | Release Manager | `knowledge/bugs/CRM-001.md` → "Fixed"; `customers.md` UAT Case 18 → PASS | 5 min |

**Exit criteria:** CRM-001 closed; UAT Case 18 passes; no new regression failures.
**Total ETA:** ~1.5 hours.

### Phase R2 — UAT discovery for the remaining 13 modules
**Goal:** Generate `knowledge/uat/<module>.md` for every in-scope module so unknowns become known.

Recommended order (by risk and dependency):

| Order | Module | Why this order | Agent | ETA |
|---|---|---|---|---|
| 1 | Quotations | Financial math = highest revenue risk; `quotation-math.md` compliance check | UAT Discovery | ~3 h |
| 2 | Users | RBAC enforcement point — defect here compromises every other module | UAT Discovery | ~2 h |
| 3 | Inspections | Operational SLA risk; mature code (945 LOC) | UAT Discovery | ~2 h |
| 4 | Admin (Pricing) | Drives Quotations math; linkage check | UAT Discovery | ~1.5 h |
| 5 | Review | REVIEW role exists; if stub, control gap | UAT Discovery | ~1 h |
| 6 | Accounting | Financial controls | UAT Discovery | ~2 h |
| 7 | HR | Sensitive personal data | UAT Discovery | ~2 h |
| 8 | Projects | Unknown scope | UAT Discovery | ~1.5 h |
| 9 | Installations | Unknown scope | UAT Discovery | ~1.5 h |
| 10 | Manufacturing | Likely stub; confirm scope | UAT Discovery | ~1 h |
| 11 | Executive | Read-only; verify data source | UAT Discovery | ~1 h |
| 12 | Audit | Cross-module ActivityLog completeness check | UAT Discovery | ~1.5 h |
| 13 | Dashboard | Built last by design; verify KPIs vs. real data | UAT Discovery | ~1.5 h |

**Exit criteria per module:** `knowledge/uat/<module>.md` exists with the full UAT field set (Screen, Route, Components, Buttons, Forms, Validations, Permissions, Expected Result, Missing Features, Known Bugs, UAT Test Cases, Ready For UAT?).

**Total ETA:** ~22 hours of discovery work. Can be parallelized across up to 4 UAT Discovery agents (non-colliding module ownership) → wall-clock ~6–7 hours.

### Phase R3 — Bug investigation wave
**Goal:** For every High/Medium bug surfaced by Phase R2, produce a `knowledge/bugs/<ID>.md` investigation and a `knowledge/bugs/<ID>-plan.md` fix plan.

| Step | Owner | Output | ETA |
|---|---|---|---|
| Triage UAT findings | Release Manager | Bug IDs assigned, severity set | per wave |
| Investigate each High | Bug Investigator agent | `knowledge/bugs/<ID>.md` | ~1 h each |
| Plan each High fix | Fix Planner agent | `knowledge/bugs/<ID>-plan.md` | ~30 min each |

**Exit criteria:** Every High bug has an investigation + plan; every Critical bug has an investigation + plan + emergency fix scheduled.

**Total ETA:** Depends on findings; budget ~10–15 hours.

### Phase R4 — Fix wave
**Goal:** Implement approved fix plans; close bugs.

| Step | Owner | Output |
|---|---|---|
| Implement fixes | Senior Engineer agent | Code changes per approved plans |
| Verify each fix | UAT Lead agent | UAT cases pass, regression clean |
| Close bugs | Release Manager | `knowledge/bugs/<ID>.md` → "Fixed" |

**Exit criteria:** Zero Critical bugs; ≤ 3 High bugs (ideally 0); regression suite green.

### Phase R5 — Security review
**Goal:** Lift the "Security review incomplete" gate.

| Step | Owner | Output |
|---|---|---|
| RBAC matrix test | Security Officer agent | Evidence that every cell in MVP-SPEC §3 behaves correctly |
| Input validation audit | Security Officer agent | zod schemas verified on every server action |
| Soft-delete consistency | Security Officer agent | `deletedAt` filter applied everywhere |
| Session/auth review | Security Officer agent | Auth.js v5 + middleware check |
| Findings report | Security Officer agent | `knowledge/release/security-review.md` |

**Exit criteria:** Security review report with all Critical/High findings addressed.

### Phase R6 — Regression suite
**Goal:** Lift the "Regression incomplete" gate.

| Step | Owner | Output |
|---|---|---|
| Decide test framework | Senior Engineer | Jest/Vitest/Playwright decision recorded |
| Smoke tests per module | Senior Engineer | One happy-path test per module |
| RBAC tests | Senior Engineer | One test per role per critical action |
| Math tests (Quotations) | Senior Engineer | `quotation-math.md` examples as automated tests |
| CI integration | DevOps | Tests run on every PR |

**Exit criteria:** `npm test` passes; CI runs tests on PR.

### Phase R7 — Release readiness re-evaluation
**Goal:** Re-run the release-gate check and issue the final decision.

| Step | Owner | Output |
|---|---|---|
| Refresh dashboard | Release Manager | Updated `release-dashboard.md` |
| Gate check | Release Manager | All 6 gates pass |
| Final decision | Release Manager | `release-readiness.md` updated |

**Exit criteria:** All gates pass; final decision is 🟢 READY FOR CUSTOMER UAT.

## Critical path

The longest dependency chain:

```
R1 (CRM-001 fix, 1.5h)
  → R2 (UAT discovery, ~7h wall-clock with 4 agents)
  → R3 (bug investigation, ~10h)
  → R4 (fix wave, ~10h)
  → R5 (security, ~4h)   ┐
  → R6 (regression, ~6h) ├ can overlap with R4 tail
  → R7 (re-eval, 1h)
```

**Best-case wall-clock to READY FOR CUSTOMER UAT:** ~3–4 working days with 4 parallel UAT agents and 1 Senior Engineer. Single-agent: ~7–8 working days.

## What this plan does NOT include

- Building missing features (Manufacturing, Review, Dashboard stubs) — that is a build decision, not a release decision. The Release Manager flags them as "Business logic incomplete" and escalates to the human.
- Scope decisions about which modules are in MVP. The human (Youssif) decides whether Manufacturing/Review/Dashboard stubs ship as "hidden" or "built out".
- Production deployment (Hostinger). That is post-UAT.

## Escalations to the human (Youssif)

1. **Scope decision:** Are Manufacturing, Review, and Dashboard in MVP? If yes, build them before UAT. If no, hide their routes and remove from nav.
2. **CRM-001 fix approval:** The plan is ready (`CRM-001-plan.md`). Awaiting go-ahead.
3. **Resource decision:** How many parallel UAT Discovery agents can run? Plan assumes 4; wall-clock estimate changes with fewer.
4. **Test framework decision:** Phase R6 needs a framework choice. Recommend Vitest + Playwright; awaiting confirmation.
