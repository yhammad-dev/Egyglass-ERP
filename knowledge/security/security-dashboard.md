---
artifact: Security Dashboard
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Security Officer
score: 84 / 100
grade: B  (CONDITIONAL PASS)
---

# Security Dashboard — EgyGlass ERP

## Security Readiness Score

# 🟡 84 / 100 — CONDITIONAL PASS

> Cleared for controlled Customer UAT. Not production-ready until P1 + P2 are closed.

## Finding counts

| Priority | Open | Remediated | Total |
|---|---|---|---|
| P0 Critical | **0** | 2 (SEC-001, SEC-002) | 2 |
| P1 High | **1** (BIZ-001) | 0 | 1 |
| P2 Medium | **4** (RL-001, UPL-001, ENV-001, AUDIT-001) | 0 | 4 |
| P3 Low | **4** (AUTHZ-002, RBAC-001, RL-002, SEC-TEST) | 0 | 4 |

## Score breakdown

| Dimension | Weight | Score | Note |
|---|---|---|---|
| Authentication & session | 15 | 15 | bcrypt(12), JWT, inactive-block |
| Authorization / RBAC | 20 | 16 | −4 BIZ-001 self-approval |
| Route/API/middleware protection | 15 | 15 | P0s remediated |
| Input validation | 10 | 10 | zod everywhere |
| Injection (SQLi/XSS/CSRF) | 15 | 15 | Prisma + React + origin checks |
| Data integrity (soft-delete/audit) | 10 | 8 | −2 audit-completeness unconfirmed |
| Secrets / env | 5 | 4 | −1 dev creds in script |
| Rate limiting / abuse | 5 | 3 | −2 login unthrottled |
| Upload/download safety | 5 | 3 | −2 unvalidated attachment path |
| **Total** | **100** | **84** | |

## Gate status (release)

| Release Gate 5 — Security review | Status |
|---|---|
| Documented review exists | ✅ `knowledge/security/security-review.md` |
| Zero open P0 | ✅ |
| Open P1 | ❌ 1 (BIZ-001) — blocks full sign-off |
| Automated security tests | ❌ (REG-001) |

**Gate 5 verdict:** CONDITIONAL — lifts for **UAT**, remains blocked for **production** until BIZ-001 + P2 closed.

## Trend

| Date | Score | P0 open | Event |
|---|---|---|---|
| 2026-07-06 (pre-pass) | ~55 | 2 | Unauth DB-wipe + open routes |
| 2026-07-06 (this pass) | **84** | **0** | SEC-001 + SEC-002 remediated; full cert pass |
