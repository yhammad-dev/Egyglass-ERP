---
artifact: UAT Execution Backlog
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Release Manager
priority_scheme: P0 Security / P1 Data Integrity / P2 Business Logic / P3 Regression / P4 Module Completion / P5 Enhancements
execution_policy: Execute P0 only; after each task run QA regression, update Release Dashboard, then STOP for human approval before the next task.
---

# Customer UAT — Execution Backlog

> Backing evidence: `release-dashboard.md`, `release-readiness.md`, `open-bugs.md`, `module-status.md`,
> plus direct source inspection of `src/lib/auth.config.ts`, `src/proxy.ts`, `src/lib/rbac.ts`,
> `src/app/api/cleanup/route.ts`, `src/app/(dashboard)/customers/actions.ts` (2026-07-06).

## Priority legend

| Code | Class | Meaning |
|---|---|---|
| P0 | Security | Auth, access control, unauthenticated exposure, secrets |
| P1 | Data Integrity | Silent data loss / corruption, migration safety |
| P2 | Business Logic | Financial math, approval flows, correctness |
| P3 | Regression | Automated safety net + gate verification |
| P4 | Module Completion | Stub modules, missing features in-scope for MVP |
| P5 | Enhancements | Export/import, UX polish, non-blocking gaps |

---

## P0 — Security  (executing now)

### SEC-001 — Remove unauthenticated destructive `/api/cleanup` endpoint
| Field | Value |
|---|---|
| ID | SEC-001 |
| Title | `POST /api/cleanup` wipes almost the entire database with no auth, role, or environment guard |
| Priority | **P0** |
| Owner | Security Officer / Senior Engineer |
| Dependencies | None |
| Acceptance Criteria | The unauthenticated DB-wipe route is not reachable in any deployed environment; dev-only data reset remains available via `scripts/cleanup.mjs`; typecheck + build green; no other route regresses |
| Estimated Effort | 15 min |
| Release Blocking | **YES** |

**Evidence:** `src/app/api/cleanup/route.ts` calls `deleteMany()` on ActivityLog, Quotation(+items/approvals), Inspection(+measurements/photos), Attachment, Notification, Payment, Customer, Project, etc. No `auth()`, no `requireRole`, no `NODE_ENV` guard. The `proxy.ts` matcher explicitly excludes `/api`, so it is not even behind the (already-broken) auth middleware. Any actor able to reach the server can destroy all business data with one POST. OWASP A01 Broken Access Control / A04 Insecure Design.

### SEC-002 — Middleware only authenticates `/dashboard`; all other routes fall through
| Field | Value |
|---|---|
| ID | SEC-002 |
| Title | `authorized()` callback returns `true` for every path except `/dashboard`, leaving `/customers`, `/quotations`, `/users`, `/admin/pricing`, `/hr`, `/accounting`, etc. ungated at the edge |
| Priority | **P0** |
| Owner | Security Officer / Senior Engineer |
| Dependencies | None |
| Acceptance Criteria | Every authenticated route group requires a valid session at the middleware layer; unauthenticated request to any `(dashboard)` route redirects to `/login`; `/login` and public assets remain reachable; no redirect loop; typecheck + build green |
| Estimated Effort | 30 min |
| Release Blocking | **YES** |

**Evidence:** `src/lib/auth.config.ts` `authorized()` gates only `nextUrl.pathname.startsWith("/dashboard")`; the final `return true` admits all other paths. Mutations are still protected by per-action `requireRole`, but page reads/data for 13 of 14 modules are not gated at the edge. OWASP A01.

### SEC-003 — Security review report (RBAC matrix, input-validation, soft-delete, session)
| Field | Value |
|---|---|
| ID | SEC-003 |
| Title | Produce signed-off `knowledge/release/security-review.md` lifting release Gate 5 |
| Priority | **P0** |
| Owner | Security Officer |
| Dependencies | SEC-001, SEC-002 |
| Acceptance Criteria | RBAC matrix (MVP-SPEC §3) verified per role; every server action confirmed to `requireRole` + zod `safeParse`; `deletedAt` soft-delete filter confirmed applied on every read path; Auth.js v5 session/JWT config reviewed; all Critical/High findings closed or ticketed |
| Estimated Effort | 4 h |
| Release Blocking | **YES** |

---

## P1 — Data Integrity

### DATA-001 — CRM-001 data-loss on customer edit (FIXED — verify closure)
| Field | Value |
|---|---|
| ID | DATA-001 (CRM-001) |
| Priority | P1 |
| Owner | UAT Lead |
| Dependencies | — |
| Acceptance Criteria | UAT Case 18 PASS; regression 38/38 PASS (already recorded); `open-bugs.md` shows CRM-001 = Fixed |
| Estimated Effort | 15 min (verification only — fix already landed) |
| Release Blocking | YES (until formally closed) |

### DATA-002 — Soft-delete filter consistency audit (`deletedAt`)
| Field | Value |
|---|---|
| ID | DATA-002 |
| Priority | P1 | Owner | Bug Investigator |
| Dependencies | — |
| Acceptance Criteria | Every service read applies `deletedAt: null` where the model is soft-deletable; documented list of read paths + verdict |
| Estimated Effort | 2 h | Release Blocking | YES |

### DATA-003 — Audit-log write completeness across modules
| Field | Value |
|---|---|
| ID | DATA-003 | Priority | P1 | Owner | Bug Investigator |
| Dependencies | — |
| Acceptance Criteria | Every mutating server action writes an `ActivityLog` entry (MVP-SPEC §5 DoD); gaps listed |
| Estimated Effort | 2 h | Release Blocking | NO |

---

## P2 — Business Logic

### BL-001 — Quotations math conformance to `docs/quotation-math.md`
| ID | BL-001 | Priority | P2 | Owner | UAT Discovery | Dependencies | Admin/Pricing |
| Acceptance Criteria | Discount/cashback/VAT/rounding outputs match every worked example in `quotation-math.md`; 3-day validity + approval flow verified | Effort | 3 h | Release Blocking | YES |

### BL-002 — Review/approval flow (REVIEW role) functional, not stub
| ID | BL-002 | Priority | P2 | Owner | UAT Discovery | Dependencies | — |
| Acceptance Criteria | A quotation/inspection can be routed to REVIEW and approved/rejected with audit trail | Effort | 3 h | Release Blocking | YES (if in MVP) |

### BL-003 — Admin/Pricing → Quotations linkage
| ID | BL-003 | Priority | P2 | Owner | UAT Discovery | Dependencies | BL-001 |
| Acceptance Criteria | Price catalog + discount/cashback config drives Quotations math correctly | Effort | 1.5 h | Release Blocking | YES |

---

## P3 — Regression

### REG-001 — Establish automated regression suite
| ID | REG-001 | Priority | P3 | Owner | Senior Engineer | Dependencies | — |
| Acceptance Criteria | Vitest configured; smoke test per module; RBAC test per role; Quotations math tests from `quotation-math.md`; `npm test` green in CI | Effort | 6 h | Release Blocking | YES |

### REG-002 — UAT discovery for remaining 13 modules
| ID | REG-002 | Priority | P3 | Owner | UAT Discovery (×4) | Dependencies | — |
| Acceptance Criteria | `knowledge/uat/<module>.md` exists with full field set for every in-scope module | Effort | ~22 h (7 h wall-clock ×4) | Release Blocking | YES |

---

## P4 — Module Completion

### MOD-001 Manufacturing stub (138 LOC) · MOD-002 Review stub (85 LOC) · MOD-003 Dashboard stub (13 LOC)
| Priority | P4 | Owner | Senior Engineer | Dependencies | Scope decision (Youssif) |
| Acceptance Criteria | Each in-scope stub either built to MVP-SPEC or its route hidden + removed from nav | Effort | TBD after scope | Release Blocking | YES if in MVP, else NO |

---

## P5 — Enhancements

### ENH-001 Customer export/import/bulk · ENH-002 Enum label humanization · ENH-003 Success toasts on Stage/Owner/Coverage dialogs
| Priority | P5 | Owner | Senior Engineer | Dependencies | — |
| Acceptance Criteria | Per UAT `customers.md` missing-feature list | Effort | 1–2 d total | Release Blocking | NO |

---

## Execution order (P0 only, one at a time, approval gate between each)

1. **SEC-001** ← executing now → QA regression → dashboard update → **STOP for approval**
2. SEC-002 (pending approval)
3. SEC-003 (pending approval)
