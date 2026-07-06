---
artifact: Residual Risk Register
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Security Officer
---

# Residual Risk Register — EgyGlass ERP

> Risks remaining after the certification pass. No code changed except confirmed P0s (none open).
> "Accepted for UAT" = tolerable for controlled internal UAT with seeded data; must close before production.

| ID | Priority | Risk | Impact | Likelihood | Status | Owner |
|---|---|---|---|---|---|---|
| BIZ-001 | **P1** | SALES_REP can self-approve own quotation (`updateQuotationStatus`) | Financial control bypass; unapproved pricing sent as APPROVED | Med | **OPEN** — fix before production | Senior Eng |
| RL-001 | P2 | No brute-force throttle on login | Credential stuffing | Med | Accepted for UAT | Senior Eng |
| UPL-001 | P2 | Attachment `filePath`/`fileName` unvalidated | Stored-XSS / open-redirect when linked; unsafe with future download handler | Low | Accepted for UAT | Senior Eng |
| ENV-001 | P2 | Hardcoded dev DB creds in `scripts/cleanup.mjs` | Cred leak if script shipped; wrong-DB wipe | Low | Accepted (dev-only) | DevOps |
| AUDIT-001 | P2 | Quotation create/update audit-log write unconfirmed | Incomplete audit trail (MVP-SPEC §5) | Low | Verify in REG-001 | QA |
| AUTHZ-002 | P3 | Pricing read actions ungated | Cost-structure disclosure to any authenticated caller | Low | Hardening | Senior Eng |
| RBAC-001 | P3 | `REVIEW` role unmodeled; unused `hasRole` hierarchy | Confusion / future mis-gate | Low | Hardening | Senior Eng |
| RL-002 | P3 | In-memory rate limiter not multi-instance | Bypass under horizontal scale | Low | Revisit at scale | DevOps |
| SEC-TEST | P3 | No automated security regression tests | Regressions undetected | Med | Ties to REG-001 | Senior Eng |

## Recommended remediation order (post-approval)
1. **BIZ-001** — restrict `APPROVED` transition to `["ADMIN","SALES_MANAGER"]` (small, high-value).
2. **RL-001** — add login throttle/lockout.
3. **UPL-001** — validate attachment path scheme + MIME/size allowlist.
4. **AUDIT-001** — confirm/insert `ActivityLog` on quotation create+update.
5. P3 hardening batch (AUTHZ-002, RBAC-001, RL-002) + SEC-TEST inside REG-001.

## Explicitly accepted for controlled UAT
Both Criticals are closed. With internal users and seeded (non-production) data, the open P1/P2 items
do not expose the business to external compromise during UAT. They **must** be closed before any
production deployment or external-facing exposure.
