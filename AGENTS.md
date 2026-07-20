<!-- BEGIN:nextjs-agent-rules -->
# Next.js version note

This project uses Next.js 15.3.4 (App Router, Turbopack) — verified, not 16.
If any generated code or cached documentation suggests v16 APIs, ignore it.
<!-- END:nextjs-agent-rules -->

---
> 🔴 **BACKLOG.md هو المرجع المُلزِم الأوحد (STD-04).** اقرأه قبل أي مهمة — قسم "قرارات محسومة" لا اجتهاد فيه. هذا الملف **مشتقّ منه** — عند أي تعارض، BACKLOG يعلو.
>
> - **حالة الـschema (migrations · tags · SCR النافذة):** المرجع النافذ **`CLAUDE.md §7` + `BACKLOG.md`** — لا تُقرأ من هذا الملف (أقسامه أدناه مجمّدة عند Phase 1).
> - **سلاسل الاعتماد · الأدوار · الخصم:** النافذ في **BACKLOG قرارات محسومة (D-xx)** — لا هنا.
> - **الأرشيف (`archive/`, `docs/reference/`):** ملفات تاريخية ملغاة أو بيانات مرجعية — **لا تُقرأ ولا تُفهرَس إلا إذا طُلب صراحة بالاسم**.

## أدوات جاهزة — لا تعيد اختراعها
- `/preflight` — بوابة ما قبل UAT: يفحص الكل، PASS/FAIL بالدليل، مايغيّرش حاجة.
- `/money-audit` — تدقيق Decimal/VAT/الخصومات/العقود.
- `/rbac-audit` — تدقيق الصلاحيات وسلسلة الاعتماد.
- `/dead-schema` — يلاقي أعمدة/enums ميتة في الـ schema.
- 7 subagents متخصصين (قراءة فقط) بيتفعّلوا تلقائيًا حسب السياق — سقف 3 في نفس الوقت (STD-18).

# EgyGlass ERP — Agent Rules (Ground Truth)

## Stack (verified)
| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 15.3.4** (App Router, Turbopack) | NOT 16. Verified via build/runtime repeatedly. |
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

## Schema — FROZEN (الحالة النافذة: CLAUDE.md §7 + BACKLOG)
The Prisma schema is the single source of truth. Do NOT edit it — changes go through Youssif on main via a Schema Change Request (`SCHEMA-CHANGE-REQUESTS.md`).
🔴 **حالة الـschema النافذة (migrations · tags · SCR) في `CLAUDE.md §7`** — القائمة أدناه مجمّدة عند Phase 1 وتاريخية. آخر tag نافذ: `schema-scr018-done` (migration 29). SCR-010→018 غير مذكورة أدناه — راجع CLAUDE.md §7.

**Roles (enum Role) — 14 exact values.** Full authoritative table lives in CLAUDE.md §3 — do not
duplicate/maintain a separate list here to avoid drift:
ADMIN, SALES_MANAGER, SALES_REP, INSPECTION_MANAGER, INSPECTION_REP, VIEWER, REVIEW,
PROCUREMENT, INSTALLATIONS, ACCOUNTING, HR, PROJECTS, TECHNICAL_OFFICE, TEC_APPROVER.
No `QUALITY_REVIEW`. No `INS_MANAGER`/`PRJ_MANAGER`/`INSTALLATION` (singular).

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
- Build: `docker compose exec app npm run build` (NODE_ENV is no longer forced — removed from docker-compose.yml; Next.js sets it automatically per command).
- The `prisma migrate dev` command can reset data — use with care. DB is in a named volume (`egyglass_db_data`) so rebuilds preserve data.
- Never run `docker system prune` or `docker volume prune`.

## Git
- No secrets in commits. `.env` is gitignored — verify before every commit.
- Foundation commit exists: `d109648`. Tag `foundation-done` marks end of Phase A.
- 🔴 **حالة الـschema النافذة في `CLAUDE.md §7`** — آخر tag: `schema-scr018-done` (migration 29). Phase 1 (`schema-phase1-done`) كان أول تجميد؛ تلته SCR-010→018. The schema is FROZEN — no agent edits it; changes go through Youssif on main via `SCHEMA-CHANGE-REQUESTS.md`.

## Dev environment rules
- Project lives at `E:\Projects\EgyGlass_ERP_New_Build` (local machine — NOT under OneDrive).
- **Turbopack-in-Docker does NOT auto-detect new route/action files.** After creating any new route file, server action, or API handler, run `docker compose restart app` before testing. The dev server itself hot-reloads edits to existing files — only *new* files need a restart.
- Build: `docker compose exec app npm run build` — no `-e NODE_ENV=...` needed; root cause (forced NODE_ENV in docker-compose.yml) is fixed.

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

### SCR-010→018 — (تفاصيلها النافذة في CLAUDE.md §7 + BACKLOG)
🔴 لا تُكرَّر تفاصيل الـschema هنا (تجنّب الانحراف — كما في §Roles).

**قاعدة RBAC ملزِمة باقية (SCR-010، مُنفَّذة):**
مهندس `TECHNICAL_OFFICE` لا يعتمد رسمته — فعل الاعتماد يفحص `session.role == TEC_APPROVER` خادميًا. `TEC_APPROVER` لا يرث صلاحيات `TECHNICAL_OFFICE`؛ الدوران منفصلان (D-02). الأدوار مجرّدة — لا أسماء أفراد في الschema.

**دورة حياة المستخدم:** DEACTIVATE لا DELETE (`isActive=false` + `deletedAt`).

للتفاصيل الكاملة (النماذج · العلاقات · سياسة onDelete · السلاسل النافذة): **CLAUDE.md §7 + BACKLOG قرارات محسومة**.