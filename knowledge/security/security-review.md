---
artifact: Security Certification Review
project: EgyGlass ERP
task_id: SEC-003 (includes DATA-002 soft-delete, DATA-003 audit-log)
generated: 2026-07-06
author: Atlas Security Officer
scope: Full 20-point security certification pass
code_changes: NONE in this pass (SEC-001 + SEC-002 remediated earlier; no new P0 discovered)
verdict: CONDITIONAL PASS — cleared for controlled Customer UAT; NOT production-ready until P1/P2 closed
---

# Security Certification Review — EgyGlass ERP

> Single-pass repository certification. Evidence is cited by `file:line`. Code was **not** modified in
> this pass; the two Critical findings (SEC-001, SEC-002) were remediated in the preceding P0 tasks and
> are re-verified here. No new P0 was discovered, so per mandate no further code was changed.

## Method

Static inspection of the entire `src/`, `lib/`, `scripts/`, and config surface:
server actions, services, API routes, middleware/proxy, auth config, RBAC, Prisma access
patterns, env/secrets, and client render paths. Cross-checked against OWASP Top 10 (2021).

> 🔴 **تصحيح مؤرَّخ — 2026-07-25 · المرجع: TO-14 / TO-17.** عبارة «middleware/proxy» أعلاه توحي
> بفحص طبقة شبكة عاملة. **لم تكن هناك طبقة كهذه:** `src/proxy.ts` (اصطلاح **Next.js 16** على مشروع
> **15.3.4**) **لم يُحمَّل ولا مرة**، وحُذف في TO-14. الفحص الساكن قرأ ملفًا لا ينفّذه الإطار.
> تفاصيل الأثر على البنود 4 و6 و12 في قسم **«تصحيحات TO-17»** بعد المصفوفة.

## 20-point result matrix

| # | Control | Verdict | Worst finding |
|---|---|---|---|
| 1 | Authentication | ✅ PASS | Credentials + bcrypt(12); inactive-user block (`auth.ts:26`) |
| 2 | Authorization (RBAC) | ✅ PASS | `requireRole` on every mutation |
| 3 | Server Actions | ✅ PASS (1 note) | Read catalog actions ungated — P3 AUTHZ-002 |
| 4 | Route Protection | ✅ PASS (remediated) | Was P0 SEC-002 — **fixed** — 🔴 **صُحِّح: السبب المذكور خاطئ، انظر «تصحيحات TO-17»** |
| 5 | API Protection | ✅ PASS | notifications: rateLimit+auth+zod+ownership |
| 6 | Middleware | ✅ PASS (remediated) | `proxy.ts` matcher + fixed `authorized()` — 🔴 **صُحِّح: انظر «تصحيحات TO-17» بعد المصفوفة** |
| 7 | Role Matrix | ⚠ MINOR | `REVIEW` role absent from `roleHierarchy` — P3 RBAC-001 |
| 8 | Input Validation (Zod) | ✅ PASS | `safeParse` on every action & API body |
| 9 | Soft-Delete Consistency | ✅ PASS | `deletedAt:null` on all list + detail reads (DATA-002 closed) |
| 10 | Audit Log Completeness | ⚠ MINOR | `createQuotation` audit unconfirmed — P2 AUDIT-001 (DATA-003) |
| 11 | File Upload Security | ⚠ LATENT | Attachment `fileName`/`filePath` stored unvalidated — P2 UPL-001 |
| 12 | File Download Security | ✅ N/A | No server-side file read/serve handler exists — 🔴 **صُحِّح: الادعاء خاطئ، انظر «تصحيحات TO-17»** |
| 13 | Admin-only Endpoints | ✅ PASS (remediated) | `/api/cleanup` removed (P0 SEC-001) |
| 14 | Environment Variables | ✅ PASS | `.env` untracked; `.env.example` value-free |
| 15 | Secrets Management | ⚠ MINOR | Hardcoded dev DB creds in `scripts/cleanup.mjs:6` — P2 ENV-001 |
| 16 | Rate Limiting | ⚠ PARTIAL | Only `/api/notifications`; login unthrottled — P2 RL-001 |
| 17 | CSRF Protection | ✅ PASS | Next.js server-action origin check + SameSite cookies |
| 18 | XSS Protection | ✅ PASS | No `dangerouslySetInnerHTML`; React auto-escape |
| 19 | SQL Injection | ✅ PASS | 100% Prisma parameterized; no `$queryRawUnsafe` |
| 20 | Business Authorization | ⚠ **GAP** | SALES_REP can self-approve quotation — **P1 BIZ-001** |

## 🔴 تصحيحات TO-17 — 2026-07-25 (المرجع: TO-14)

> **صيغة موحّدة:** التاريخ · المرجع · الادعاء السابق · الوضع الفعلي. السجل الأصلي أعلاه **لم يُحذف ولم يُعَد كتابته** عمدًا.

**الجذر المشترك:** `src/proxy.ts` **لم يُحمَّل ولا مرة واحدة**. اسم `proxy.ts` اصطلاح **Next.js 16**
بينما المشروع على **15.3.4**، فلا يتعرّف عليه الإطار إطلاقًا. أي **لم تكن هناك طبقة شبكة عاملة**
طوال الفترة التي وثّقت فيها هذه المراجعة وجودها. حُذف الملف في **TO-14**.

| البند | الادعاء السابق | الوضع الفعلي (2026-07-25) |
|---|---|---|
| **6 — Middleware** | «`proxy.ts` matcher + fixed `authorized()`» ⇒ PASS | `proxy.ts` ميت، و`authorized()` في `src/lib/auth.config.ts` **لم يُنفَّذ قط** لعدم وجود ملف middleware يحمّله. الحارس الشبكي الوحيد اليوم هو **`src/middleware.ts`** ونطاقه **`/uploads` فقط** (أُنشئ في TO-07، أُصلح في TO-13). |
| **4 — Route Protection** | مُصلَح بـSEC-002 عند طبقة الـmiddleware | **النتيجة صحيحة، السبب خاطئ.** الحماية قائمة فعلًا لكن مصدرها **طبقة الصفحات**: `src/app/(dashboard)/layout.tsx:72-73` (`await auth()` ثم `redirect("/login")`) يغطي مجموعة `(dashboard)` كاملة، بالإضافة إلى `requireRole` في الصفحات والأكشنات. مُتحقَّق runtime: 14 مسارًا (`/customers` `/quotations` `/users` `/hr` `/accounting` `/inspections` `/projects` `/review` `/manufacturing` `/installations` `/executive` `/audit` `/dashboard` `/admin/pricing`) تعيد **307 → /login** بلا جلسة. |
| **12 — File Download Security** | «No server-side file read/serve handler exists» ⇒ N/A | **خاطئ وقت كتابته.** `src/app/uploads/[...path]/route.ts` موجود ويقرأ من القرص ويخدم الملفات. والأخطر أن الملفات تحت `public/uploads/**` كان يخدمها Next **ساكنًا بلا أي مصادقة** — أُغلق في TO-07 عبر `src/middleware.ts`، وأُصلح انحدار فيه في TO-13. ⚠️ **الحد القائم:** الحماية «مُصادَق فقط» لا «مصرَّح له بهذا الملف تحديدًا». |
| **الحكم P0 SEC-002** | «Critical Broken-Access-Control closed» | الثغرة **مغطّاة فعلًا اليوم** (طبقة الصفحات)، لكنها **لم تُغلق بالتغيير المنسوب إليها** — تعديل `authorized()` لم ينفَّذ قط. الإغلاق كان قائمًا من `layout.tsx` بصرف النظر عن SEC-002. |

**بند مكشوف واحد (توصية، لم يُنفَّذ في هذه الموجة — وثائق فقط):**
سطر التحقق «Logged-in user on `/login` redirected to `/dashboard` — PASS (preserved)» **غير صحيح اليوم**:
هذا السلوك يعيش حصرًا في `authorized()` الميت، ولا حارس ذاتي في `src/app/(auth)/login/page.tsx`.
مُتحقَّق بجلسة حيّة: المستخدم المسجَّل يفتح `/login` فيبقى عليه ويرى فورم الدخول.
**التصنيف: خلل تجربة استخدام لا ثغرة أمنية** (لا تسريب بيانات ولا تجاوز صلاحية). يُسجَّل كبند منفصل.

## Findings by priority

### P0 — Critical (both REMEDIATED, re-verified)
- **SEC-001** `/api/cleanup` unauthenticated whole-DB wipe → **route deleted**. Re-verified: no residual refs, typecheck clean. (`knowledge/regression/SEC-001.md`)
- **SEC-002** Middleware gated only `/dashboard` → **`authorized()` now requires session for all protected routes**. Re-verified typecheck clean. (`knowledge/regression/SEC-002.md`)

**No open P0.**

### P1 — High (open)
- **BIZ-001 — Broken segregation of duties in quotation approval.** `lib/pricing/actions.ts:10` `PRICING_ROLES = ["ADMIN","SALES_MANAGER","SALES_REP"]` and `updateQuotationStatus` (`:347`) accepts `status = APPROVED` with no elevated-role check. A SALES_REP can approve their own quotation, bypassing the manager/factor-approval control implied by `requestFactorApproval`. **No unauthenticated exposure → not P0**, but a genuine business-control bypass. **Recommended fix (post-approval):** restrict the `APPROVED`/`PENDING_APPROVAL→APPROVED` transition to `["ADMIN","SALES_MANAGER"]`.

### P2 — Medium (open)
- **RL-001** No rate limit / lockout on credentials login → brute-force risk (`src/lib/auth.ts`).
- **UPL-001** Attachment `fileName`/`filePath` accepted as arbitrary client strings (`inspections/actions.ts:172-198`); no scheme allowlist. Latent stored-XSS / open-redirect when rendered as a link, and unsafe once a real download handler is added.
- **ENV-001** Hardcoded dev DB credentials in `scripts/cleanup.mjs:6`. Dev-only + localhost, but should read from env.
- **AUDIT-001 (DATA-003)** Confirm `createQuotation`/`updateQuotation` write `ActivityLog`; `updateQuotationStatus` does, create-path unverified in this pass.

### P3 — Low / hardening
- **AUTHZ-002** Pricing read actions (`getProductRecipes`/`getPricingFactors`/`getConfigTypes`/`getProductTypes`) lack `requireRole` — commercial cost data reachable by any authenticated caller. Add read gate (defense in depth).
- **RBAC-001** `REVIEW` role missing from `roleHierarchy` (`src/lib/rbac.ts:3`); `hasRole` hierarchy helper is unused (all gating uses exact-match `requireRole`) — dead/inconsistent model.
- **RL-002** In-memory rate limiter (`lib/rate-limit.ts`) is per-instance; ineffective across multiple replicas.
- **SEC-TEST** No automated security regression tests (ties to backlog REG-001).

## Certified-strong controls (evidence)
- Passwords: `bcrypt.hash(pw, 12)` (`users.ts:57,130`); inactive users rejected at login.
- Every mutating server action: `requireRole(...)` + `zod.safeParse(...)` (customers, inspections, users, pricing).
- IDOR defense: notification ownership check (`notifications/route.ts:49`); customer & quotation reads owner-scoped for SALES_REP (`customers.ts:250`, `quotations.ts:56`).
- Soft-delete: `deletedAt:null` on all customer/inspection/quotation/user reads.
- Secrets: `.env` gitignored & untracked; `AUTH_SECRET` externalized, no code fallback.
- No raw SQL; no `dangerouslySetInnerHTML`; no `eval`.

## Verdict

**CONDITIONAL PASS.** Both Criticals are closed. The release may proceed to a **controlled Customer UAT**
(internal users, seeded data). It is **not production-ready** until **P1 BIZ-001** and the **P2** set are
remediated. Full sign-off requires those fixes + an automated security regression suite (REG-001).

See `security-dashboard.md` for the score, and `residual-risks.md` for the accepted-risk register.
