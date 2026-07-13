---
description: The pre-UAT release gate. Runs every check and reports PASS/FAIL with raw evidence. Fixes nothing.
---

Run the pre-UAT gate. Report **PASS** or **FAIL** for every item, each with **raw evidence pasted**.
Fix nothing. Change nothing. Commit nothing.

**1. Build**
`docker compose exec -e NODE_ENV=production app npm run build`
→ paste the last 10 lines. GREEN or FAIL.

**2. Runtime**
For each critical route, confirm HTTP 200 with a real authenticated session,
**as the role that actually uses it — not as ADMIN**:
`/` · `/customers` · `/quotations` · `/inspections` · `/approvals` · `/accounting` · the print templates.
→ paste the status codes. A GREEN build does not prove this.

**3. Accounts**
- Does any dev / seed / demo account with a known password still exist in the running DB?
- Does a real `REVIEW` account exist?
- Does every value in the `Role` enum have at least one real user?
→ evidence from a read-only query.

**4. Secrets**
`git status` and `git ls-files` — is `.env` or any secret tracked or staged?
→ paste the output.

**5. Backups**
Does a tested backup exist for the Postgres named volume AND the uploads directory?
**If no restore has ever been tested, the correct answer is FAIL — not "probably fine".**

**6. Transport**
Is the UAT host still HTTP-only? If yes, the session cookie travels in cleartext → FAIL.

**7. Security**
Run `/security-review` on the current branch. Paste the findings.

**Output**

| # | Check | PASS / FAIL | Evidence |

Then one line: `RELEASE GATE: PASS` or `RELEASE GATE: FAIL — n blockers`.

**Do not soften a FAIL. Do not fix anything. Report only.**
