# CLAUDE.md — EgyGlass ERP · الذاكرة المشتركة (Shared Ground Truth)

> **كيف تستخدم هذا الملف:** هذا هو المصدر الأوحد للمنهج والقرارات. اقرأه بالكامل في بداية كل session.
> عند أي تعارض بينه وبين وثيقة أقدم (بما فيها AGENTS.md) → **الكود هو الحقيقة**، ثم هذا الملف، ثم الباقي (الدرس 8).
> المبدأ الحاكم فوق كل شيء: **بالدليل لا بالحدس** — "تمّ" ليست دليلًا.
>
> آخر تحديث: 2026-07-10 | آخر tag مطبّق: `schema-scr014-done`

---

## 1. هوية المشروع + Stack

- **المشروع:** EgyGlass ERP — نظام تشغيلي متكامل لشركة زجاج معماري (القاهرة).
- **الدور البشري:** يوسف = المعتمد الوحيد للـ schema والـ migrations والقرارات. الوكيل ينفّذ، يوسف يراجع ويعتمد.
- **Stack:** Next.js **15.3.4** (App Router, Turbopack) · Prisma **6.19.3** · PostgreSQL 16 · Auth.js v5 · shadcn/ui v4 · Tailwind v4 (RTL) · next-intl v4 · react-hook-form + Zod · TanStack Table · Docker Compose.
  - ⚠️ **الواقع = Next 15.3.4 فقط. أي مرجع لـ "Next.js 16" في أي ملف قديم خاطئ — تجاهله.** لا تُرقِّ Prisma إلى 7 أثناء هذه المرحلة.
  - ✅ **تحذير `NODE_ENV` غير القياسي محلول** (جذر الدرس 5) — حُذف `NODE_ENV: development` من `docker-compose.yml`؛ الآن `docker compose exec app npm run build` نظيف تلقائيًا بلا `-e`.
- **المنافذ:** التطبيق `3100` · قاعدة البيانات `5433` (داخل Docker: `db:5432`) · Named volume: `egyglass_db_data`.
- **DB superuser:** `egyglass` (وليس `postgres`) — مضبوط عبر `POSTGRES_USER` في docker-compose.
- **Repo:** `yhammad-dev/Egyglass-ERP` (master) · git worktrees لعزل الـ streams.

### البيئة (مهم)
- **الآن: تطوير محلي على جهاز يوسف عبر Docker فقط.**
- **UAT (EC2, Elastic IP 13.63.54.138, port 3100) = رفعة واحدة لاحقًا — لا تلمس إعدادات UAT الآن.**
- `NEXTAUTH_URL` يبقى محليًا `http://localhost:3100`. لا تعدّله لأي شيء إنتاجي.
- أوامر Prisma داخل Docker فقط: `docker compose exec app npx prisma migrate dev` — لا من host الويندوز.

---

## 2. المبادئ الحاكمة (غير قابلة للتفاوض)

1. **بالدليل لا بالحدس.** ادعاء الوكيل ("done/complete/resolved") ليس دليلًا.
2. **التحقق = build GREEN + route HTTP 200** على صفحة مُصادَقة فعليًا — **ليس 307** (redirect للـ auth)، وليس مجرد compile.
   ميّز دائمًا: **Compiles ≠ Runs ≠ Complete**.
3. **Config-driven:** كل قاعدة عمل (نِسب خصم، عتبات، نصوص ضمان، مواضع بوابات) تعيش في **البيانات لا الكود**. **ممنوع رقم عمل صلب في الكود.**
4. **Role-based — بلا أسماء في الكود.** الموظف يمشي بالدور؛ الدور هو الباقي.
5. **الـ Schema مجمّد.** يوسف وحده يطبّق الـ migrations داخل Docker. لو احتجت تغييرًا → **قف، اكتب change-request، انتظر**. لا تعدّل schema بنفسك.
6. **Checkpoints:** قف عند كل نقطة، بلّغ بالدليل، انتظر موافقة صريحة قبل المتابعة. لا تنطلق للأمام.
7. **FIX LIMIT = محاولتان** لكل خطأ، ثم قف وصعّد. لا تطارد الأعراض — دوّر على الجذر.
8. **تحقّق بصري قبل الـ commit** ("بعيني قبل ما نعمل commit").
9. **القرارات تُقفل قبل تشغيل الوكيل.** لا تُدخِل غموضًا أثناء التنفيذ.
10. **كل server action يبدأ بـ `requireRole`.** كل mutation تكتب `ActivityLog`. كل نص للمستخدم عبر `t()` (المفتاح موجود في **ملفَّي اللغة معًا** ar + en).
11. **Reconnaissance قبل الكود (Phase X.0):** حدّد المكوّنات والأنماط الموجودة لإعادة استخدامها قبل كتابة أي شيء.
12. **طابِق التحقق بقابلية التراجع (الدرس 12):** الخطوات القابلة للرجوع → بثقة معقولة. غير القابلة (schema، حذف بيانات، عقد موقّع) → دليل مرئي وتأنٍّ.
13. **العقد الموقّع = سند لا يُعدَّل.** أي تغيير بعد التعاقد = ملحق عقد منفصل + عرض سعر جديد، لا تعديل مباشر (انظر §8).

---

## 3. الأدوار (RBAC — بالوظيفة لا بالاسم)

> ⚠️ **14 قيمة بالضبط — هذا الجدول هو المرجع الوحيد الصحيح.** لا يوجد `QUALITY_REVIEW` — استخدم `REVIEW`. لا `INS_MANAGER`/`PRJ_MANAGER`/`INSTALLATION` (مفرد).

| الدور (القيمة الفعلية) | النطاق | ملاحظة |
|---|---|---|
| `ADMIN` / CEO | كل شيء | لا قيود |
| `SALES_MANAGER` | كل عملاء الفريق · توزيع · تغطية · اعتماد خصم ≤ سقف config | فوق السقف → CEO |
| `SALES_REP` | عملاؤه + قراءة عملاء الزملاء + كتابة عبر-مندوب مُسجَّلة | التغطية soft + logging كامل |
| `TECHNICAL_OFFICE` | طلبات قسمه فقط (سوشيال ميديا / مشروعات بالمصدر) | إنشاء عروض أسعار |
| `TEC_APPROVER` | اعتماد الرسومات فنيًا | المهندس لا يعتمد رسمته |
| `INSPECTION_MANAGER` | كل المعاينات + تحقق ما قبل التصنيع | بوابة منفصلة عن TEC_APPROVER |
| `INSPECTION_REP` | تسجيل معاينات ميدانية | — |
| `PROJECTS` | المشاريع بعد التعاقد + اعتماد التعاقد | قبل التعاقد = للمبيعات |
| `ACCOUNTING` | كل المالية | غيرها project-scoped |
| `PROCUREMENT` | أوامر التصنيع + التكاليف | ينفّذ التوريد لا يعدّل المواصفة |
| `INSTALLATIONS` | مشاريعه المُسندة + بنود + صور | القائد فقط؛ المدير override |
| `REVIEW` | قسم الجودة والمراجعات الفنية (محمد حسام) | موضعه في سلسلة الاعتماد = `reviewGatePosition` (config) |
| `HR` | الموارد البشرية | — |
| `VIEWER` | قراءة فقط | — |

> **بند مستقبلي مسجَّل (غير مبني بعد):** الواقع التشغيلي فيه موظفون بأكثر من دور واحد (User.role حاليًا مفرد). تحويله لـ multi-role = تغيير schema + RBAC شامل، يحتاج تدقيق قراءة-فقط منفصل قبل البناء. لا تبدأ فيه بدون تكليف صريح.

---

## 4. القرارات المعتمدة (مختصرة)

- **W-01** طلبات التسعير: Single Entry Point + `requestSource` enum. لا تسعير خارج النظام.
- **W-02** التعديل بعد المعاينة: مسار واحد يتقارب عند المكتب الفني (مالك إعادة التسعير). المبيعات تُخطَر دائمًا.
- **W-03** المشروعات: اكتساب موحد عبر المبيعات · توجيه داخلي بالمصدر · كريم بعد التعاقد (app-layer gate: APPROVED فقط). ✅ مُنفَّذ.
- **W-04** بطاقة الإكسسوار: TEC ينشئ · INS يؤكد المقاسات (`confirmedByInspection`) · PRC ينفّذ التوريد دون تعديل.
- **W-05 / R-01** اعتماد الرسومات: بوابتان متمايزتان + CEO مشروط. Gate1 `TEC_APPROVER` · Gate2 `INSPECTION_MANAGER` (verify) · Gate3 CEO (عتبة config) · دور `REVIEW` موضعه في السلسلة = config. المهندس لا يعتمد رسمته.
- **W-06** بدل الكسر: Fast-track (يتخطى Gate1، الرسمة معتمدة) + `parentOrderId` + `faultType` + إشعار للمسؤول. ✅ مُنفَّذ (SCR-013).
- **W-07** استطلاع الرضا: event-driven عند `INSTALLED_FINAL` → إشعار المبيعات → استطلاع بعد `satisfactionSurveyDelayDays` (config=3). ✅ مُنفَّذ (SCR-013).
- **R-02** كتابة عملاء الزملاء: مسموح + logging كامل + لوحة رؤية للمدير (soft-control). ✅ مُنفَّذ.
- **R-03** قراءة المالية: project-scoped (least privilege) عبر `lib/finance/scope.ts`. ✅ مُنفَّذ.
- **R-04** التركيبات: حساب لكل قائد فريق + مدير override (هو التغطية). لا deputy منفصل.
- **P-01** الـ Price List: نماذج `PriceListItem`/`PricingFactor`/`CashbackTier` موجودة ومطبَّقة فعليًا — التسعير الحالي بـ `Material.cost` كافٍ وصحيح. **قرار عمرو (2026-07):** لا حاجة لقوائم أسعار منفصلة per-manufacturer — الفروق ضئيلة ومحصورة في قطاعات نادرة تُحسم بشريًا خارج النظام. جهة التصنيع في القوالب = حقل عرض/طباعة فقط (جريش افتراضيًا)، بلا أي تأثير تسعيري.
- **P-02** حالات عرض السعر: `QuotationStatus` الفعلي = `{DRAFT, SENT, PENDING_APPROVAL, APPROVED, EXPIRED}` (أبسط من التصميم النظري الأصلي — الكود هو الحقيقة).
- **P-03** الضمان: ✅ **محسوم بالكامل من مستندات الشركة الفعلية، منفّذ في SCR-014 وقوالب الطباعة** — تفاصيل كاملة في §8.

---

## 5. سياسة الخصم (محسومة — لا حقول منفصلة)

> ⚠️ **يُلغي أي إشارة سابقة لعمودين منفصلين (manager/CEO threshold). القرار النهائي: عتبة سياسة واحدة موحّدة.**

- `discountBasePct = 18` — قيمة fallback في الكود فقط. **القيمة النافذة الفعلية تُقرأ من `SystemSettings.discountBasePct`.**
- `discountMaxReqPct = 25` — سقف مطلق واحد موحّد لكلا المسارين (لا حقلين منفصلين لمدير/CEO). هذا هو القرار المعماري المعتمد من يوسف.
- الخصم الفعلي النافذ حاليًا للسوشيال ميديا = **19%** — مُتحقَّق بالدليل: النظام يعيد إنتاج عرض C3_7306 الرسمي بالمليم عند إدخال 19% (19,954.674)، وبـ18% يعطي رقمًا أعلى منطقيًا (20,201.028).
- خصم المشروعات: عند الطلب فقط (ليس دائمًا)، نطاق 3%–10%.
- أي تعديل لعتبة الخصم = **قيمة config واحدة** يحددها عمرو، صفر كود.

---

## 6. أنماط الكود الإلزامية

- `requireRole(...)` في أول كل server action.
- `ActivityLog` عند كل mutation (من، ماذا، متى).
- `t()` لكل نص — المفتاح في `ar` و `en` معًا (وإلا build يكسر).
- **shadcn form غير موجود في v4** → استخدم `react-hook-form + zod` مباشرة عبر helper موحّد `FieldError` (النمط الكامل موثّق في `AGENTS.md`).
- `type="button"` على كل زر داخل `<form>` (وإلا auto-submit).
- triggers الـ enum/select تُظهر labels مترجمة.
- احترم حدود ملكية الملفات لكل stream.
- راجع الكود الموجود قبل استبداله (لا تفترض).
- كل الحسابات المالية على **Decimal** — لا float (مطبّق في createQuotation/updateQuotation/recomputeTotals/discount.ts).

---

## 7. حالة الـ Schema (بعد SCR-014 — أحدث تجميد)

- تجميد حالي: tag `schema-scr014-done`، migration حتى 21، build GREEN، DB up to date.
- `SystemSettings` (`id="singleton"`, typed fixed-column — أي مفتاح جديد = migration):
  - أساسي: `discountBasePct=18` · `discountMaxReqPct=25` · `factorMinimum=1.5` · `vatPct=14` · `quotationValidDays=3` · `cashbackActive` · `cashbackStartDate` · `companyLogoUrl`
  - SCR-013: `managerApprovalCeilingPct` · `ceoDrawingApprovalThreshold` (كلاهما nullable — دور فعلي محدود بعد قرار §5) · `satisfactionSurveyDelayDays=3` · `reviewGatePosition`
  - SCR-014 (ضمان): `warrantyTextProjects` (Text?) · `warrantyTextSocialMedia` (Text?) · `warrantyProjectsOnQuotation`/`warrantyProjectsOnContract`/`warrantySocialOnQuotation` (booleans, default true) — لا يوجد `warrantySocialOnContract` (السوشيال بلا عقد أصلاً)
- **نماذج موجودة بالفعل — تحقّق قبل أي migration جديدة:** `QuotationRequest`, `Drawing` (+ `status`: enum `DrawingStatus`), `ExtraItem` (+ `confirmedByInspection`), `Referral`, `CashbackTier`, `PriceListItem`, `PricingFactor`, `DiscountRequest`, `QuotationApproval`, `ManufacturingOrder` (+ `parentOrderId` + `faultType`: enum `FaultType` + self-relation `MfgReplacement`), `InstallationOrder`.
- **SCR-014 الجديد:** `PaymentMilestone` (contractId, label, percentage Decimal(5,2), plannedAmount Decimal(14,2), sortOrder) · `Payment.milestoneId` (nullable, onDelete SetNull) · `Contract.totalValue` (Decimal? — snapshot من Quotation.total وقت الإصدار، لا يُقرأ لايف).
- **الرقم 18 في الكود = fallback default فقط.** ✅ القراءة موحّدة الآن عبر `src/lib/config.ts` → `getSystemSettings()` (المسار الفعلي المفروض من tsconfig alias `@/lib/config` — وليس `lib/config.ts`). بلا caching (كل الصفحات `force-dynamic`) وبلا ابتلاع أخطاء (سلوك `findUnique` حرفيًا). مُتحقَّق: صفر `systemSettings.findUnique` خارج `config.ts` (commit `bdc873a`).
- **يوسف وحده يطبّق أي migration، داخل Docker.**
### الطبقة 1 (تنظيف الديون) — مقفولة ✅ (commit bdc873a, 2026-07-10)
- توحيد قراءة SystemSettings في `src/lib/config.ts` (refactor صفري السلوك).
- شاشة إعدادات الخصم للأدمن: `updateDiscountSettings` (requireRole ADMIN + zod: موجبان ≤100 + refine maxPct≥basePct سيرفر-سايد + ActivityLog قديم/جديد). مُتحقَّق بالمسارات الأربعة (حفظ/validation/RBAC/إرجاع).
- توثيق NODE_ENV: كان نظيفًا سلفًا (commit `671ac34`) — لا تعديل.
- approvedById: منفّذ سلفًا (commit `68adec6`) — المساران يكتبان approvedById عند APPROVED، DiscountRequest.decidedById منفصل.

> ✅ **مُتحقَّق على مستوى القاعدة (2026-07-10):** سياسة deactivate-not-delete مفروضة فعليًا بـ FK constraints — محاولة حذف مستخدم له سجلات ActivityLog تُرفض بـ P2003 (سلوك صحيح يحمي الأثر التدقيقي). المستخدمون يُعطَّلون (`isActive=false`) لا يُحذفون. السجلات append-only لا تُمسّ.
---

## 8. الضمان + العقد + محرك الدفعات (SCR-014 — مكتمل)

### الضمان (نصوص فعلية محسومة، مربوطة بالمسار)
| المسار | النص | يظهر في |
|---|---|---|
| `PROJECTS` | سنة ميلادية واحدة من التسليم الابتدائي ضد عيوب الصناعة، بشرط الفاتورة الضريبية، لا يشمل كسر الزجاج | عرض السعر + العقد (حسب booleans) |
| `SOCIAL_MEDIA` | صيانة مجانية 3 سنوات ضد عيوب الصناعة + ضمان صيانة مدى الحياة | عرض السعر فقط (لا عقد للسوشيال) |

النصوص حقول حرة في `SystemSettings` — التعديل `ADMIN` فقط + `ActivityLog`، القراءة عبر `lib/config.ts`.

### قاعدة العقد (immutability — قرار عمرو الرسمي)
- العقد الموقّع من الطرفين والمعتمد = **سند أصل لا يُمس**. سعر العقد من عرض السعر بعد الموافقة الكتابية، ويتجمّد كـ snapshot في `Contract.totalValue` وقت الإصدار.
- أي تعديل بعد التعاقد = **ملحق عقد منفصل** + عرض سعر جديد مربوط بملف العميل، مع log يوثّق السبب والمعتمِد.
- ✅ **مُنفَّذ الآن:** حارس server-side يمنع `updateQuotation` لعرض له عقد (`Contract.quotationId` unique) ويرفض بـ `errors.quotationHasContract`.
- ⏳ **مؤجّل (feature منفصل):** آلية الملحق الكاملة (نموذج ملحق + شاشة + سجل موافقة).

### محرك الدفعات
- نمط: "خطة مخطّطة (`PaymentMilestone`: نسبة + label حر + مبلغ متوقّع) + دفعة فعلية (`Payment` الموجود، ربط اختياري)".
- `lib/finance/engine.ts`: `calculateMilestoneAmount` · `validateMilestonesSum=100%` (سيرفر-سايد إجباري) · `allocateMilestoneAmounts` (نمط largest-remainder) · `getContractBalances` (ضمن `getFinanceScope`).
- الحفظ عبر `savePaymentPlan` (`requireRole` ADMIN/ACCOUNTING). النِسب حرة ومتغيّرة لكل عقد (مثال فعلي متحقَّق: 60/20/20، أو 70/20/10) — **ليست ثابتة أبدًا**.
- `Payment.milestoneId` اختياري — دفعات المشروعات تُربط بالخطة، دفعات السوشيال (بلا عقد) تبقى عائمة.
- الفاتورة الإلكترونية = **مستند داخلي فقط، لا تكامل API مع منظومة ETA المصرية**. المستخلصات والفاتورة الكاملة مؤجّلة لـ SCR-015.

---

## 9. سير العمل الرئيسي (مؤكد)

```
المبيعات → (طلب تسعير) → المكتب الفني → (عرض سعر) → المبيعات
المبيعات → (تحويل معاينة) → المعاينات → (مقاسات) → المكتب الفني
المكتب الفني → (إعادة تسعير) → المبيعات → (تعاقد) → الحسابات + المكتب الفني + المشروعات
المكتب الفني → (رسم تنفيذي + اعتماد) → المخازن → (تصنيع) → التركيبات → (إغلاق) → المشروعات + المبيعات
```

---

## 10. قوالب الطباعة (P3 — src/app/(print)/)

- قالب السوشيال (pilot، commit `8ad0a22`): مطابق لعينة C3_7306 — لوجو + ضمان config + خصم صريح + سجل مستند.
- قالب المشروعات: مطابق بصريًا لعينة استاد EG0233 — 21 بند، توقيعان (مكتب فني + مدير)، ضمان سنة config.
- توقيعات المشروعات: اسم المهندس من `engineerId ?? createdBy` (موجود ✅). اسم المعتمِد (`Quotation.approvedById`) **غير مكتوب من أي كود حاليًا** — يظهر "—" مؤقتًا. إصلاح مؤجّل: ملء `roleCheck.userId` في مساري الاعتماد (`discount.ts` + `updateQuotationStatus` عند APPROVED).
- تعديلات بصرية معلّقة من عمرو: حذف جملة الترويسة الإنجليزية، إضافة "Quotation" فوق "عرض سعر"، ضبط font عربي، مقاس A4، توسيع مربع "البيان"، مكان رسمة هندسية (سوشيال فقط).

---

## 11. أنماط ومكوّنات مرجعية

راجع `AGENTS.md` للتفاصيل الكاملة لكل نمط أدناه — هذا الملف لا يكرر الكود:
- نمط الفورم الموحّد (`react-hook-form + zod + FieldError`).
- قواعد RTL للأرقام والجداول اللاتينية.
- namespace اصطلاحات الترجمة.
- قواعد Turbopack-in-Docker (restart بعد أي ملف route/action جديد).

---
## بنود معلّقة (تنظيف + أمان)

### أمني — إلزامي قبل أي رفعة UAT
- **كلمات مرور seed — مُعالَجة ✅ (mitigated, commit `8aad85c`):**
  - `seed-admin.ts` → `SEED_ADMIN_PASSWORD` (env، إجباري) · `seed.ts` → `SEED_USERS_PASSWORD` (env، إجباري).
  - حارس يرفض الغياب **والـ placeholder** معًا → الـ seed يتوقف قبل أي كتابة، لا يشتغل بكلمة ضعيفة. `.env.example` بـ `<SET_STRONG_PASSWORD>` (placeholder مرفوض عمدًا).
  - ⚠️ **مخاطرة متبقية مقبولة (accepted risk):** القيم القديمة ما زالت في **تاريخ git** — لم يُعَد كتابة التاريخ (خطر على repo نشط أكبر من فائدته). التنظيف الكامل (`git filter-repo`) مؤجّل بوعي.
  - 🔒 **قاعدة تشغيلية إلزامية (UAT/production):** أي حساب حقيقي يُنشأ بكلمة مرور **مُولَّدة جديدة وقت النشر** — ممنوع استخدام أي قيمة كانت في الـ repo. كلمات UAT منفصلة تمامًا عن أي seed value.
- **حساب `admin@egyglass.com` (dev seed):** مُعطَّل (`isActive=false`, commit-less DB op) — ليس محذوفًا، لحماية الأثر التدقيقي. لا تعيد تفعيله. لا يذهب لـ UAT مفعّلًا.

### تنظيف توثيقي (غير عاجل)
- لوحة `factorMinimum` في `pricing-catalog-client.tsx` فيها نصوص عربية hardcoded قديمة (عناوين) تخرق قاعدة `t()` الإلزامية — تُحوّل لـ i18n في جلسة تنظيف لاحقة. اللوحة الجديدة (الخصم) كلها `t()` سليمة.

## 12. قالب البرومبت المحكوم

```
ROLE: (وكيل واحد، مهمة واحدة)
GROUND TRUTH: (الحقائق المتحقّقة — تغلب أي وثيقة قديمة)
ABSOLUTE RULES: (ماتعدّلش schema · بلا أسماء · بلا أرقام صلبة · requireRole · ActivityLog · t() · DEV only)
PHASES: (مرقّمة، كل واحدة هدف + متطلبات + CHECKPOINT يقف ويستنى)
FIX LIMIT: 2
REPORTING: (ما عملته · الدليل · المفاجآت · الخطوة الجاية · "في انتظار موافقتك")
```
