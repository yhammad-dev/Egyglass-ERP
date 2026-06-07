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
| ORM | **Prisma** + PostgreSQL | Docker volume `postgres_data` on `db:5432` |
| DB superuser | **egyglass** (NOT postgres) | Set via `POSTGRES_USER` in docker-compose |
| i18n | **next-intl v4** | `createNextIntlPlugin("./src/i18n/request.ts")` in `next.config.ts` |
| UI library | **shadcn/ui v4** | Components at `src/components/ui/` (see §forms) |
| Forms | **react-hook-form** + **zod** | See §forms for the single standard pattern |
| Tables | **@tanstack/react-table** | |
| Styling | **Tailwind v4** | RTL-first (`dir="rtl"` in root layout) |
| Language | **Arabic** (ar) primary, English (en) secondary | |

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

## Docker
- All commands run inside the `app` container: `docker compose exec app <cmd>`.
- Build with production env: `docker compose exec -e NODE_ENV=production app npm run build`.
- The `prisma migrate dev` command can reset data — use with care. DB is in a named volume (`postgres_data`) so rebuilds preserve data.
- Never run `docker system prune` or `docker volume prune`.

## Git
- No secrets in commits. `.env` is gitignored — verify before every commit.
- Foundation commit exists: `e59e72b`. Tag `foundation-done` marks end of Phase A.
