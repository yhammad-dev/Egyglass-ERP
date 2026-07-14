# Definition of Done — the evidence gate

No task is "done" until every box below is checked **with the evidence pasted**.
An unchecked box is not a formality. It is an unshipped defect.

---

## The gate

- [ ] **Build GREEN**
      `docker compose exec app npm run build`
      → paste the last 10 lines of real output.

- [ ] **Runtime verified**
      The affected page returns **HTTP 200** in a real authenticated session,
      **as the role that actually uses it** — not as ADMIN.
      → paste the status. A GREEN build does not prove this (Law L-01).

- [ ] **Authorization**
      Every touched server action: `requireRole` is the first statement, scope is
      resolved, the specific resource is authorized — not just the role.
      → `file:line` for each.

- [ ] **Privileged fields**
      No `status` / `total` / `discountPct` / `approvedById` / `role` / `ownerId`
      read from client input anywhere on the path.

- [ ] **Money**
      Every monetary value is `Decimal` end-to-end. No float on any part of the path.
      If the pricing or finance engine was touched: the three golden totals still
      reproduce exactly (33,194.39 / 264,252.00 / 19,954.674).

- [ ] **Audit**
      Every mutation writes `ActivityLog` with the acting user from the session.

- [ ] **Types are honest**
      No `any`. No `as` cast used to silence the compiler. No `@ts-ignore`.
      No `eslint-disable`. No empty `catch {}`.

- [ ] **Nothing left behind**
      No dead code. No commented-out blocks. No `console.log`.
      No `TODO` without a `BACKLOG` id.

- [ ] **No duplication**
      The logic you wrote does not already exist elsewhere. You grepped. You reused.

- [ ] **i18n / RTL**
      No hardcoded user-facing strings. Logical CSS properties (`ms-`/`me-`),
      never physical (`ml-`/`mr-`).

- [ ] **Security pass**
      `/security-review` run on the branch. Findings fixed, or triaged into
      `BACKLOG.md` with a severity and an owner.

- [ ] **BACKLOG.md updated**
      New decisions, new open questions, new known gaps, new SCRs.

---

## Report format — mandatory, every checkpoint

**1. What I did** — one paragraph. No adjectives. No "successfully".

**2. Evidence** — command output, `file:line`, HTTP status. Nothing else counts.

**3. Surprises** — anything that contradicted the docs, the schema, or these rules.
   A surprise you did not report is a landmine you left for someone else.

**4. What I did NOT do** — explicitly. Every piece of scope you left open.

**5. Next step** — one sentence.

**6.** `Awaiting your approval.`
