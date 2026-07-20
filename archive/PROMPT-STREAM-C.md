# STREAM C — Inspections (kickoff prompt)

You are **Stream C**. Build ONLY the Inspections domain. Work sequentially, stop at every
checkpoint, report with evidence (real build + page loads 200), and wait for explicit
approval before continuing.

---

## GROUND TRUTH (overrides any older doc)
- The real code + the applied Prisma schema on `master` is the truth. Schema is FROZEN at
  tag `schema-phase1-done`. Do NOT edit `prisma/schema.prisma`.
- Stack: Next.js 16 (App Router, Turbopack), Prisma + PostgreSQL, Auth.js v5, shadcn/ui v4,
  next-intl v4, Tailwind v4 RTL. All commands run inside Docker: `docker compose exec app <cmd>`.
- Read first, in full: `AGENTS.md` (especially the "Verification & Quality — MANDATORY" section),
  `NON-COLLISION-PROTOCOL.md`, `docs/MVP-SPEC.md`, `docs/BUILD-ROADMAP.md`, `prisma/schema.prisma`.
- Stream A (Customers) is already built and merged. You may READ customers; never modify them.

## OWNERSHIP (you may WRITE only here)
- `src/app/(dashboard)/inspections/**`
- `src/lib/services/inspections.ts`
- `src/lib/actions/inspections.ts`
- Your i18n namespace: `inspections.*` in `messages/*.json` (append-only — never touch other keys)
- Your nav entry in `src/lib/nav.ts` (append-only — add only your link)

**READ-ONLY (never write):** schema, `src/lib/auth*`, `src/lib/rbac*`, `src/lib/prisma.ts`,
app shell/layout, `src/components/ui/**` (you MAY add a NEW shared ui component if one is
genuinely missing, but never modify existing ones), anything under `customers/**`.
If you need a change in any shared/read-only file or the schema → STOP, write the request to
`SCHEMA-CHANGE-REQUESTS.md` (for schema) or report it (for shared files), and wait for Youssif.

## ABSOLUTE RULES (see AGENTS.md "Verification & Quality" — these are mandatory)
- Every server action starts with `requireRole([...])` (server-side) + zod validation.
- Every create/update/delete writes an `ActivityLog` entry with the ACTING user's id.
- All user-facing text via next-intl `t()` under `inspections.*`. Every key MUST exist in BOTH
  `messages/ar.json` and `messages/en.json`.
- Any enum/select closed trigger MUST show the translated label, not the raw enum value.
- Latin-digit fields (phone) wrapped `dir="ltr"`. RTL layout.
- Every `<button>` inside a form needs explicit `type` (`type="button"` unless it is the submit button).
- Use ONLY fields/relations that exist in the FROZEN schema (verify before using — do not assume).
- Define every variable before using it.
- After creating ANY new file, run `docker compose restart app` before testing.
- Use the standard form pattern from AGENTS.md (react-hook-form + zod + FieldError). No variations.
- "Build green" is NOT proof. After building, LOAD the page and confirm HTTP 200 (not 500).
- FIX LIMIT: max 2 attempts on any error before stopping to report.
- Stay strictly within Inspections scope. Do NOT build or suggest other streams' work.

---

## RELEVANT SCHEMA (read-only — already applied, verify before use)
- `InspectionRequest`: id, customerId, customer (relation), location (InspectionLocation),
  address, phone, notes, status (InspectionStatus), type (InspectionType),
  scheduledAt (DateTime?), dueDate (DateTime), assigneeId, assignee (relation "InspectionAssignee"),
  createdAt, updatedAt, deletedAt.
- `InspectionLocation`: INSIDE_CAIRO, OUTSIDE_CAIRO.
- `InspectionStatus`: REQUESTED, SCHEDULED, DONE, OVERDUE.
- `InspectionType`: PRICING, EXECUTION (default PRICING).
- Roles relevant here: ADMIN, INSPECTION_MANAGER (manages/schedules), plus read for others.
  (Check rbac for exact role names; do not invent roles.)

---

## SLA RULES (business logic for C2)
- Weekend = **Friday only** (skip Fridays when counting business days).
- Inside Cairo: dueDate = request date + **2 business days**.
- Outside Cairo: dueDate = request date + **4 business days**.
- These day counts should be easy to change later (treat as named constants, not magic numbers
  scattered around).

---

## TASKS (do in order — STOP and report after EACH)

### C1 — Create inspection request + list
- Create an inspection request linked to a customer: location (inside/outside Cairo), address,
  phone, type (PRICING/EXECUTION), notes. Server action with requireRole + zod + ActivityLog.
- A list/table of inspection requests: customer, location, type, status, dueDate, assignee.
  Filters (status / location / type) + search. RBAC: INSPECTION_MANAGER/ADMIN see all.
**CHECKPOINT C1:** build GREEN + page loads 200 + create works + list renders. Report. Wait.

### C2 — Auto-compute dueDate per SLA
- On create, auto-compute `dueDate` from the SLA rules above (2 inside / 4 outside business days,
  skipping Fridays). Store it on the request.
**CHECKPOINT C2:** build GREEN + page 200 + create a request inside Cairo and one outside, and
confirm dueDate is computed correctly (skipping Friday). Report with the two computed dates. Wait.

### C3 — Colored SLA indicator + auto-OVERDUE
- Show a colored SLA indicator per request: green (plenty of time) / amber (due soon) / red
  (due today or past). A request past its dueDate and not DONE is OVERDUE.
- Provide a way to reflect OVERDUE status (e.g. computed on read, and/or an action to mark overdue).
  Do NOT add scalar fields to the schema — derive OVERDUE from dueDate vs now where possible.
**CHECKPOINT C3:** build GREEN + page 200 + indicator shows correct colors + overdue logic works.
Report. Wait.

### C4 — Schedule inspection + assign inspector
- INSPECTION_MANAGER schedules a request: set scheduledAt (date) + assigneeId (inspector).
  Status moves REQUESTED → SCHEDULED. Server action with requireRole + zod + ActivityLog.
- List/table view shows scheduled inspections with their date + assignee. (A simple dated list is
  fine; a full calendar is optional and can be a later enhancement.)
**CHECKPOINT C4:** build GREEN + page 200 + scheduling + assignment works + status moves. Report. Wait.

---

## OUT OF SCOPE (do NOT build)
- Photo upload (Attachment) — deferred to a later phase with real file storage. Do NOT build it.
- Calendar UI beyond a simple dated list (optional, later).
- Anything from other streams (customers, quotations, dashboard).

## REPORTING FORMAT (after every checkpoint)
1. What I did (files touched — confirm all within my ownership).
2. Evidence: real build output (GREEN/errors) + confirmation the page loads 200 (not 500) + a short manual-test note.
3. Surprises / anything unclear.
4. Next step.
5. "Awaiting your approval to continue."

## DEFINITION OF DONE (Stream C)
Full inspection request lifecycle works with permissions + logging: create + list, auto SLA
dueDate (Friday-aware), colored SLA indicator + overdue, scheduling + inspector assignment.
Build GREEN and pages load 200. Do NOT open a PR until Youssif approves the final checkpoint.
