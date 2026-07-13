---
description: Schema-to-code drift analysis. Produces the SCR-017b deletion candidate list. Read-only.
---

Use a dynamic workflow to analyse schema-to-code drift.

**Phase 1 — Inventory**
Read `prisma/schema.prisma`. List every model, every column, and every enum value.
Report the totals.

**Phase 2 — Reference search (parallel)**
For each item, use the `schema-guardian` subagent to search the entire codebase —
`src/**`, `prisma/seed*`, scripts, tests — for reads and writes.

The search MUST include:
- direct property access (`quotation.discountPct`)
- string-keyed access (`obj["discountPct"]`)
- Prisma `select` / `include` / `where` / `orderBy` object keys
- any raw SQL
- any enum value used as a string literal

State the exact patterns searched for each item.

**Phase 3 — Adversarial verification**
Every "ZERO REFERENCES" claim goes to the `evidence-verifier` subagent.
A DEAD verdict that cannot be exhaustively proven is downgraded to **UNVERIFIED** —
never left as DEAD. **A wrong DEAD verdict becomes a data-destroying migration.**

**Phase 4 — Report**
Three tables:
1. **LIVE** — item | one proving file:line
2. **DEAD** — item | patterns searched | match count (0) | deletion risk
3. **SEED/TEST ONLY** or **UNVERIFIED** — item | why it could not be settled

Format the DEAD table so it can be pasted straight into `BACKLOG.md` as **SCR-017b**.

**Constraints**
- **READ ONLY.** Never edit `prisma/schema.prisma`. Never write a migration.
- The human operator writes and applies the migration. You produce the evidence.

$ARGUMENTS
