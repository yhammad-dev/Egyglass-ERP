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

## Cross-cutting
- **CSRF:** Next.js server actions verify Origin; API is same-origin fetch with SameSite=lax session cookie. PATCH is state-changing but session+ownership gated. ✅ (acceptable)
- **Rate limiter scope (RL-002, P3):** in-memory Map — not shared across replicas. Acceptable for single-instance Docker; revisit if horizontally scaled.
- **Transport:** ensure TLS termination + `NEXTAUTH_URL=https://…` in production (`.env.production.example`).
