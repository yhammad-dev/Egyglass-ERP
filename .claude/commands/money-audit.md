---
description: Decimal / VAT / milestone / contract-immutability audit of every financial path. Read-only.
---

Use a dynamic workflow to audit monetary correctness across this repository.

**Phase 1 — Discovery**
Find every file that touches money: `lib/finance/**`, `lib/pricing/**`, `src/lib/actions/**`,
and any file referencing `total`, `subtotal`, `discount`, `vat`, `milestone`, `payment`,
`price`, `cashback`, or `Decimal`. Report the count.

**Phase 2 — Audit (one agent per file, in parallel)**
For each file, use the `finance-auditor` subagent. Report every:
`parseFloat` / `Number()` / JS arithmetic on a monetary value · `Float` column ·
VAT applied to subtotal instead of net-after-discount · milestone set that does not sum
to 100% · `Contract.totalValue` recomputed from a live quotation total ·
write path to a Quotation or Contract that already has a contract.

**Phase 3 — Regression check**
Verify whether a test exists that locks the three verified golden totals:
`33,194.39` · `264,252.00` · `19,954.674`.
If no such test exists, report it as a **HIGH** finding.

**Phase 4 — Adversarial verification**
Hand every finding to the `evidence-verifier` subagent. Drop anything unsubstantiated.

**Phase 5 — One ranked report**
Rank by financial blast radius, not by count:
a float in a display helper is MEDIUM; a float on the path to `Contract.totalValue` is CRITICAL.

| severity | file:line | finding | blast radius | minimal fix |

**Constraints**
- **READ ONLY.** No edits. No fixes. No commits.
- No finding without a `file:line`.

$ARGUMENTS
