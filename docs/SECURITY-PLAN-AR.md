# خطة التأمين المتدرّجة — EgyGlass ERP

> مرجع حيّ لطبقات الأمان، مرتبط بمراحل المشروع. الفلسفة: **كل طبقة تدخل في المرحلة
> اللي بتمنع فيها أكبر ضرر بأقل تشتيت** — مش كله مرة واحدة، ومش متأخر بعد ما الثغرات
> تتوزّع على الـ streams.
>
> القاعدة الحاكمة: **الأدوات بتمسك المعروف والمتكرر؛ التفكير (Threat Modeling)
> بيمسك المنطقي الخاص بمجالنا.** محتاجين الاتنين.
>
> ربط الامتثال: ده يخدم PCI DSS Req 6 (تطوير آمن + فحص كود) و SOC 2 (change
> management + فحص قبل الدمج). مش رفاهية تقنية — دليل امتثال هنحتاجه.

---

## مبدأ أساسي اتعلمناه بالتجربة

ثغرة الـ **last-admin lockout** اللي طلعت في `/users` **مكنش أي scanner هيمسكها** —
لأنها ثغرة **منطق أعمال (business logic)**، مش نمط كود معروف. الدرس:
- الـ SAST/DAST بيمسكوا الأنماط المعروفة (injection, secrets, CVEs).
- الـ Threat Modeling بيمسك المنطق الخاص بمجالك (مين يقدر يقفل النظام؟ مين يرقّي نفسه؟).
- **الاتنين مكمّلين، مش بدائل.**

---

## الطبقات مرتبة بالأولوية (العائد على الجهد)

### الطبقة 1 — SAST (فحص الكود الساكن)
- **ESLint + eslint-plugin-security** — شبه مجاني (إحنا في TypeScript أصلًا).
- **Semgrep** (الأقوى) — rules جاهزة لـ Next.js + rules مخصّصة. أهم rule لمشروعنا:
  *كل server action لازم يبدأ بـ `requireRole`* — يفرض الـ RBAC آليًا على كل الـ streams.

### الطبقة 2 — Dependency Scanning (فحص المكتبات)
- **npm audit** — مدمج، في الـ CI.
- **GitHub Dependabot** (مجاني على GitHub) — PRs تلقائية للترقيات الأمنية.
  *ده كان هينبّه على مشكلة next-auth@^5 من الأول.*

### الطبقة 3 — Secret Scanning (منع تسريب الأسرار) — حرج لـ fintech
- **gitleaks** كـ pre-commit hook — يمنع الـ commit لو فيه secret.
  يقفل "الأسرار ماتدخلش git" **آليًا** بدل الاعتماد على التحقق اليدوي.

### الطبقة 4 — DAST (فحص ديناميكي للتطبيق الشغّال)
- **OWASP ZAP** — بيفحص التطبيق وهو شغّال. مكانه بعد ما يبقى في staging.

### الطبقة 5 — Threat Modeling (STRIDE) — الأرخص والأهم
جدول STRIDE من 6 سطور لكل feature، **قبل** كتابة الكود:
- **S**poofing — انتحال هوية؟
- **T**ampering — عبث بالبيانات؟ (مسك الـ role injection)
- **R**epudiation — في audit log؟ (ActivityLog)
- **I**nformation disclosure — تسريب؟ (مسك الـ passwordHash leak)
- **D**enial of service — تقدر تقفل النظام؟ (مسك الـ last-admin lockout)
- **E**levation of privilege — حد يرقّي نفسه؟ (privilege escalation)

أداة اختيارية للتنظيم: OWASP Threat Dragon. لكن جدول markdown أسرع وأقوى دلوقتي.

---

## خريطة الإدخال حسب المرحلة (التسلسل المعتمد)

### Phase A — إقفال التأسيس ✅ (اكتمل ومتحقّق بالمتصفح)
- [x] إصلاح last-admin guard (حذف/تنزيل رتبة/تعطيل آخر أدمن) — two-tier، متحقّق.
- [x] **gitleaks** pre-commit hook (أسرار) — مختبَر وبيمنع فعلًا.
- [x] **npm audit** في الـ build (مكتبات) — 4 moderate من postcss/next مقبولة، صفر HIGH/CRITICAL.
- [x] صفحة `/users` (CRUD + soft delete + reactivate + i18n + logout) — متحقّقة بالمتصفح.
- [x] tag `foundation-done` على commit d109648.
- [ ] رفع على GitHub (repo **Private**؛ تأكيد `.env` مستبعد قبل أول push) — **التالي**.

> **ملاحظة بيئية حرجة (تتكرر في كل الـ streams):**
> - المشروع على مسار محلي `E:\Projects\EgyGlass_ERP_New_Build` (بره OneDrive — السحابة بتسمّم الـ file watcher).
> - **Turbopack داخل Docker مابيلقطش ملف جديد إلا بعد `docker compose restart app`** — لازم تتحط في برومبت كل stream.
> - الـ DB superuser = `egyglass` (مش postgres). الـ DB على named volume `egyglass_db_data`.

> السبب: الطبقات الرخيصة عالية العائد (أسرار + مكتبات) تقفل أخطر فئتين فورًا
> بأقل تشتيت لإقفال التأسيس.

### قبل توزيع الـ Streams (بداية Phase B)
- [ ] **Semgrep** + rule "كل server action يبدأ بـ requireRole".
- [ ] **Dependabot** (لو على GitHub).
- [ ] **CI gate**: build + npm audit + Semgrep يمنعوا دمج PR غير آمن.
- [ ] بند **Threat Model (STRIDE)** في برومبت كل stream — قبل كتابة الكود.

> السبب: دي الطبقة اللي **تفرض النمط الأمني على الـ 4 streams**. لازم تكون
> البوابة جاهزة **قبل** ما الكود المتوازي يبدأ — مش بعده.

### Phase C — التلميع
- [ ] **OWASP ZAP** على staging.
- [ ] مراجعة أمنية شاملة + اختبار الصلاحيات يدويًا لكل دور.

---

## نمطان وقائيان (آليّان، مش يدويّان)
1. **pre-commit (محلي):** gitleaks + ESLint security — يمسك قبل دخول git.
2. **CI gate (GitHub):** build + npm audit + Semgrep — يمنع دمج PR غير آمن.

الهدف: الأمان **بوابة إجبارية**، مش اختيار يعتمد على انتباه الوكيل.

---

*هذا المرجع حيّ — يُحدّث مع كل طبقة تُضاف ومع كل ثغرة منطق جديدة نتعلم منها.*
