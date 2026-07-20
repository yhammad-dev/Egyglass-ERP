> ⚠️ **تحديث الحقيقة (Reconciliation):** هذا الملف من النطاق الأولي (6 يونيو 2026).
> **لتوزيع الـ streams والملكية، المصدر المحدّث هو NON-COLLISION-PROTOCOL.md + AGENTS.md.**
> تحديدًا تجاوز ما يلي هنا:
> - **Stream D = المراجعة + الأدمن** (REVIEW role, SystemSettings, اللوجو, الصلاحيات) — وليس Dashboard.
> - **الـ Dashboard يُبنى آخرًا** كمكوّن منفصل يقرأ من الكل (ليس stream متوازيًا من البداية).
> - **ترتيب الدمج:** A → C → B → D → ثم Dashboard.
> - الـ schema مطبّق فعليًا (CR-01→10، tag `schema-phase1-done`) — راجع SCHEMA-CHANGE-REQUESTS.md.

---

# MULTI-AGENT.md — Parallel build coordination

> Read this if you are one of several agents working on this repo at the same time.
> The goal is speed **without** agents stepping on each other's files.

---

## 1. Golden rules

1.  **Foundation first.** Phase A (Milestones 0–1) is built by ONE agent, alone,
   sequentially. No parallel work until Phase A is committed and tagged `foundation-done`.
2.  **One stream = one worktree = one branch.** Never run two agents in the same working copy.
3.  **Stay in your lane.** Only edit files your stream owns (see the ownership map below).
4.  **The Prisma schema is FROZEN** after Foundation. Do not edit `prisma/schema.prisma`.
   If a stream genuinely needs a schema change, STOP and request it (section 4).
5.  **Rebase often, merge small.** Pull `main` into your branch frequently; open a PR per milestone.
6.  **⚠️ `prisma migrate dev` can reset data.** The DB is on a named Docker volume
   (`egyglass_db_data`) so container rebuilds won't wipe it, but running `migrate dev --name x`
   may drop columns or restart the migration history. Prefer `prisma migrate deploy`
   for applying existing migrations without risk. If a new migration is unavoidable,
   ensure the database is backed up first.
7.  **🌀 Turbopack restart.** After you create any new route file, server action, or API
   handler inside your stream, restart the dev server with `docker compose restart app`
   before testing. Turbopack inside Docker doesn't auto-detect new files — edits to
   *existing* files hot-reload fine, but new files require a restart.

---

## 2. Git setup (worktrees)

After Phase A is merged to `main`:

```bash
# from the repo root, create one worktree per stream
git worktree add ../egyglass-stream-a -b stream/customers
git worktree add ../egyglass-stream-b -b stream/quotations
git worktree add ../egyglass-stream-c -b stream/inspections
git worktree add ../egyglass-stream-d -b stream/dashboard
```

Run one OpenCode agent inside each worktree folder. Each agent works only on its branch.
Merge each branch back to `main` via PR as milestones complete. Resolve conflicts on
shared files (rare if ownership is respected) by re-pulling `main` first.

---

## 3. File ownership map

| Path | Owner | Notes |
|------|-------|-------|
| `prisma/schema.prisma` | **Foundation only** | FROZEN after Phase A |
| `src/app/layout.tsx`, app shell, `src/lib/auth*`, `src/lib/rbac*`, `src/lib/prisma.ts` | **Foundation only** | Feature streams must not edit |
| `src/lib/nav.ts` (navigation registry) | shared, **append-only** | each stream adds its own entry; never delete others' |
| `src/app/(dashboard)/customers/**`, `src/lib/services/customers.ts` | Stream A | |
| `src/app/(dashboard)/quotations/**`, `src/lib/services/quotations.ts` | Stream B | |
| `src/app/(dashboard)/inspections/**`, `src/lib/services/inspections.ts` | Stream C | |
| `src/app/(dashboard)/dashboard/**`, `src/app/(dashboard)/reports/**`, `src/lib/services/reports.ts` | Stream D | read-only queries |
| `src/components/ui/**` (shadcn) | shared, **append-only** | add new components; don't rewrite shared ones |
| `messages/*.json` (i18n) | shared, **append-only** | each stream adds its own keys under its own namespace |

**Append-only shared files** are the main conflict source. Rule: only ADD your block,
never reorder or delete another stream's block. Keep entries alphabetised by namespace
so diffs stay clean.

---

## 4. If you need a schema change (frozen-schema protocol)

Do NOT edit the schema yourself. Instead:
1. Stop the dependent work.
2. Write the requested change to `SCHEMA-CHANGE-REQUESTS.md` (entity, field, type, why).
3. Let the human (Youssif) apply it on `main` via the Foundation flow, run the migration,
   and re-broadcast. Then all streams rebase on the new `main`.

This prevents two agents creating conflicting migrations — the #1 way parallel DB work breaks.

---

## 5. Dependency order between streams

- Stream A (Customers) is the backbone — start it first among the parallel set.
- Streams B (Quotations) and C (Inspections) reference the Customer model via the schema,
  so they can run alongside A without needing A's UI.
- Stream D (Dashboard/Reports) reads from A/B/C. Start it last, or stub its queries and
  wire real data after A is merged.

---

## 6. Per-stream kickoff prompt (English, give to each agent)

> Read `AGENTS.md`, `MULTI-AGENT.md`, `docs/MVP-SPEC.md`, `docs/BUILD-ROADMAP.md`, and
> `prisma/schema.prisma`. You are **Stream <X>**. You may only edit the files your stream
> owns per the ownership map. The Prisma schema is frozen — if you need a change, follow
> the frozen-schema protocol instead of editing it. Implement your stream's milestones in
> order, run `npm run build` after each, and stop to report before opening a PR.
