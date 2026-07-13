# Security guidance — EgyGlass ERP

Read by the security-guidance plugin's independent reviewer. This is the threat model.

## What this system protects

Contract values · discount authority · payment milestones · **pricing factors (margin IP)** ·
customer PII · file uploads (engineering drawings, **signed contract scans**, site photos) ·
the approval audit trail.

There is **no cardholder data**. The highest-value target is the **approval chain**:
anything that lets a user approve, price, or contract without passing the gate.

Stack: Next.js 15 App Router + Server Actions · Prisma 6 + PostgreSQL 16 · Auth.js v5 · Docker.
The UAT host is currently **HTTP-only**, so session cookies travel in cleartext.

---

## Flag every violation below as HIGH

### Authorization
- Every exported server action MUST call `requireRole(...)` as its **first statement**,
  before any Prisma call. An action without a gate is **P0** even if no UI reaches it.
- Every financial read/write MUST resolve scope through `lib/finance/scope.ts`
  (`getFinanceScope`). A bare `prisma.contract.findMany()` inside an action is a data leak.
- **IDOR**: any `customerId` / `quotationId` / `contractId` / `orderId` taken from client
  input and acted on without a server-side ownership or scope check.
- `role` comes from the **session only**. Never from client input.

### Approval-chain integrity
- `status`, `total`, `discountPct`, `approvedById`, `approvedAt`, `ownerId` are
  **server-derived**. Reading any of them from FormData and writing it to the DB is an
  **approval bypass / self-pricing** vulnerability.
- Any **derived record** (replacement manufacturing order, addendum, extra item, child
  order) MUST re-check the parent's gate. A path that reaches production state without
  the same `requireRole` gate as the primary path is an **approval back door**.
  One has already been found and sealed. Assume there are more.
- Setting a Quotation to `APPROVED` **without writing `approvedById`** is an
  audit-integrity finding, not a cosmetic bug. The printed document that authorises the
  discount cannot name who authorised it.
- A signed contract is **immutable**. Check **every** write path to `Quotation` and
  `Contract`, not just `updateQuotation`. A guard on one action is not a guard on the model.

### Money
- All monetary values are Prisma `Decimal` end-to-end. `parseFloat`, `Number()`, or JS
  arithmetic on money is HIGH. Convert to string only at the render boundary.
- VAT is computed on **net-after-discount**, never on subtotal.
- `Contract.totalValue` is a **snapshot at issuance** — never recomputed from a live
  `Quotation.total`.

### Data exposure
- Read paths must use an explicit Prisma `select`. Returning a full quotation or pricing
  object to a `SALES_REP` leaks **cost basis and `factorMinimum` in the payload** even
  when the UI never renders them.
- Uploads (drawings, site photos, **signed contract scans**) are served **only** from an
  authenticated route handler that re-checks scope. A static `/public/uploads` path means
  unauthenticated access to signed contracts.
- No stack traces, Prisma error text, or model names in production responses.

### Audit & change control
- Every mutation writes `ActivityLog` with the acting `User.name` from the session.
- "Delete" in the UI means **deactivate**. Never delete audit rows.
- `prisma/schema.prisma` and `prisma/migrations/**` are **frozen**. A needed change is an
  SCR in `BACKLOG.md`, never an edit.
- No raw SQL as a workaround (`$executeRaw` / `$queryRaw`).
- No secrets in code, seeds, tests, fixtures, docs, or commit messages.

---

## Reviewer context (advisory — this does not suppress findings)

- `ActivityLog` does not snapshot `Customer.ownerId`; attribution uses the current owner
  at display time. This is an accepted soft control, tracked in BACKLOG.
- `User.role` is **singular**; multi-role is a tracked schema change.
  **Never propose granting ADMIN as a workaround** for a user who needs two roles —
  that is privilege escalation by convenience, and it must be reported as HIGH.
