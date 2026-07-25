---
artifact: API Security Review
project: EgyGlass ERP
generated: 2026-07-06
author: Atlas Security Officer
---

# API Security Review — EgyGlass ERP

`src/app/api/` route inventory (post-remediation).

| Route | Methods | Auth | Rate limit | Input val | IDOR guard | Verdict |
|---|---|:-:|:-:|:-:|:-:|---|
| `auth/[...nextauth]` | GET/POST | n/a (Auth.js) | ❌ (RL-001) | provider | n/a | ✅ (login throttle gap) |
| `notifications` | GET/PATCH | ✅ session | ✅ 60/min/IP | ✅ zod | ✅ `userId===self` | ✅ reference-grade |
| ~~`cleanup`~~ | ~~POST~~ | — | — | — | — | ❌→✅ **REMOVED (SEC-001)** |

## Details

### `notifications/route.ts` — certified strong
- Rate limit before auth (`:8,30`), 429 on breach.
- `auth()` session required, 401 otherwise (`:12,34`).
- PATCH body zod-validated (`:40`); ownership enforced `notification.userId !== session.user.id → 404` (`:49`) — **no IDOR**.

### `auth/[...nextauth]` — Credentials
- bcrypt(12) verify; inactive users blocked (`auth.ts:26,28`).
- **RL-001 (P2):** no per-account/IP lockout on failed logins → brute-force exposure. Recommend wrapping credential authorize with the rate limiter or an account lockout counter.

### Removed: `cleanup/route.ts`
- Was an unauthenticated `deleteMany()` across all business tables. **Deleted** (SEC-001). Matcher in `proxy.ts` excludes `/api`, so it had never even been behind auth. Dev reset retained via `scripts/cleanup.mjs` (not deployed).

> 🔴 **تصحيح مؤرَّخ — 2026-07-25 · المرجع: TO-14 / TO-17.**
> **الاستنتاج (أن المسار لم يكن خلف مصادقة) صحيح، لكن السبب المذكور غير دقيق.**
> لم يكن الأمر استثناء `/api` من matcher الـ`proxy.ts`؛ بل إن **`src/proxy.ts` لم يُحمَّل أصلًا
> ولا مرة** — اسم `proxy.ts` اصطلاح **Next.js 16** والمشروع على **15.3.4**. أي أنه **لا `/api`
> ولا غيره** كان خلف أي طبقة شبكة. حُذف الملف في TO-14.
> **الوضع الفعلي:** حماية `/api` تأتي من داخل كل route handler لا من الشبكة —
> `src/app/api/notifications/route.ts` يفحص `auth()` ويعيد 401 (`:12,34`)، و
> `src/app/api/auth/[...nextauth]` هو معالج Auth.js نفسه. وهذان هما المساران الوحيدان
> الباقيان تحت `src/app/api/`.
> الحارس الشبكي الوحيد اليوم = `src/middleware.ts` ونطاقه **`/uploads` فقط** (TO-07، أُصلح في TO-13)،
> وهو **لا يغطي `/api`**.

## Cross-cutting
- **CSRF:** Next.js server actions verify Origin; API is same-origin fetch with SameSite=lax session cookie. PATCH is state-changing but session+ownership gated. ✅ (acceptable)
- **Rate limiter scope (RL-002, P3):** in-memory Map — not shared across replicas. Acceptable for single-instance Docker; revisit if horizontally scaled.
- **Transport:** ensure TLS termination + `NEXTAUTH_URL=https://…` in production (`.env.production.example`).
