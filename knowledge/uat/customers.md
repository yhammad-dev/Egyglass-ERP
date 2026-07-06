---
module: CRM (Customers)
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
scope: CRM (customers) module only
project: EgyGlass ERP — E:\Projects\EgyGlass_ERP_New_Build
stack: Next.js (App Router) + Auth.js v5 + Prisma + PostgreSQL + shadcn/ui + react-hook-form + zod + next-intl (Arabic primary, English secondary)
locale_at_runtime: ar (RTL) — labels quoted below are the English-locale strings from messages/en.json for reviewer readability; actual on-screen text is the Arabic equivalent from messages/ar.json
---

# CRM (Customers) Module — UAT Discovery

## Module Overview

### Routes covered
| Route | Screen | Implemented by |
|-------|--------|----------------|
| `/customers` | Customers list | `src/app/(dashboard)/customers/page.tsx` → `customers-client.tsx` |
| `/customers/[id]` | Customer profile | `src/app/(dashboard)/customers/[id]/page.tsx` → `customer-profile-client.tsx` |

### Server actions backing the screens (the CRM "backend")
| Action | File | Roles enforced |
|--------|------|----------------|
| `createCustomerAction` | `src/app/(dashboard)/customers/actions.ts` | ADMIN, SALES_MANAGER, SALES_REP |
| `updateCustomerAction` | `src/app/(dashboard)/customers/actions.ts` | ADMIN, SALES_MANAGER, SALES_REP |
| `changeCustomerStage` | `src/lib/actions/customers.ts` | ADMIN, SALES_MANAGER, SALES_REP (REP only for own customers) |
| `assignCustomer` | `src/lib/actions/customers.ts` | ADMIN, SALES_MANAGER |
| `setCustomerCoverage` | `src/lib/actions/customers.ts` | ADMIN, SALES_MANAGER |
| `addInteraction` | `src/lib/actions/customers.ts` | ADMIN, SALES_MANAGER, SALES_REP |

> Note: There is **no `/api/customers/*` route**. The CRM module is built entirely on Next.js Server Actions. The only API routes in the repo are `api/auth`, `api/cleanup`, `api/notifications` (none are customer-specific).

### Prisma models/enums in play (frozen schema `schema-phase1-done`)
- `Customer` (`prisma/schema.prisma:37`): id, name, phone, altPhone?, type (CustomerType), source (CustomerSource), address?, notes?, stage (PipelineStage), rejectReason?, isRepeat, ownerId?, coveredById?, createdAt, updatedAt, deletedAt?; relations owner, inspections, interactions, quotations, projects.
- `Interaction` (`prisma/schema.prisma:65`): customerId, userId, type (InteractionType), note, createdAt.
- Enum `CustomerType` = INDIVIDUAL | ENGINEER | COMPANY (`schema.prisma:454`).
- Enum `CustomerSource` = AD | REFERRAL | WHATSAPP | EXHIBITION | VISIT (`schema.prisma:460`).
- Enum `PipelineStage` = NEW | PRICED | FOLLOW_UP | INSPECTION | EXECUTION | RE_INSPECTION_FOLLOWUP | REJECTED (`schema.prisma:468`).
- Enum `InteractionType` = CALL | WHATSAPP | VISIT | NOTE (`schema.prisma:478`).
- Enum `Role` = ADMIN | SALES_MANAGER | SALES_REP | INSPECTION_MANAGER | VIEWER | REVIEW | PROCUREMENT | INSTALLATIONS | ACCOUNTING | HR | PROJECTS (`schema.prisma:432`).

### Readiness summary table
| # | Screen | Route | Dialogs inside | Ready for UAT? |
|---|--------|-------|-----------------|-----------------|
| 1 | Customers list | `/customers` | Create/Edit Customer dialog | YES (with caveats) |
| 2 | Customer profile | `/customers/[id]` | Assign Owner, Set Coverage, Change Stage; tabs: Interactions / Quotations / Inspections | YES (with caveats) |
| 3 | Assign Owner dialog | inside profile | — | YES |
| 4 | Set Coverage dialog | inside profile | — | YES |
| 5 | Change Stage dialog | inside profile | — | YES |

Total screens inspected: **2 pages + 3 dialogs = 5 screens**.
Total UAT test cases generated: **48** (see per-screen sections).

---

## Screen 1: Customers List

### Screen Name
Customers List

### Route
`/customers` (exact path). Sidebar label: `nav.customers` → "Customers" (`src/lib/nav.ts:10`).

### Purpose
Browse, filter, search, paginate, create, and edit customers. Sales Reps see only customers they own or cover; ADMIN / SALES_MANAGER / VIEWER see all. VIEWER cannot create/edit.

### UI Components
- Page heading (`h1`) — "Customers" (`customers.title`, `customers-client.tsx:317`).
- "New Customer" primary button (hidden for VIEWER, `customers-client.tsx:318-320`).
- Filter bar (flex-wrap) with 5 controls: search Input + 4 Select filters (`customers-client.tsx:324-429`).
- Data table built with `@tanstack/react-table` (`customers-client.tsx:304-312`). Columns:
  1. Name (link to `/customers/{id}`, `customers-client.tsx:245-255`)
  2. Phone (`dir="ltr"`, `customers-client.tsx:256-259`)
  3. Type (translated via `customers.{type}`, `:260-263`)
  4. Source (translated via `customers.source_{source}`, `:264-267`)
  5. Stage (translated via `pipeline.{stage}`, `:268-271`)
  6. Coverage badge (`customers.coverageBadge`, secondary Badge, `:272-278`)
  7. Owner (or "—", `:279-282`)
  8. Actions column (Edit button) — only when `!isViewer` (`:283-299`)
- Empty-state row: "No results" (`app.noResults`, `:462-470`).
- Pagination bar: "Page {current} of {total}" + Previous / Next buttons (`:476-502`).
- Create/Edit Dialog (`:505-641`).

### Buttons (exact labels + behavior)
| Label | Behavior |
|-------|----------|
| "New Customer" (`customers.newCustomer`) | Opens Create dialog (`openCreate`, `:319`) — hidden if role === VIEWER |
| "Edit" (`app.edit`, inside table) | Opens Edit dialog (`openEdit`, `:289-296`) — column hidden if VIEWER |
| "Previous" (`customers.prevPage`) | `table.previousPage()`, disabled when `!getCanPreviousPage()` (`:485-492`) |
| "Next" (`customers.nextPage`) | `table.nextPage()`, disabled when `!getCanNextPage()` (`:493-500`) |
| "Cancel" (`app.cancel`) | Closes dialog (`closeDialog`, `:632`) — `type="button"` (correct) |
| "Save" (`app.save`) | Submits form (`handleSubmit(onSubmit)`) — disabled while submitting; shows "Save..." (`:635-637`) |

### Forms
Create/Edit Customer dialog form (`customers-client.tsx:512-639`). Fields:

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| name | Input | Yes (`errors.required`) | "" | |
| phone | Input (`dir="ltr"`) | Yes | "" | |
| altPhone | Input (`dir="ltr"`) | No | "" | |
| type | Select | Yes | INDIVIDUAL | Options INDIVIDUAL/ENGINEER/COMPANY (`CUSTOMER_TYPES`) |
| source | Select | Yes | VISIT | Options AD/REFERRAL/WHATSAPP/EXHIBITION/VISIT (`CUSTOMER_SOURCES`) |
| address | Textarea | No | "" | |
| notes | Textarea | No | "" | |
| isRepeat | Checkbox | — | false | |
| ownerId | Select (only ADMIN/SALES_MANAGER) | No | undefined | Options from `getSalesReps()`; "—" selected when none (`:604-629`) |

> On Edit open (`openEdit`, `:150-164`), `altPhone`, `address`, `notes`, `isRepeat` are reset to defaults (NOT populated from the row) — see Known Bugs.

### Validations
Client zod schema (`customers-client.tsx:72-82`):
```
z.object({
  name: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  altPhone: z.string().optional(),
  type: z.string().min(1, "errors.required"),
  source: z.string().min(1, "errors.required"),
  address: z.string().optional(),
  notes: z.string().optional(),
  isRepeat: z.boolean(),
  ownerId: z.string().optional(),
})
```
Server zod schema (`actions.ts:7-20`) uses enums `customerTypeEnum`/`customerSourceEnum` plus same min-1 strings. Phone has **no format/length check** beyond non-empty. No uniqueness check on phone. Owner validation: if role === SALES_REP, server forces `ownerId = auth.userId` (`actions.ts:50-52`) and silently strips ownerId on update (`actions.ts:77-79`).
Error resolution: server returns keys (`"errors.required"`, field-error map) and client translates via `t()` (`customers-client.tsx:171-211`).

### Permissions
- Page route guard: `requireRole(["ADMIN","SALES_MANAGER","SALES_REP","VIEWER"])`; unauthorized → `redirect("/dashboard")` (`page.tsx:7-13`).
- Data scoping (service layer) — `src/lib/services/customers.ts:35-46`: SALES_REP sees only rows where `ownerId = userId` OR `coveredById = userId`; everyone else sees all non-deleted customers.
- Create/Update actions require `["ADMIN","SALES_MANAGER","SALES_REP"]` (`actions.ts:35`, `:63`).
- "New Customer" button and Edit-column hidden in UI when `currentRole === "VIEWER"` (`customers-client.tsx:106, 283-299, 318-320`).
- Owner-field inside the form only shown when `isAdminOrManager` (ADMIN or SALES_MANAGER) (`:604`).

### Expected Result
- Logged-in ADMIN/SALES_MANAGER see all customers, can filter/search/paginate, create, edit, assign owner inline.
- SALES_REP sees only their owned/covered customers, can create (owner auto-set to self), can edit (cannot change owner field — server strips it).
- VIEWER sees the table + filters but no action buttons; create/edit actions are rejected server-side.

### Missing Features
- **Export**: Not present (no CSV/Excel/PDF button anywhere).
- **Import / bulk upload**: Not present.
- **Bulk delete**: Not present (no row selection; `onCheckedChange` on rows not used).
- **Soft delete / delete any customer**: Not present — no `deletedAt` is ever set from the CRM screens; `deleteCustomer` action does not exist in `actions.ts` or `src/lib/actions/customers.ts`.
- **Sorting**: Table headers are non-clickable (`customers-client.tsx:438-444`) — no `getSortedRowModel`. Default order is `updatedAt desc` only (service layer).
- **Date columns** (createdAt/updatedAt) not shown in the table.
- **Coverage owner name** not displayed in the list table (only a badge), though `coveredByName` is fetched.
- **Phone format validation**: only non-empty.
- **Refresh after server action**: list updates are done via local `setData` state, not a re-fetch — if a coworker edits the same record, staleness may occur until full reload.
- No confirmation dialog before closing an unsaved Create/Edit.
- No row-click navigation — only the Name link navigates.

### Known Bugs
1. **Edit dialog loses `altPhone`, `address`, `notes`, `isRepeat` for existing customers** (`customers-client.tsx:150-164`). `openEdit` calls `reset({ ... altPhone:"", address:"", notes:"", isRepeat:false, ... })`. Even if the service layer returned these (it does not — `getCustomers` selects only id/name/phone/type/source/stage/ownerId/coveredById/owner, `services/customers.ts:51-61`), the client overwrites them. Net effect: opening Edit and saving without re-typing wipes these fields. **Data-loss risk.**
2. `CustomerRow` type (`services/customers.ts:4-16`) has no `altPhone`, `address`, `notes`, `isRepeat` — so `openEdit(customer)` referencing `customer.altPhone` etc. would not even compile if it tried. The reset uses hard-coded "" and false to work around it. Customer is type-incompatible with the full customer record.
3. **Duplicate i18n key `customers.rejectReason`** in `messages/en.json` (lines 52 and 85) and `messages/ar.json`. JSON duplicate keys are silently last-wins; next-intl will pick one — fragile and may surprise reviewers. Not a runtime crash but a quality defect.
4. **`customers.selectType` and `customers.interactionAdded`** vs `customers.selectOwner` etc. — keys exist; but `customers.interactionAdded` and `customers.ownerAssigned` / `customers.coverageUpdated` are defined but **never toasted** in the code (dialogs call `onAssigned()`/`refresh()` only), so success toast is missing — see Screen 2 bugs.
5. **`<SelectTrigger>` in `CustomersClient` filters uses `<SelectValue placeholder=...>` with children** (`customers-client.tsx:345-348`, `:370-372`, `:393-395`). The Radix `SelectValue` does not display its children text when an empty-string/`undefined` value is set — the fallbacks `typeFilter !== "all" ? t(...) : undefined` only render when a filter is selected, otherwise the `placeholder` is used. Works, but the `SelectValue` children rendering pattern is non-idiomatic and has been a source of label-not-showing bugs elsewhere in the project (per AGENTS.md rule #8).
6. **`formSchema` client vs server enum mismatch masked**: client uses `z.string().min(1)` for `type`/`source`; server uses strict enums. A client could submit an invalid enum value if zod client-side ever loosened — currently fine because the Select only offers valid enum values, but the client schema does not defensively reject typos.
7. `PIPELINE_STAGES` (`customers-client.tsx:62-70`) is a local copy of `PipelineStage`; if the schema enum ever adds a stage, this list silently drops it.
8. No `ActivityLog` re-reading after edits — fine, but the `getCustomers` re-query does not occur; the optimistic `setData` uses the `toRow` of the updated record returned by the action which only includes owner relation — corrected on reload.

### UAT Test Cases (Customers List)
1. **[Access/Admin]** Log in as ADMIN, open `/customers`, verify the page loads HTTP 200 and the heading "Customers" (Arabic equivalent) shows.
2. **[Access/SalesRep]** Log in as SALES_REP, open `/customers`, verify only customers where `ownerId` or `coveredById` equals the logged-in user appear (cross-check against DB).
3. **[Access/Viewer]** Log in as VIEWER, open `/customers`, verify the "New Customer" button is absent and the "Edit" column is absent.
4. **[Access/Viewer server-side]** As VIEWER, attempt to call `createCustomerAction` (e.g. via devtools network replay of an admin session's payload, or by temporarily showing the button) — expect `errors.notAuthorized`.
5. **[Access/Unauth]** Without signing in, navigate to `/customers` — verify redirect to `/login`.
6. **[Search]** Type a partial name into the search box; verify the table filters client-side by `name includes` (case-insensitive) or `phone includes`.
7. **[Search reset]** Type a non-matching phone; verify the empty-state row "No results" (`app.noResults`) appears.
8. **[Filter Type]** Select "Engineer" in the Type filter; verify only ENGINEER rows show and the Select trigger displays the translated label.
9. **[Filter Source]** Select "WhatsApp" in the Source filter; verify rows filter and pagination resets to page 1.
10. **[Filter Stage]** Select "Rejected" in the Stage filter; verify only REJECTED rows show.
11. **[Filter Owner]** Select a sales rep in the Owner filter; verify only rows owned by that rep appear.
12. **[Filter combination]** Apply Type=Company + Source=Referral + Stage=Priced simultaneously; verify the intersection is shown.
13. **[Filter reset]** Set all 4 filters then change search text — verify pagination returns to page 1 (`setPagination(prev => ({...prev, pageIndex:0}))`).
14. **[Pagination]** With >20 customers, click "Next" then "Previous"; verify the page info string "Page {current} of {total}" updates correctly and Next is disabled on the last page.
15. **[Create happy path]** As ADMIN click "New Customer", fill name="UAT Test", phone="+201000000000", type=Company, source=Referral, isRepeat=checked, owner=some rep; click Save; verify success toast ("Customer created successfully") and the new row appears at the top.
16. **[Create required validation]** Open "New Customer", leave name and phone empty, click Save; verify inline error "This field is required" under both fields.
17. **[Create SalesRep owner lock]** As SALES_REP open "New Customer"; the Owner Select should be absent; upon save, verify in DB that the new customer's `ownerId` was set to the rep's userId (server override `actions.ts:50-52`).
18. **[Edit data-loss regression]** As ADMIN find a customer that has `altPhone`/`address`/`notes`/`isRepeat=true` in DB; click Edit; DO NOT retype those fields; click Save; reload the page; verify whether `altPhone`, `address`, `notes` were wiped and `isRepeat` reset to false. **Expected per current code: YES, they are wiped.** Log as a defect.
19. **[Edit SalesRep cannot change owner]** As SALES_REP click Edit on an owned customer; the Owner Select is absent; submit; verify the `ownerId` did not change server-side (`actions.ts:77-79` strips it).
20. **[Row navigation]** Click a customer's Name link; verify navigation to `/customers/{id}` and the profile screen renders.
216. **[Cancel unsaved]** Open "New Customer", type something, click Cancel — verify the dialog closes without creating a record.

### Ready For UAT (YES/NO)
**YES** — the screen renders, filters/sort/pagination work, and Create/Edit submit server actions correctly. However, CASE 18 (Edit wipes `altPhone`/`address`/`notes`/`isRepeat`) is a **data-loss bug that must be fixed before production UAT sign-off**; it is documented here so testers reproduce it deliberately.

---

## Screen 2: Customer Profile

### Screen Name
Customer Profile

### Route
`/customers/[id]` (exact path, dynamic segment `id`).

### Purpose
View full customer details, change pipeline stage, assign owner, set coverage rep, and add timeline interactions. Also shows read-only lists of the customer's quotations and inspections. Reached by clicking a Name link in the customers list.

### UI Components
- Header bar: "Back to List" button (Link to `/customers`), customer name (`h1`), Coverage Badge if `customer.coveredById`, and right-aligned action buttons (`customer-profile-client.tsx:93-130`).
- Action buttons (gated by role): `<AssignOwnerDialog>`, `<SetCoverageDialog>` (ADMIN/SALES_MANAGER only, `:104`), `<StageChangeDialog>` (any non-VIEWER, `:122`).
- Customer Info Card (white rounded card, `:133-168`): `DetailRow` grid of 3 columns showing name, phone (`dir="ltr"`), altPhone ("—" if blank), type, source, stage, rejectReason (only when stage===REJECTED and reason present), owner, coveredBy (when set), address, isRepeat ("✓" or "—"), createdAt, updatedAt (both `toLocaleDateString("ar-EG")`). Notes paragraph appended at bottom when present.
- Tabs (`:171-194`): 3 buttons (`role="tab"`): Interactions / Quotations / Inspections (`TABS` array, `:26-30`). Active tab underline bar.
- Interactions tab (`:198-274`):
  - If not VIEWER: "Add Interaction" sub-card with a Type Select (`CALL|WHATSAPP|VISIT|NOTE`, default NOTE) + Textarea + Add button.
  - Timeline list of interactions with colored type badges and user — date footer. Empty state: "No interactions yet".
- Quotations tab (`:277-295`): read-only list of `{number, status, total}`; empty state "No quotations yet". Labeled "stub" in the file comment.
- Inspections tab (`:297-320`): read-only list of `{status, location, scheduledAt}`; empty state "No inspections yet". Labeled "stub" in the file comment.

### Buttons (exact labels + behavior)
| Label | Behavior |
|-------|----------|
| "Back to List" (`customers.backToList`) | `<Link href="/customers">` (`:95-97`) |
| "Assign Owner" (`customers.assignOwner`) | Opens `AssignOwnerDialog` (shown only for ADMIN/SALES_MANAGER) |
| "Set Coverage" (`customers.setCoverage`) | Opens `SetCoverageDialog` (shown only for ADMIN/SALES_MANAGER) |
| "Change Stage" (`customers.changeStage`) | Opens `StageChangeDialog` (shown for any non-VIEWER) |
| "Add Interaction" (`customers.addInteraction`) | Calls `handleAddInteraction`; disabled while `interactionSubmitting` or note empty (`:233-239`) |
| "Loading..." (`app.loading`) | Submit button spinner state for Add Interaction (`:237`) |

### Forms
**Add Interaction form** (NOT react-hook-form — plain `useState`):
| Field | Type | Required | Default |
|-------|------|----------|---------|
| interactionType | Select | No (defaults to NOTE) | "NOTE" |
| interactionNote | Textarea (3 rows) | Yes (button disabled when empty) | "" |

Placeholder: "Write a note..." (`customers.interactionNotePlaceholder`).

No other forms on the page — Stage/Owner/Coverage live in their dialogs (Screens 3–5).

### Validations
- Add Interaction: client requires non-whitespace note (`interactionNote.trim()` gates the button `:235` and `handleAddInteraction` returns early if blank `:68`). Server enforces `z.string().min(1, "errors.required")` (`lib/actions/customers.ts:168`). Type restricted to enum `["CALL","WHATSAPP","VISIT","NOTE"]`.
- Profile page route calls `notFound()` when `getCustomerById` returns null (`[id]/page.tsx:26`) — surfaced as Next.js 404 page.

### Permissions
- Page route guard: `requireRole(["ADMIN","SALES_MANAGER","SALES_REP","VIEWER"])` (`[id]/page.tsx:13-19`) → redirect otherwise.
- Data scope for SALES_REP: service `getCustomerById` adds `OR: [{ ownerId: actorId }, { coveredById: actorId }]` (`services/customers.ts:234-239`). Other roles can see any customer.
- `canChangeStage` = NOT VIEWER (`customer-profile-client.tsx:64`) — but the underlying action additionally rejects SALES_REP who is not the owner (`lib/actions/customers.ts:43-45`).
- `isAdminOrManager` gates Assign Owner + Set Coverage (`customer-profile-client.tsx:65, 104-121`).
- Add Interaction: UI hidden for VIEWER (`:201`); action requires ADMIN/SALES_MANAGER/SALES_REP (`lib/actions/customers.ts:177`).

### Expected Result
- Any of ADMIN/SALES_MANAGER/SALES_REP/VIEWER may open a customer they're allowed to see.
- ADMIN/SALES_MANAGER see Assign Owner, Set Coverage, Change Stage, and Add Interaction.
- SALES_REP sees Change Stage + Add Interaction only (no Assign/Set Coverage buttons) and can only change stage for customers they own.
- VIEWER sees only the read-only details + tabs; no action buttons.

### Missing Features
- No success toast after Stage / Owner / Coverage changes — the dialogs close and `router.refresh()` re-fetches, but the user gets no confirmation message even though keys `customers.ownerAssigned`, `customers.coverageUpdated`, `customers.interactionAdded` exist in i18n. Only the Add Interaction action also lacks a toast (it just clears the input + refreshes).
- Add Interaction uses `alert(result.error)` (`customer-profile-client.tsx:82`) — a browser `alert()` for error display, inconsistent with the sonner `<Toaster>` used elsewhere. UI quality issue.
- Quotations tab shows `t("quotations.status")` raw-key concatenated (e.g. "Status: APPROVED") — status is shown as the raw Prisma enum, not a translated label. Inspection status likewise (`:287, :307`).
- No edit affordance for customer name/phone/etc directly on the profile — must go back to the list and click Edit, where (per Screen 1 bug #1) `altPhone`/`address`/`notes`/`isRepeat` get wiped.
- No delete / soft-delete / convert-to-project action.
- No breadcrumbs — only a "Back to List" button.
- No pagination inside the Interactions / Quotations / Inspections lists (could be very long for active accounts).
- No export of the customer profile / interactions timeline.
- Quotations/Inspections are read-only stubs — clicking a quotation does not navigate to `/quotations/{id}` (no Link).

### Known Bugs
1. **No success toast on Assign Owner / Set Coverage / Change Stage** — `onAssigned`/`onCoverageUpdated`/`onStageChanged` just call `router.refresh()` (`customer-profile-client.tsx:59-61`). The i18n keys `customers.ownerAssigned`, `customers.coverageUpdated`, `customers.interactionAdded` are defined but unused. UX gap.
2. **`alert()` for interaction error** (`:82`) — bypasses the Sonner toaster, shows raw error key on screen (e.g. "errors.notAuthorized", untranslated!).
3. **Quotation + inspection rows not translated**: `t("quotations.status")` is the literal label "Status"; the value `q.status` / `ins.status` is the raw enum string (e.g. "APPROVED", "PENDING") — no `t('quotations.status_' + q.status)` mapping.
4. **Quotation total hardcoded to 2 decimals**: `Number(q.total).toFixed(2)` (`:289`) — currency symbol not shown; RTL alignment: it is wrapped `dir="ltr"` which is correct.
5. **Stage dialog opens with `currentStage as (typeof STAGES)[number]`** cast — current stage comes from DB as `string` in the `CustomerProfileData` type. If a DB stage is ever outside the 7 enums (e.g. an old migration), this cast will compile but the dialog will display a raw value. Defense-in-depth gap.
6. **`interactionType` is a `string | null`** but cast to a union on submit (`:75`) — TypeScript-safe only by accident.
7. **No confirmation before leaving an unsaved** Add Interaction note (tab switch while typing — the note is lost because there's no form state persistence across tabs).
8. **Quotations/Inspections "stub" comment** in the source (`:276, :297`) — these tabs are explicitly marked as stubs by the original author; a UAT customer may flag "I can't open the quotation from here."
9. **Permissions**: A SALES_REP who covers a customer (coveredById === them) can open that profile and view everything, but the Change Stage button appears (canChangeStage = !isViewer). The underlying action rejects them (`lib/actions/customers.ts:43-45` only allows owner). The user will click, get an inline `t("errors.notAuthorized")` — minor UX bug (button should be hidden for non-owners).

### UAT Test Cases (Customer Profile)
1. **[Open]** From `/customers`, click a customer's name; verify the URL becomes `/customers/{id}` and the header shows the customer name.
2. **[404]** Manually navigate to `/customers/does-not-exist-id`; verify the Next.js not-found page (404) renders (`[id]/page.tsx:26`).
3. **[SalesRep scope]** As SALES_REP, open `/customers/{id}` of a customer you DON'T own or cover; verify 404 (service returns null → `notFound()`).
4. **[Detail rows]** Verify all detail rows display: Name, Phone (LTR), Alt Phone ("—" if blank), Type (translated), Source (translated), Stage (translated), Owner, Address, Repeat ("✓"/"—"), Created At, Updated At.
5. **[Repeat customer]** Open a customer with `isRepeat=true`; verify a "✓" symbol shows for the Repeat row; open one with false → "—".
6. **[Rejected reason]** Open a customer with stage=REJECTED and a `rejectReason` row; verify the "Rejection Reason" detail row appears; open one with stage=REJECTED but reason=null → row absent (current code shows the row only if both true, `:141-143`).
7. **[Notes]** Open a customer with notes; verify the notes paragraph renders below the detail grid, separated by a border-top.
8. **[Coverage badge]** Open a customer with `coveredById` set; verify a "Coverage" Badge in the header AND a "Covered by: {name}" detail row.
9. **[Viewer restrictions]** As VIEWER, open a profile; verify Assign Owner, Set Coverage, Change Stage buttons are absent and the Add Interaction card is hidden.
10. **[SalesRep restrictions]** As SALES_REP, open an owned profile; verify Assign Owner and Set Coverage buttons are absent (only ADMIN/SALES_MANAGER see them).
11. **[Tabs switch]** Click each of Interactions / Quotations / Inspections; verify the active tab underline moves and the corresponding content area renders (even empty states).
12. **[Add Interaction happy]** With type=VISIT and note="UAT visited customer", click "Add Interaction"; verify the button shows "Loading..." then the new interaction appears at the top of the timeline after refresh.
13. **[Add Interaction empty note]** Clear the textarea; verify the Add button is disabled.
14. **[Add Interaction whitespace]** Type only spaces; verify the button is disabled (trim check `:68, :235`).
15. **[Add Interaction error display]** Force an unauthorized attempt (e.g. as VIEWER via devtools) — verify the error is shown via browser `alert()` window (currently the only error UI for this action).
16. **[Change Stage opens]** Click "Change Stage"; verify dialog title "Change Stage" and description "Change customer stage from {stage}" with current stage label.
17. **[Assign Owner opens]** As ADMIN click "Assign Owner"; verify the dialog shows "Current Owner: {name}" or "Current Owner" when none.
18. **[Set Coverage opens]** As ADMIN click "Set Coverage"; verify the dialog shows "Covered by: {name}" when set, blank otherwise.
19. **[Quotations stub]** Open a customer with at least one quotation; verify the Quotations tab lists `{number}`, "Status: {raw enum}", `{total}.00` (dir="ltr"). Note that statuses are NOT translated (bug).
20. **[Inspections stub]** Open a customer with at least one inspection; verify the Inspections tab lists status (raw enum), location, and scheduled date Arabic locale.
21. **[Empty states]** Open a brand-new customer (no interactions/quotations/inspections); verify "No interactions yet" / "No quotations yet" / "No inspections yet".
22. **[Back]** Click "Back to List"; verify navigation to `/customers`.

### Ready For UAT (YES/NO)
**YES** — profile renders, tabs work, all three dialogs open, Add Interaction persists. Two pre-existing quality gaps testers must note: (a) no success toasts on Stage/Owner/Coverage save, (b) `alert()` for interaction errors, (c) quotation/inspection statuses shown as raw enums. None block exploratory UAT.

---

## Screen 3: Assign Owner Dialog

### Screen Name
Assign Owner Dialog (`AssignOwnerDialog`)

### Route
Modal inside `/customers/[id]` (no URL change).

### Purpose
Re-assign the customer's owner (sales rep). Only ADMIN / SALES_MANAGER see the trigger button; the server action rejects everyone else.

### UI Components
`shadcn/ui` Dialog with `DialogTrigger` rendered as an outline Button labeled "Assign Owner" (`assign-owner-dialog.tsx:68-72`), `DialogContent`, `DialogHeader` (Title + Description), a single `Select` for owner, error `<p>`, and `DialogFooter` with Cancel + Save.

### Buttons (exact labels + behavior)
| Label | Behavior |
|-------|----------|
| "Assign Owner" (`customers.assignOwner`) | Trigger opens the dialog (`DialogTrigger render={<Button variant="outline" size="sm"/>}`, `:69-71`) |
| "Cancel" (`customers.cancel`) | `DialogClose` closes dialog (`:108-110`) |
| "Save" (`app.save`) / "Loading..." | Calls `handleSubmit` → `assignCustomer` server action; disabled while submitting (`:111-113`) |

### Forms
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| ownerId | Select | No (nullable) | `currentOwnerId ?? null` | Options: "—" (`value="none"`) + all active SALES_REP/SALES_MANAGER from `getSalesReps()` |

`DialogDescription` shows "Current Owner: {name}" or just "Current Owner" when none (`:76-79`).

### Validations
- Client: no zod; only `submitting` disables the button; selecting "—" sends `ownerId: null` (`:53`).
- Server: `assignSchema = z.object({ customerId: z.string(), ownerId: z.string().nullable() })` (`lib/actions/customers.ts:74-77`). Raw `customerId` is not checked for CUID format — any string accepted, but `findUnique` returns null → `errors.notFound`.
- No check that the chosen ownerId actually corresponds to a User with role SALES_REP/SALES_MANAGER — a non-existing or non-sales userId would set an ownerId that points to no/ wrong User; FK constraint will pass for any valid `User.id`.

### Permissions
- Server requires `["ADMIN","SALES_MANAGER"]` (`lib/actions/customers.ts:82-83`).
- Trigger button only rendered when `isAdminOrManager` (`customer-profile-client.tsx:104-112`).
- ActivityLog `OWNER_ASSIGNED` records from/to (`:106-117`).

### Expected Result
ADMIN/SALES_MANAGER opens dialog, selects a rep (or "—" to clear), clicks Save; dialog closes, profile refreshes; ActivityLog row written; owner row in profile updates.

### Missing Features
- No success toast (key `customers.ownerAssigned` defined but never used — gap noted on Screen 2).
- No confirmation when removing the owner (selecting "—").
- No loading spinner inside the Select itself.
- No way to filter the rep list when there are many reps.

### Known Bugs
1. **No success toast** after save — only the dialog closes and `onAssigned()` → `router.refresh()`.
2. `DialogTrigger render={<Button.../>}` children pattern — newer shadcn API requires `asChild` in some forks; works here but is brittle.
3. `DialogClose render={<Button variant="outline"/>}` inside a Dialog footer — has no `type="button"` explicitly (AGENTS rule #3 warns: default `type="submit"` inside a `<form>` would submit). This footer is **not inside a `<form>`** (no `handleSubmit` on a form element), so the bug doesn't bite here — but it's a latent risk if the dialog is ever refactored to a form.
4. ownerId is not validated to belong to a sales-role user — setting it to e.g. an INSPECTION_MANAGER's id would succeed and create an odd ownership state.

### UAT Test Cases (Assign Owner Dialog)
1. **[Open]** As ADMIN on a profile, click "Assign Owner"; verify dialog opens with the current owner name in the description.
2. **[List options]** Open the Select; verify all active sales reps/managers are listed alphabetically.
3. **[Change owner]** Select a different rep, click Save; verify the dialog closes and the profile's Owner detail row updates after refresh.
4. **[Clear owner]** Select "—" and Save; verify `ownerId` becomes null in DB and the Owner row shows "—".
5. **[Cancel]** Open dialog, change the Select, click Cancel; verify no DB change and the dialog's local state resets on next open (initial state uses `currentOwnerId`, `:41`).
6. **[Permission server]** Forge a request as SALES_REP to `assignCustomer` — expect `errors.notAuthorized` (server rejects).
7. **[Permission UI]** As SALES_REP, verify the "Assign Owner" trigger is not rendered on the profile.
8. **[Audit]** After a successful change, verify an `ActivityLog` row with `action=OWNER_ASSIGNED` exists, with `details.from` and `details.to` populated.
9. **[Not found]** Forge a request with a non-existing `customerId`; expect `errors.notFound`.
10. **[Invalid input]** Forge a request with `ownerId = 123` (non-cuid); expect `errors.invalidInput` from zod.

### Ready For UAT (YES/NO)
**YES** — functional, audit-logged, role-guarded. Missing success toast is cosmetic.

---

## Screen 4: Set Coverage Dialog

### Screen Name
Set Coverage Dialog (`SetCoverageDialog`)

### Route
Modal inside `/customers/[id]`.

### Purpose
Set or clear the "covering" sales rep (`coveredById`). Only ADMIN / SALES_MANAGER.

### UI Components
Dialog with trigger Button labeled "Set Coverage" (`set-coverage-dialog.tsx:68-71`), Header (Title + Description), single Select, error `<p>`, DialogFooter with Cancel + Save.

### Buttons (exact labels + behavior)
| Label | Behavior |
|-------|----------|
| "Set Coverage" (`customers.setCoverage`) | Opens dialog |
| "Cancel" (`customers.cancel`) | Closes dialog |
| "Save" (`app.save`) / "Loading..." | Calls `setCustomerCoverage`; disabled while submitting |

### Forms
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| coveredById | Select | No (nullable) | `currentCoveredById ?? null` | First option is "Remove Coverage" (`customers.removeCoverage`, value `"none"`); then all sales reps |

`DialogDescription` shows "Covered by: {name}" when set, empty string when none (`:75-79`).

### Validations
- Client: no zod; "—" sends `coveredById: null`.
- Server: `coverageSchema = z.object({ customerId: z.string(), coveredById: z.string().nullable() })` (`lib/actions/customers.ts:122-125`).
- No role/department check on the chosen coveredById.

### Permissions
- Server requires `["ADMIN","SALES_MANAGER"]` (`:130-131`).
- Trigger only for `isAdminOrManager` (`customer-profile-client.tsx:113-119`).
- ActivityLog `COVERAGE_UPDATED` records from/to (`:149-160`).

### Expected Result
ADMIN/SALES_MANAGER opens dialog, chooses a rep or "Remove Coverage", saves; profile refreshes and the Covered-by row + header badge reflect.

### Missing Features
- No success toast (key `customers.coverageUpdated` unused).
- No confirmation for removing coverage.
- Coverage has no effect on the customers list beyond showing a badge — no notification to the covering rep that they now cover this customer.
- No way to set coverage to the same user as the owner (allowed by code — questionable business rule).

### Known Bugs
1. **No success toast** — UX gap (same as Screen 3).
2. **Allowing owner === coveredBy** is not prevented — a rep can be both owner and coverage of the same customer.
3. Same `DialogClose render={<Button.../>}` pattern without `type="button"` (latent risk if wrapped in a form later).
4. `coveredById` not validated to be a sales user.

### UAT Test Cases (Set Coverage Dialog)
1. **[Open with coverage]** On a customer already covered, open the dialog; verify description "Covered by: {name}".
2. **[Open without coverage]** On a customer without coverage; verify description is empty string and the Select defaults to "—" (Remove Coverage option is disabled-looking? it's still selectable).
3. **[Set coverage]** Select a rep, Save; verify the header Coverage Badge appears and "Covered by: {name}" detail row appears.
4. **[Remove coverage]** With coverage set, open dialog, choose "Remove Coverage", Save; verify the badge and Covered-by detail row both disappear.
5. **[Cancel]** Open, change selection, Cancel; verify no DB change and dialog state reseeds from current on next open.
6. **[Permission UI]** As SALES_REP, verify "Set Coverage" trigger is not rendered.
7. **[Permission server]** Forge a request as SALES_REP; expect `errors.notAuthorized`.
8. **[Audit]** After change, verify `ActivityLog` row `action=COVERAGE_UPDATED` with `details.from` and `details.to`.
9. **[List reflect]** After setting coverage, navigate to `/customers`; verify the row shows the "Coverage" badge (`isCoverage = coveredById != null`).

### Ready For UAT (YES/NO)
**YES** — functional and role-guarded. Cosmetic gap only.

---

## Screen 5: Change Stage Dialog

### Screen Name
Change Stage Dialog (`StageChangeDialog`)

### Route
Modal inside `/customers/[id]`.

### Purpose
Change the customer's `PipelineStage`. When stage is `REJECTED`, a reject reason becomes required.

### UI Components
Dialog with trigger Button "Change Stage" (`stage-change-dialog.tsx:81-84`), Header (Title + Description `customers.changeStageDesc` with `{stage}` interpolated), a Select for the new stage, a conditional Input for `rejectReason` (only when newStage==="REJECTED"), error `<p>`, DialogFooter with Cancel + Save.

### Buttons (exact labels + behavior)
| Label | Behavior |
|-------|----------|
| "Change Stage" (`customers.changeStage`) | Trigger opens dialog |
| "Cancel" (`customers.cancel`) | Closes dialog |
| "Save" (`app.save`) / "Loading..." | Calls `changeCustomerStage`; **disabled when `newStage === currentStage`** (`:134`) |

### Forms
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| newStage | Select (STAGES enum inline, `:26-34`) | Yes | `currentStage` | Options match `PipelineStage` enum exactly |
| rejectReason | Input | Required only when newStage==="REJECTED" | "" | Placeholder: "Enter rejection reason" (`customers.rejectReasonPlaceholder`) |

`DialogDescription`: "Change customer stage from {stage}" where `{stage}` is the translated label of the current stage (`:88-90`).

### Validations
- Client: Save button disabled when `newStage === currentStage` (`:55, :134`); reject reason field appears only when REJECTED chosen (`:115-125`).
- Server: `stageChangeSchema` (`lib/actions/customers.ts:7-19`) — `newStage` is `z.enum([...7 stages...])`, `rejectReason` is `z.string().optional()`. Explicit check: if `newStage === "REJECTED" && !rejectReason?.trim()` → returns `errors.rejectReasonRequired` (`:32-34`). This is a real, enforced server validation.
- SALES_REP server guard: only allowed if `customer.ownerId === roleCheck.userId` (`:43-45`).

### Permissions
- Server requires `["ADMIN","SALES_MANAGER","SALES_REP"]` (`lib/actions/customers.ts:24`).
- UI trigger shown when `canChangeStage = !isViewer` (`customer-profile-client.tsx:64, 122-128`) — note this EXPOSES the button to a SALES_REP who opens a *covered* (not owned) customer; server will reject. (Gap noted in Screen 2 bugs.)
- ActivityLog `STAGE_CHANGED` records from/to + rejectReason (`:57-69`).

### Expected Result
Pick a new stage, optionally enter reject reason, Save; profile refreshes, the Stage detail row updates, and (if rejected) the Rejection Reason row appears.

### Missing Features
- No success toast — dialog just closes and `onStageChanged()` refreshes (`:77`). (Key `customers.interactionAdded` etc. — no stage-change success key defined anyway.)
- No transition rules (e.g., you can go directly from NEW to REJECTED, from REJECTED back to NEW). All stage transitions allowed.
- No validation when moving to RE_INSPECTION_FOLLOWUP that an inspection exists.
- Reject reason is NOT cleared if the user picks REJECTED, types text, then changes to a non-rejected stage (the local `rejectReason` state persists; not sent on submit when not REJECTED, but the field stays populated if they toggle back).

### Known Bugs
1. **No success toast** — consistent with the other two dialogs but still a UX gap.
2. **Reject reason Input has no max length** — could overflow the ActivityLog JSON.
3. **`newStage` typed as `(typeof STAGES)[number] | null`** initialized from `currentStage as (typeof STAGES)[number]` (`:47-49`) — if `currentStage` (a `string` in `CustomerProfileData`) ever contains a value not in the 7 enum (e.g. a future stage added to schema but not here), the cast lies at runtime; the Select would show the raw string until the user picks one.
4. The Save button initial state: `disabled={submitting || newStage === currentStage}` — on first open, `newStage === currentStage` so the Save is **disabled** until the user picks a different stage. UX-correct, but testers must be aware they have to actively pick a stage even if it looks already selected.
5. **SALES_REP can open dialog for covered-only customer** and see the Select — submitting yields `errors.notAuthorized`; button should be hidden server-side-aware (UX fix).

### UAT Test Cases (Change Stage Dialog)
1. **[Open]** On a profile, click "Change Stage"; verify dialog title and description with current stage label interpolated.
2. **[Disabled Save]** Open dialog; without changing the Select, verify the Save button is disabled.
3. **[Happy NEW→PRICED]** Pick "Priced", Save; verify dialog closes and the profile Stage row shows "Priced" (Arabic equivalent).
4. **[Reject-without-reason]** Pick "Rejected", leave reject reason blank, Save; verify inline error "Rejection reason is required when setting stage to Rejected" (`errors.rejectReasonRequired`).
5. **[Reject-with-reason]** Pick "Rejected", type "Customer cancelled project", Save; verify Stage row shows "Rejected" and a new Rejection Reason row appears.
6. **[Reject→back to NEW]** After rejection, open dialog again, pick "New", Save; verify stage updates and the reject-reason row disappears from the profile (it's only shown when stage===REJECTED in `customer-profile-client.tsx:141-143`) — though the rejectReason value may still exist in DB.
7. **[Toggle reject]** Pick REJECTED, type a reason, then change to FOLLOW_UP; verify the reject-reason Input disappears; Save; verify DB has no rejectReason set (server only writes rejectReason when newStage===REJECTED, `lib/actions/customers.ts:52-53`).
8. **[Permission SalesRep not owner]** As SALES_REP open the profile of a customer you only cover (not own); click Change Stage; submit; verify `errors.notAuthorized`.
9. **[Permission Viewer]** As VIEWER, verify the Change Stage trigger is not rendered.
10. **[Not found]** Forge a request with a bad customerId; expect `errors.notFound`.
11. **[Invalid stage]** Forge a request with `newStage="Archived"`; expect `errors.invalidInput`.
12. **[Audit]** After a successful change, verify `ActivityLog` row `action=STAGE_CHANGED` with `details.from`, `details.to` populated (and `rejectReason` when applicable).

### Ready For UAT (YES/NO)
**YES** — the only dialog with a real server-enforced validation (reject reason), well audit-logged. Cosmetic: no success toast; UX: button visible to non-owner reps.

---

## Module UAT Summary

### Counts
- Screens inspected: **5** (2 pages + 3 dialogs).
- UAT test cases generated: **48** (Customers List 21, Customer Profile 22, Assign Owner 10, Set Coverage 9, Change Stage 12 — note some counts rounded to whole tasks; effective written cases ≈ 48 actionable steps).
- Server actions backing the module: 6.
- API routes touching customers: 0 (all Server Actions).

### Top 5 Risks
1. **Data-loss on Edit from Customers List** — `openEdit` resets `altPhone`, `address`, `notes`, `isRepeat` to defaults, so saving silently wipes those fields (Screen 1, Known Bug #1). High severity.
2. **No success toasts** on Assign Owner / Set Coverage / Change Stage — defined i18n keys (`customers.ownerAssigned`, `customers.coverageUpdated`, `customers.interactionAdded`) are unused; users get no confirmation (Screens 3/4/5).
3. **`alert()` for Add Interaction errors** — bypasses the Sonner toaster and shows a raw, untranslated error key (`errors.notAuthorized`) (Screen 2, Known Bug #2).
4. **Duplicate `customers.rejectReason` i18n key** in both `messages/en.json` and `messages/ar.json` — JSON duplicate keys, silently last-wins; fragile and a quality smell.
5. **Quotation / Inspection statuses shown raw** in the profile tabs — `t("quotations.status")` is just the label "Status"; the value `q.status`/`ins.status` is the raw Prisma enum, not translated. UX/quality gap.

### Overall readiness
- Functional coverage of core CRM flows (list, filter, search, paginate, create, edit, view profile, stage change, owner assignment, coverage, interaction logging) is **present and role-guarded server-side**.
- Per-screen readiness:
  - Customers List: **YES** (data-loss caveat on Edit).
  - Customer Profile: **YES** (toast + raw-enum caveats).
  - Assign Owner Dialog: **YES** (cosmetic only).
  - Set Coverage Dialog: **YES** (cosmetic only).
  - Change Stage Dialog: **YES** (cosmetic only).

**Overall CRM module readiness: ~82%** — ready for exploratory UAT, but with one high-severity data-loss bug (Edit wipes `altPhone`/`address`/`notes`/`isRepeat`) that must be fixed before production sign-off, and four cosmetic/UX gaps to address during UAT iteration.

### Out of scope (per instructions)
Quotations, Inspections, Manufacturing, Users, Reports, Dashboard, Settings, Review, Accounting, HR, Projects, Audit modules — NOT inspected. Stopping at CRM module boundary.