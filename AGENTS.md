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