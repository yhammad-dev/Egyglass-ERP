# EgyGlass ERP — Absolute Laws

These laws bind every agent, every session, every stream, every worktree.
They are not preferences and they are not defaults.

**If a task requires breaking a law, the law wins. STOP and report.**
Do not work around a law. Do not find "an equivalent way". Do not ask twice.

Laws marked **[HARD]** are additionally enforced by `.claude/hooks/protect.py`.
A blocked tool call is not a bug — it is the law working. Do not try to route around it.

---

## L-01 — Evidence, not assertion  ·  بالدليل لا بالحدس

"Done", "complete", "fixed", "verified", "should work", "looks correct" are **not evidence**.

Evidence is exactly three things:
- real command output,
- a `file:line` quote,
- an HTTP status from a real authenticated request.

Never conflate the three states:

> **COMPILES**  ≠  **RUNS**  ≠  **FEATURE-COMPLETE**

A GREEN build proves the code compiles. It proves nothing about runtime and nothing
about completeness. Prisma and runtime errors do not surface at build time.

If you cannot produce evidence, say **UNVERIFIED** and stop.

## L-02 — The schema is frozen  **[HARD]**

Never edit `prisma/schema.prisma` or anything under `prisma/migrations/`.

If a change is genuinely required, write a **Schema Change Request (SCR)** into
`BACKLOG.md` — model, field, type, nullability, default, reason, blast radius,
migration safety — and **STOP**. Only the human operator applies migrations.

Before claiming something is missing from the schema, **read the schema**.
`PriceListItem`, `PricingFactor`, `CashbackTier`, `PaymentMilestone`,
`FaultInvestigation`, `DrawingStatus` already exist.

## L-03 — The human commits  **[HARD]**

Never run `git commit`, `git push`, `git tag`, or any `prisma migrate` command.
Prepare the change. Report it with evidence. The human reviews, scans for secrets,
and commits.

## L-04 — No direct database writes  **[HARD]**

No `$executeRaw`, no `$queryRaw`, no `psql` INSERT/UPDATE/DELETE/ALTER/DROP.
Every mutation goes through a server action that enforces role, scope and audit.

*"Just to unblock myself"* is precisely the case this law exists to prevent.

## L-05 — Authorization first, always

Every exported server action calls `requireRole(...)` as its **first statement**,
before any Prisma call. Every financial read or write resolves its scope through
`lib/finance/scope.ts`.

An action with no gate is a **P0 defect** even if no UI reaches it today.
Broken access control is the number-one risk in this system.

## L-06 — Privileged fields are server-derived

`status`, `total`, `discountPct`, `approvedById`, `approvedAt`, `role`, `ownerId`
**never** come from client input.

Reading any of them from `FormData` or a request body and writing it to the database
is an approval bypass or self-pricing. It is not a shortcut. It is a vulnerability.

## L-07 — Money is Decimal

All monetary values are Prisma `Decimal` from database to render boundary.
No `parseFloat`. No `Number()`. No JS arithmetic on money.
Convert to string only at the point of display.

VAT is applied on **net-after-discount**, never on subtotal.
`discountBasePct` (18) is a *policy threshold*, not a rate applied to every quotation.

## L-08 — The signed contract is untouchable

Once a contract exists, the quotation and the contract are immutable.
Any post-contract change is a **separate addendum + a new quotation + an approval log**.
`Contract.totalValue` is a snapshot taken at issuance — never recompute it from a live
`Quotation.total`.

A guard on one action is not a guard on the model. Check every write path.

## L-09 — No secrets. Anywhere.

No credentials, connection strings, tokens or passwords in code, seeds, tests, fixtures,
docs, or commit messages. Read from the environment at runtime.

## L-10 — Roles, not people

Model and code by **position** (`TEC_APPROVER`, `REVIEW`, `ACCOUNTING`, `PROCUREMENT`),
never by person name. Person names belong in seed data and documentation only.

There are exactly **14 roles**. There is **no `QUALITY_REVIEW` role**.
"المدير التنفيذي" is the **TEC_APPROVER** role (engineering office manager) — **not** the CEO.
Do not conflate them.

## L-11 — Unknown is a question, not a design

If a requirement is unknown, write it as an **open question in `BACKLOG.md`**.

Never absorb an unknown into a nullable column, a config flag, an `any` type,
a `TODO`, or a "we'll handle it later" branch. Ambiguity that gets designed around
becomes permanent.

## L-12 — Two attempts, then stop

Maximum **two** fix attempts on the same error. On the third: STOP, state the
root-cause hypothesis, and ask.

If the same class of error keeps reappearing in different forms, stop patching
symptoms — there is one root cause. Find it.

## L-13 — Read before you write

Before any change: read the target files, read `BACKLOG.md`, read these laws.
Never assume a file's contents from its name. Never assume a helper exists.
Never assume a pattern — grep for it.

## L-14 — Stop at the checkpoint

Work only in the phase you were given. At every checkpoint: stop, report with evidence,
wait for explicit approval. **Never run ahead into the next phase.**

## L-15 — Configurable, not hardcoded

Any business value that changes over time — warranty text, thresholds, ratios,
validity periods, policies — lives in `SystemSettings` and is editable by the ADMIN.
Never hardcode it.

`SystemSettings` is a **singleton with typed columns**, not key-value.
A new setting therefore requires a migration → which requires an SCR (L-02).
Never propose a JSON blob to dodge this.

---

## When you are unsure

You are not being paid to guess. You are being paid to be right, with proof.
Ask. Stop. Write it in `BACKLOG.md`. All three are cheaper than a wrong migration.
