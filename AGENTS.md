<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# EgyGlass ERP — Agent Rules (Ground Truth)

## Stack (verified)
| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16** (App Router, Turbopack) | NOT 15. Check docs in `node_modules/next/dist/docs/` |
| Auth | **Auth.js v5** (credentials) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| ORM | **Prisma** + PostgreSQL | Docker volume `egyglass_db_data` on `db:5432` |
| DB superuser | **egyglass** (NOT postgres) | Set via `POSTGRES_USER` in docker-compose |
| i18n | **next-intl v4** | `createNextIntlPlugin("./src/i18n/request.ts")` in `next.config.ts` |
| UI library | **shadcn/ui v4** | Components at `src/components/ui/` (see §forms) |
| Forms | **react-hook-form** + **zod** | See §forms for the single standard pattern |
| Tables | **@tanstack/react-table** | |
| Styling | **Tailwind v4** | RTL-first (`dir="rtl"` in root layout) |
| Language | **Arabic** (ar) primary, English (en) secondary | |
| Project path | **`E:\Projects\EgyGlass_ERP_New_Build`** | Local machine, NOT OneDrive |

## Forms — Single Standard Pattern (MANDATORY)
All feature streams MUST use this exact pattern. No variations.

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// --- 1. Schema ---
const formSchema = z.object({
  name: z.string().min(1, "الحقل مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
})
type FormData = z.infer<typeof formSchema>

// --- 2. Shared FieldError helper ---
// Place in src/components/ui/field-error.tsx if used by multiple streams.
function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-red-500 mt-1">{message}</p> : null
}

// --- 3. Form component ---
export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  return (
    <form onSubmit={handleSubmit((data) => { /* server action */ })}>
      <div className="space-y-1">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>
      <button type="submit">حفظ</button>
    </form>
  )
}
```

Rules:
- Zod schema FIRST, type inferred via `z.infer`.
- `resolver: zodResolver(formSchema)` on `useForm`.
- Every input gets a `<Label>` + `<FieldError>` sibling.
- Strings go through i18n (next-intl `useTranslations()`) — above shows inline for brevity.
- Server action receives validated data — re-validate with the same zod schema server-side.

## RBAC (server-side only)
- Every server action starts with `requireRole([...])` from `src/lib/rbac.ts`.
- Hiding a UI element is NOT security. The backend must reject non-permitted roles.
- ActivityLog entry required on every create/update/delete.

## Schema — Phase 1 (FROZEN at `schema-phase1-done`)
The Prisma schema is the single source of truth. Do NOT edit it (see SCHEMA-CHANGE-REQUESTS.md).

**Roles (enum Role):** ADMIN, SALES_MANAGER, SALES_REP, INSPECTION_MANAGER, REVIEW, VIEWER.

**Core models:** User, Customer, Interaction, Quotation, QuotationItem, InspectionRequest, Attachment, ActivityLog.

**Phase 1 additions:**
- `InspectionRequest.type` (InspectionType: PRICING | EXECUTION).
- `Quotation` review fields (ReviewStatus: PENDING_REVIEW | APPROVED | RETURNED) + `quotationType` (QuotationType: INITIAL | FINAL) + `previousQuotationId`.
- `DiscountRequest` model (DiscountRequestStatus: PENDING | APPROVED | REJECTED | ADJUSTED) — negotiated discount approvals.
- `SystemSettings` (singleton) — configurable: discount limits, VAT, quotation validity, cashback toggle, company logo/name.
- `CashbackTier` — editable tiered cashback percentages.
- `Referral` (CashbackStatus: PENDING | ELIGIBLE | PAID | CANCELLED) — referral-based cashback per Amr's official rules.
- `PriceListItem` — central price engine read by the technical office.

## Docker
- All commands run inside the `app` container: `docker compose exec app <cmd>`.
- Build with production env: `docker compose exec -e NODE_ENV=production app npm run build`.
- The `prisma migrate dev` command can reset data — use with care. DB is in a named volume (`egyglass_db_data`) so rebuilds preserve data.
- Never run `docker system prune` or `docker volume prune`.

## Git
- No secrets in commits. `.env` is gitignored — verify before every commit.
- Foundation commit exists: `d109648`. Tag `foundation-done` marks end of Phase A.
- Phase 1 schema applied in 3 batches. Tag `schema-phase1-done` (`79b488d`) marks the frozen Phase 1 schema. The schema is FROZEN — see SCHEMA-CHANGE-REQUESTS.md. No agent edits the schema; changes go through Youssif on main.

## Dev environment rules
- Project lives at `E:\Projects\EgyGlass_ERP_New_Build` (local machine — NOT under OneDrive).
- **Turbopack-in-Docker does NOT auto-detect new route/action files.** After creating any new route file, server action, or API handler, run `docker compose restart app` before testing. The dev server itself hot-reloads edits to existing files — only *new* files need a restart.
- Build must use production env: `docker compose exec -e NODE_ENV=production app npm run build`.

## Messages & errors
- **All user-facing text** goes through i18n (next-intl `t()`). Never hardcode Arabic or English strings in components.
- **Namespace convention:**
  - `users.*` — UI labels, headings, placeholders for the users feature
  - Each feature stream uses its own namespace (e.g. `customers.*`, `quotations.*`, `inspections.*`, `dashboard.*`)
  - `errors.*` — shared, append-only namespace for reusable error messages, permission denials, and validation feedback. Never edit another stream's keys.
- **Server actions return error keys** (strings like `"errors.notFound"`), not translated messages. The client resolves them with `t()`.
- ActivityLog entries use plain descriptive Arabic text inline (not i18n keys — logs are not user-facing UI).

## RTL number & table rules (MANDATORY)
- **Latin numerals in RTL:** Any field with Latin digits (phone, email, amounts, codes) MUST be wrapped with `dir="ltr"` to prevent reversal in the RTL layout.
- **Numeric table columns:** The header (th) and value (td) must align together (right-aligned), with `direction:ltr` applied to the number itself only — so numbers stay under their column headers, not drifting to the far edge.

## Configurable business rules (MANDATORY)
- Any number/percentage that changes with market or company policy is NOT hardcoded. Read it from `SystemSettings` / `CashbackTier`, editable by Amr from the admin screen.
- Applies to: cashback tiers & count, discount limits (base/max), VAT, quotation validity days, effective dates.
- Every settings change writes to ActivityLog (who, when, old/new value) for audit.
## Verification & Quality — MANDATORY (learned from Stream A)

These rules are non-negotiable. They come from real failures. Violating them wastes the reviewer's time and breaks trust.

### 1. "Build green" is NOT proof it works
A green `next build` only means the code COMPILED. Prisma errors, `ReferenceError`s, and other runtime failures appear ONLY when the page actually loads. After building, you MUST load the affected page in the running app and confirm it returns **HTTP 200, not 500**. Report the REAL runtime result, not just the build status. Never claim "all pages respond" without actually loading them.

### 2. Use ONLY fields/relations that exist in the FROZEN schema
The schema is frozen at `schema-phase1-done`. Before using any Prisma relation or field, verify it EXISTS in `prisma/schema.prisma`. Do NOT assume a relation exists (e.g. assuming a `coveredBy` relation when only the scalar `coveredById` exists causes a runtime 500). If you genuinely need a schema change, STOP and write a Schema Change Request in `SCHEMA-CHANGE-REQUESTS.md` — never edit the schema yourself.

### 3. Every `<button>` inside a form needs an explicit `type`
A `<button>` with no `type` defaults to `type="submit"`. Inside a form this causes unintended submits (e.g. a checkbox that saves and closes the dialog on click). Any button that is NOT the save/submit button MUST have `type="button"`. This applies to custom UI components (checkbox, toggle, icon buttons) too.

### 4. Define every variable before using it
Do not reference a variable that was never declared (e.g. using `isViewer` without `const isViewer = currentRole === "VIEWER"`). This compiles in some cases but throws `ReferenceError` at runtime. Trace every identifier you use back to its declaration.

### 5. Stay strictly within your stream's scope
Build ONLY your stream's tasks. Do NOT build, suggest, or list work belonging to other streams (Quotations, Inspections, Dashboard, Settings, etc. are other streams). When your tasks are done, STOP — do not propose next modules.

### 6. Review existing code before you replace it
When editing a file that already contains working code from earlier tasks, read what is there FIRST. Do not overwrite or revert working logic while adding new code (e.g. reverting a fixed coverage flag while building a later feature). Check before you replace.

### 7. Every `t()` key must exist in BOTH locale files
Any translation key you use MUST be added to both `messages/ar.json` and `messages/en.json`. A missing key throws `MISSING_MESSAGE` at runtime. After adding any user-facing text, self-check that the key exists in both files.

### 8. Enum/select triggers must show the translated label
A closed `<Select>` must display the translated label of the selected value, not the raw enum string (e.g. show "مهندس", not "ENGINEER"). Empty `<SelectValue />` falls back to the raw value — always resolve the label explicitly.

### 9. Stop at every checkpoint
After each task, STOP and wait for explicit approval before starting the next. Do not skip ahead. Report with evidence (real build output + confirmation the page loads).


### SCR-010 — Technical Office Domain (applied 2026-07-07, tag: schema-tec-scr010)

Three additive models on the frozen schema. Migration 20260707125459_tec_scr010.

**Models:**
- `QuotationRequest` (quotation_requests) — TEC job card. Three DISTINCT named
  User relations: engineer (TecEngineer), salesOwner (TecSalesOwner),
  inspectionOwner (TecInspectionOwner). 1:1 to Quotation (quotationId @unique)
  and to InspectionRequest (inspectionRequestId @unique — one inspection → one
  TEC job). technicalRoute is a DEDICATED field (PROJECTS/SOCIAL_MEDIA), NOT
  derived from CustomerSource.
- `Drawing` (drawings) — categorized files, two-state approval
  (approvedById/approvedAt). Cascade from parent job.
- `ExtraItem` (extra_items) — post-quotation cost items, routes to PROCUREMENT.

**New enums:** TecJobStatus, TechnicalRoute, DrawingCategory, DrawingFileType,
ExtraItemType.

**New Role values (Option C — Separation of Duties):**
- `TECHNICAL_OFFICE` — TEC engineers: create QuotationRequests, upload
  Drawings, add ExtraItems, re-price quotations.
- `TEC_APPROVER` — drawing approval ONLY (TEC-13). Distinct from `REVIEW`
  (Inspection Manager, PRC-11).

**MANDATORY RBAC RULE (enforce server-side in Phase 4):**
An engineer (TECHNICAL_OFFICE) may NOT approve their own drawings. The
approve action MUST check session.role == TEC_APPROVER server-side.
TEC_APPROVER does NOT inherit TECHNICAL_OFFICE privileges — roles are
distinct; grant both explicitly in User.role if one person needs both.
Roles are ABSTRACT — no named individuals in schema (Nouran/Amr assigned
in User table).

**onDelete policy (data-loss protection):**
- Restrict: Customer, Quotation (block delete while TEC job exists);
  Drawing.uploadedBy, ExtraItem.createdBy, ExtraItem.manufacturingOrder
  (audit/cost integrity).
- SetNull: all User owner FKs on QuotationRequest, Drawing.approvedBy,
  QuotationRequest.inspectionRequest (job survives deactivation).
- Cascade: Drawing → QuotationRequest (drawings die with parent job).
- User lifecycle is DEACTIVATE-not-delete (isActive=false + deletedAt).
  Restrict FKs never block a legitimate deactivation.