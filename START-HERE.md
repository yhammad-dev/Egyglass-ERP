# ابدأ من هنا — تشغيل البناء مع OpenCode

> ⚠️ **تحديث الحقيقة (Reconciliation) — اقرأ هذا أولًا:** هذا الملف من النطاق الأولي.
> تغيّر التالي وأصبح في **AGENTS.md + SCHEMA-CHANGE-REQUESTS.md + NON-COLLISION-PROTOCOL.md**:
> - **الـ schema مطبّق فعليًا** (CR-01→10، tag `schema-phase1-done`) — مش "هيتجمّد بعدين"، هو **متجمّد دلوقتي**.
> - **Stream D = المراجعة + الأدمن** (مش Dashboard). الـ Dashboard يُبنى **آخرًا** كمكوّن منفصل.
> - **التسعير:** خصم تفاوضي (18→25%) + كاش باك إحالة متدرّج — راجع `docs/quotation-math.md`.
> - مسار ملف التسعير الصحيح: `docs/quotation-math.md` (وليس `docs/tests/`).
> عند أي تعارض بين هذا الملف والمصادر أعلاه — **المصادر أعلاه هي الحقيقة.**

الحزمة دي جاهزة تسلّمها لـ OpenCode. **ملفات الوكلاء كلها بالإنجليزي** (OpenCode بيلتزم
بيها أحسن)، لكن **واجهة المنتج نفسها عربي/RTL**.

## المتطلبات قبل ما تبدأ (3 بس)
- **Docker Desktop** مثبّت وشغّال (موجود عندك على اللاب ✓). ده بيشغّل Node و PostgreSQL
  جواه تلقائياً — مش محتاج تنزّلهم بإيدك.
- **OpenCode** مثبّت ومربوط بمفتاح موديل (الطبّاخ الـ AI اللي بيكتب الكود).
- **Git** مثبّت (للحفظ والعمل المتوازي بالـ worktrees).

> ملاحظة: شغلنا كله على اللاب جوّه Docker. **مش محتاج تجهّز Hostinger دلوقتي** — Docker
> بيخلّي بيئة اللاب نفس بيئة السيرفر، فالنقل لـ Hostinger هيبقى سهل وقت النشر (مرحلة لاحقة).

## 🔒 أمان مشروعك القائم على Docker (مهم)
عندك مشاريع Docker تانية شغّالة — المشروع ده **معزول عنها تماماً ومش هيأثّر عليها**:
- المشروع له اسم خاص (`egyglass-erp`) وبيستخدم بورتات مختلفة (5433 و 3100) عشان
  مايتعارضش مع أي حاجة شغّالة على 5432 أو 3000.
- أوامر `docker compose up` / `down` لما تشغّلها **من فولدر المشروع ده** بتأثّر على
  المشروع ده **بس**، ومش بتلمس مشاريعك التانية ولا بياناتها.
- التطبيق هيفتح على **http://localhost:3100** (مش 3000).
- ⚠️ **متشغّلش أبداً** أوامر تنظيف عامة زي `docker system prune` أو `docker volume prune` —
  مش محتاجينها، وممكن تأثّر على مشاريعك. لو عايز توقف مشروعنا: `docker compose down` من فولدره بس.
- قلت لـ OpenCode صراحةً في AGENTS.md إنه ممنوع يستخدم أي أوامر Docker عامة — يتعامل
  مع مشروعنا بس.

## ملفات الحزمة
| الملف | الغرض |
|------|-------|
| `AGENTS.md` | تعليمات وسياق ملزم لـ OpenCode (إنجليزي) |
| `MULTI-AGENT.md` | تنسيق العمل المتوازي: worktrees + ملكية الملفات + قاعدة تجميد الـ schema |
| `docs/MVP-SPEC.md` | المواصفات الوظيفية التفصيلية |
| `docs/BUILD-ROADMAP.md` | خطة البناء: Phase A تأسيس → Phase B متوازي → Phase C تلميع |
| `docker-compose.yml` | بيئة العمل: يشغّل قاعدة البيانات + التطبيق بأمر واحد |
| `Dockerfile` / `.dockerignore` / `.env.example` | إعدادات Docker والبيئة (جاهزة) |
| `prisma/schema.prisma` | نموذج البيانات الكامل (يتجمّد بعد التأسيس) |
| `docs/quotation-math.md` | أمثلة محسومة لمحرك عرض السعر (راجعتها وكلها مظبوطة ✅) |
| `docs/Project_Scope_EgyGlass.md` | النطاق الكامل (سياق فقط) |

---

## الترتيب الصحيح للتشغيل

### الخطوة 1 — التأسيس (وكيل واحد بس، لوحده)
افتح OpenCode في مجلد المشروع وادّيله البرومبت ده (انسخه زي ما هو):

> Read `AGENTS.md` (including §5b Docker), `docs/MVP-SPEC.md`, `docs/BUILD-ROADMAP.md`, and
> `prisma/schema.prisma` in full. The environment is Docker (compose file provided) — run all
> commands inside the app container. Execute **Phase A only (Milestone 0 and Milestone 1)**
> from the roadmap. Do not start Phase B. After each milestone, run
> `docker compose exec -e NODE_ENV=production app npm run build` and report the result before continuing. When Phase A
> is done, commit and tag it `foundation-done`.

⚠️ **مهم:** متشغّلش أكتر من وكيل في المرحلة دي — لازم الأساس يخلص الأول.

### الخطوة 2 — العمل المتوازي (لحد 4 وكلاء)
بعد ما التأسيس يخلص ويتعمله commit، اعمل الـ worktrees (الأوامر في `MULTI-AGENT.md` قسم 2)،
وافتح وكيل في كل فولدر، وادّي كل واحد برومبت الـ stream بتاعه (موجود في `MULTI-AGENT.md` قسم 6)
بعد ما تغيّر `<X>` لاسم الـ stream:
- وكيل A → Customers + Pipeline + Interactions
- وكيل B → Quotations
- وكيل C → Inspections
- وكيل D → Dashboard + Reports (الأخير)

### الخطوة 3 — الدمج والتلميع
ادمج كل branch بـ PR، وبعدها وكيل واحد ينفّذ Phase C (تلميع + اختبار الصلاحيات + build نظيف).

---

## نصايح
- ابدأ بوكيل A بعد التأسيس، وبعدين ضيف B و C. سيب D للآخر.
- لو وكيل طلب تعديل في الـ schema → **يقف** ويتبع بروتوكول تجميد الـ schema (مايعدّلوش بنفسه).
- راجع شغل كل وكيل بعد كل milestone قبل الدمج.
- أي error انسخه لي وأنا أرشّدك تحلّه.

---
بعد ما نخلّص الـ MVP ونجرّبه → نكتب ورقة العرض لعمرو (المراحل + المبالغ + المقابل الشهري).
