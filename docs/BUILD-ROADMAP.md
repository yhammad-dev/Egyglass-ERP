> ⚠️ **تحديث الحقيقة (Reconciliation):** هذا الملف من النطاق الأولي (6 يونيو 2026).
> **مصادر الحقيقة المحدّثة (تتجاوز أي تعارض هنا):** AGENTS.md + SCHEMA-CHANGE-REQUESTS.md +
> NON-COLLISION-PROTOCOL.md + docs/quotation-math.md.
> تحديدًا تجاوز ما يلي:
> - **Next.js 16** (وليس 15).
> - **الـ schema مطبّق فعليًا** (CR-01→10، tag `schema-phase1-done`) — ليس "as-is".
> - **Stream D = المراجعة + الأدمن**، والـ Dashboard يُبنى آخرًا منفصلًا.
> - **التسعير:** خصم تفاوضي (18→25%) + كاش باك إحالة متدرّج — راجع docs/quotation-math.md.

---

# BUILD ROADMAP — EgyGlass ERP MVP

> Ordered execution plan for OpenCode. Two phases:
> **Phase A (Foundation)** = ONE agent, sequential. Builds the shared base.
> **Phase B (Features)** = up to 4 parallel agents, each on its own git worktree/branch.
>
> Before any step, read `AGENTS.md`, `docs/MVP-SPEC.md`, `prisma/schema.prisma`.
> If you are a parallel agent, also read `MULTI-AGENT.md` and stay inside the files your
> stream owns.
>
> **All commands run inside Docker.** Wherever this doc says `npm run build`, `npm run dev`,
> or `npx prisma ...`, run it inside the app container, e.g.
> `docker compose exec app npm run build`. See AGENTS.md §5b. After each milestone, run the
> build and confirm it passes.

---

# PHASE A — FOUNDATION (single agent, must finish first)

## Milestone 0 — Project scaffold (Docker-based)
> Environment is Docker. `docker-compose.yml`, `Dockerfile`, `.dockerignore`, `.env.example`
> are already provided. Do not install Node/PostgreSQL on the host.
1. Create a Next.js 16 app **in the repo root** (App Router, TypeScript, Tailwind, ESLint, `src/` dir).
   The app must run inside the `app` container defined in `docker-compose.yml`.
2. Install (these go into package.json; they install inside the container):
   `prisma @prisma/client`, `next-auth@beta`, `react-hook-form zod @hookform/resolvers`,
   `@tanstack/react-table`, `bcryptjs`, an i18n lib (`next-intl`), and shadcn/ui.
3. Configure Tailwind for **RTL** (default dir rtl + an Arabic font such as Cairo/Tajawal).
4. Copy `.env.example` to `.env` (values already match docker-compose for dev).
5. Bring the stack up: `docker compose up -d`. Then run migrations & generate inside the container:
   `docker compose exec app npx prisma migrate dev --name init`
   `docker compose exec app npx prisma generate`
   (Use the provided `prisma/schema.prisma` as-is.)
6. Create a seed script (`prisma/seed.ts`): one ADMIN user + demo data (5 customers, 2 quotations,
   3 inspections). Run it: `docker compose exec app npx prisma db seed`.
- ✅ **DoD:** `docker compose up` works, app reachable at http://localhost:3100, DB connected, seed worked.

## Milestone 1 — Auth + RBAC + shared shell
7. Configure Auth.js (credentials provider) with bcrypt. Arabic login page.
8. Middleware protecting all routes (redirect to login if unauthenticated).
9. Create `requireRole(roles[])` helper for server actions + a `can(user, action)` helper.
10. Build the shared app shell: dashboard layout, RTL nav/sidebar, i18n setup, and a
    **navigation registry** (`src/lib/nav.ts`) so feature streams add their own links
    without editing core files (see `MULTI-AGENT.md`).
11. User management screen (ADMIN only): add/disable employee, assign role & department.
- ✅ **DoD:** logging in as different roles shows different permissions; the backend
  rejects unauthorized actions. **This is the freeze point** — tag/commit it.

---

# PHASE B — FEATURES (parallel agents after Phase A is merged)

> Each stream owns a route group under `src/app/(dashboard)/<module>/` and a service
> file `src/lib/services/<module>.ts`. The Prisma schema is FROZEN — do not edit it.

## Stream A — Customers, Pipeline, Interactions  (owner: agent-a)
A1. Customers list: TanStack table with filters (type/source/rep/stage) + name/phone search + pagination.
A2. Create/edit customer (react-hook-form + zod). SALES_REP sees own customers only.
A3. Customer profile (Customer 360): data + tabs (interactions, quotations, inspections).
A4. Pipeline movement: change stage with ActivityLog entry. REJECTED forces a reject reason and stops follow-up.
A5. Assign customers to reps (SALES_MANAGER) + absence coverage (coveredById).
A6. Interactions: add follow-up (type + note), show as a dated timeline on the profile.
- ✅ **DoD:** full customer lifecycle works with permissions and logging.

## Stream B — Quotations  (owner: agent-b)  ← most math-sensitive
B1. Create quotation: add items (desc/qty/unit price); totals computed **server-side**.
B2. Discount & cashback engine — implement EXACTLY per docs/quotation-math.md (negotiated discount, configurable base/max, referral cashback, VAT from settings).
B3. Discount above base → DiscountRequest (PENDING); approver (Amr/delegate) may APPROVE/REJECT/ADJUST per quotation-math.md.
B4. 3-day validity: auto-compute `validUntil`; mark EXPIRED after it passes.
B5. Auto serial quotation number. "WhatsApp text" button generates copy-ready quote text (no API).
- ✅ **DoD:** all numbers match `docs/quotation-math.md`; approval & validity work.

## Stream C — Inspections  (owner: agent-c)
C1. Create inspection request from a customer: location (inside/outside Cairo), address, phone, photos.
C2. Auto-compute `dueDate` per SLA (2 business days inside / 3–4 outside) — skip weekends.
C3. Colored SLA indicator (green/amber/red) + auto-mark OVERDUE.
C4. Schedule inspection (date + assigned inspector) — INSPECTION_MANAGER. List/calendar view.
C5. Upload site photos (Attachment) per request.
- ✅ **DoD:** full inspection request with SLA, photos, scheduling works.

## Stream D — Dashboard & Reports  (owner: agent-d)  ← start last; read-only
D1. Dashboard: KPIs (new customers, active quotations, inspections due/overdue) + pipeline chart.
D2. Simple reports: rep performance, customers by source, rejection analysis, inspections done/overdue.
- ✅ **DoD:** numbers match actual DB data. (Stream D depends on A/B/C data shapes; run it
  after at least A is merged, or stub its queries first.)

---

# PHASE C — INTEGRATION & POLISH (single agent, after all streams merged)
P1. Review RTL & i18n (no hardcoded strings). Empty states + Arabic error messages.
P2. Verify every write hits ActivityLog. Manually test the full RBAC matrix.
P3. Clean `npm run build` + a run README + demo screenshots.
- ✅ **DoD:** all "Definition of Done" items in MVP-SPEC are complete.

---

## Execution notes for OpenCode
- Obey the frozen schema. Any DB change goes through the schema-owner process in `MULTI-AGENT.md`.
- Financial math is **always** server-side and uses Decimal (never float).
- Start every server action with permission check + zod validation.
- Build incrementally and test after each milestone.
