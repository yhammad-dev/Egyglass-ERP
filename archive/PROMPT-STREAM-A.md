# STREAM A — Customers, Pipeline, Interactions (kickoff prompt)

You are **Stream A**. Build ONLY the Customers domain. Work sequentially, stop at every
checkpoint, report with evidence, and wait for explicit approval before continuing.

---

## GROUND TRUTH (overrides any older doc)
- The real code + the applied Prisma schema on `main` is the truth. Schema is FROZEN at
  tag `schema-phase1-done`. Do NOT edit `prisma/schema.prisma`.
- Stack: Next.js 16 (App Router, Turbopack), Prisma + PostgreSQL, Auth.js v5, shadcn/ui v4,
  next-intl v4, Tailwind v4 RTL. All commands run inside Docker: `docker compose exec app <cmd>`.
- Read first, in full: `AGENTS.md`, `NON-COLLISION-PROTOCOL.md`, `docs/MVP-SPEC.md`,
  `docs/BUILD-ROADMAP.md`, `prisma/schema.prisma`.

## OWNERSHIP (you may WRITE only here)
- `src/app/(dashboard)/customers/**`
- `src/lib/services/customers.ts`
- Your i18n namespace: `customers.*` in `messages/*.json` (append-only — never touch other keys)
- Your nav entry in `src/lib/nav.ts` (append-only — add only your link)

**READ-ONLY (never write):** schema, `src/lib/auth*`, `src/lib/rbac*`, `src/lib/prisma.ts`,
app shell/layout, `src/components/ui/**`. If you need a change in any shared/read-only file
or the schema → STOP, write the request to `SCHEMA-CHANGE-REQUESTS.md` (for schema) or report
it (for shared files), and wait for Youssif.

## ABSOLUTE RULES
- Every server action starts with `requireRole([...])` (server-side) + zod validation.
- Every create/update/delete writes an `ActivityLog` entry.
- All user-facing text via next-intl `t()` under `customers.*`. No hardcoded Arabic/English.
- Latin-digit fields (phone) wrapped `dir="ltr"`. RTL layout.
- Financial/Decimal rules don't apply here (that's Stream B), but never trust client data.
- After creating ANY new file (route/action), run `docker compose restart app` before testing.
- Use the standard form pattern from AGENTS.md (react-hook-form + zod + FieldError). No variations.
- FIX LIMIT: max 2 attempts on any error before stopping to report.

---

## RELEVANT SCHEMA (read-only — already applied)
- `Customer`: name, phone, altPhone, type (CustomerType), source (CustomerSource), address,
  notes, stage (PipelineStage), rejectReason, isRepeat, ownerId, coveredById, timestamps, deletedAt.
- `Interaction`: customerId, userId, type (InteractionType), note, createdAt.
- `PipelineStage`: NEW → PRICED → FOLLOW_UP → INSPECTION / EXECUTION / RE_INSPECTION_FOLLOWUP / REJECTED.
- Roles relevant here: ADMIN, SALES_MANAGER, SALES_REP (own customers only), VIEWER (read).

---

## TASKS (do in order — STOP and report after EACH)

### A1 — Customers list
TanStack table: columns (name, phone, type, source, stage, owner). Filters: type / source /
owner / stage. Search by name/phone. Pagination. SALES_REP sees own customers only; ADMIN /
SALES_MANAGER / VIEWER see all (VIEWER read-only).
**CHECKPOINT A1:** run build (GREEN?), show the list works, report. Wait for approval.

### A2 — Create / edit customer
Form (react-hook-form + zod, standard pattern). Fields per schema. Server action with
`requireRole` + zod + ActivityLog. SALES_REP can create; sets ownerId = self.
**CHECKPOINT A2:** build GREEN + create/edit works + ActivityLog written. Report. Wait.

### A3 — Customer profile (Customer 360)
Profile page: customer data + tabs (interactions / quotations / inspections — quotations &
inspections may be empty/stubbed; they belong to other streams, read-only joins are fine).
**CHECKPOINT A3:** build GREEN + profile renders. Report. Wait.

### A4 — Pipeline movement
Change stage with ActivityLog. Moving to REJECTED REQUIRES a rejectReason (block otherwise)
and removes the customer from active follow-up lists.
**CHECKPOINT A4:** build GREEN + stage change + REJECTED rule enforced. Report. Wait.

### A5 — Assignment + absence coverage
SALES_MANAGER assigns customers to reps (ownerId). Absence coverage: set coveredById so a
covering rep sees the colleague's customers temporarily (flagged "coverage"). The covering
rep's actions still log their own userId in ActivityLog.
**CHECKPOINT A5:** build GREEN + assignment + coverage works. Report. Wait.

### A6 — Interactions timeline
Add interaction (type + note). Show as a dated timeline on the profile. Updates visible per
the MVP rule (team can cover each other — visibility per AGENTS.md / MVP-SPEC).
**CHECKPOINT A6:** build GREEN + interaction add + timeline renders. Report. Wait.

---

## REPORTING FORMAT (after every checkpoint)
1. What I did (files touched — confirm all within my ownership).
2. Evidence: build result (GREEN/errors), what runs, a short manual-test note.
3. Surprises / anything unclear.
4. Next step.
5. "Awaiting your approval to continue."

## DEFINITION OF DONE (Stream A)
Full customer lifecycle works with permissions + logging: list, create/edit, profile,
pipeline (with REJECTED rule), assignment + coverage, interactions timeline. Build GREEN.
Do NOT open a PR until Youssif approves the final checkpoint.
