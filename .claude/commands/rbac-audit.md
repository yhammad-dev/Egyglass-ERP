---
description: Full authorization + approval-chain audit with adversarial verification. Read-only.
---

Use a dynamic workflow to run a full authorization audit of this repository.

**Phase 1 — Discovery**
List every file containing an exported server action. Search `src/lib/actions/**`,
`src/app/**/actions.ts`, `lib/**/actions.ts`, and every file containing `'use server'`.
Report the count before proceeding.

**Phase 2 — Audit (one agent per file, in parallel)**
For each file, use the `rbac-auditor` subagent. It reports, per exported action:
requireRole present as the first statement (file:line) · roles allowed · scope resolution ·
IDOR exposure · client-controlled privileged fields · derived-record back doors ·
whether `approvedById` is written on approval paths · ActivityLog.

**Phase 3 — Adversarial verification (independent agents)**
Hand every finding to the `evidence-verifier` subagent.
Any finding that cannot be substantiated with a surviving `file:line` quote is **DROPPED**,
not softened. Do not let the auditing agents verify their own findings.

**Phase 4 — One ranked report**
Merge and deduplicate. Output a single table ordered by severity:

| severity | file:line | action | finding | minimal fix |

End with one line: `CONFIRMED: n | REFUTED: n | UNVERIFIABLE: n`

**Constraints**
- **READ ONLY.** Do not edit a single file. Do not fix anything. Do not commit.
- No finding without a `file:line`.
- Do not propose refactors. Minimal fix only.
- If a scope argument is given below, audit only that path.

$ARGUMENTS
