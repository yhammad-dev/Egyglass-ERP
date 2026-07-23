# CLAUDE.md — EgyGlass ERP · الذاكرة المشتركة (Shared Ground Truth)

> **كيف تستخدم هذا الملف:** هذا هو المصدر الأوحد للمنهج والقرارات. اقرأه بالكامل في بداية كل session.
> عند أي تعارض بينه وبين وثيقة أقدم (بما فيها AGENTS.md) → **الكود هو الحقيقة**، ثم هذا الملف، ثم الباقي (الدرس 8).
> المبدأ الحاكم فوق كل شيء: **بالدليل لا بالحدس** — "تمّ" ليست دليلًا.
>
> 🔴 **BACKLOG.md هو المرجع المُلزِم الأوحد (STD-04).** هذا الملف **مشتقّ منه** — عند أي تعارض، **BACKLOG يعلو**. القرارات (`D-xx`) والبنود المفتوحة (`BL-xx`) هناك، لا هنا. هذا الملف يصف: الـstack · الأنماط · المبادئ · حالة البناء. **لا يحمل قرار عمل.**
>
> آخر تحديث: 2026-07-14 | آخر tag: `1b-measurements-done` (migrations حتى **29** — آخرها `scr018_inspection_gate`)
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
| `INSPECTION_MANAGER` | يوزّع المعاينات على فريقه · **يعتمد المعاينة** قبل ذهابها للمكتب الفني (D-37) | 🔴 **لا بوابة على الرسومات** (G2 محذوفة — BL-03/D-05) · **لا يُنشئ معاينة** (D-37 — الإنشاء للمبيعات) |
| `INSPECTION_REP` | معايناته المُسندة إليه فقط (`assigneeId`) · يسجّل المقاسات المهيكلة والصور | حارس ملكية server-side على الكتابة (BL-105) |
| `PROJECTS` | المشاريع بعد التعاقد + اعتماد التعاقد | قبل التعاقد = للمبيعات |
| `ACCOUNTING` | كل المالية | غيرها project-scoped |
| `PROCUREMENT` | أوامر التصنيع + التكاليف | ينفّذ التوريد لا يعدّل المواصفة |
| `INSTALLATIONS` | مشاريعه المُسندة + بنود + صور | القائد فقط؛ المدير override |
| `REVIEW` | 🔴 **يعتمد أمر التصنيع** بعد **مطابقة ثلاثية صريحة**: طلب العميل + مقاسات المعاينة + رسم المكتب الهندسي (D-04 · D-09) | **رقابة وجودة فقط — لا علاقة له بالتسعير ولا عروض الأسعار** (D-03). `reviewGatePosition` **عمود ميت** — الموضع محسوم في الكود لا في config |
| `HR` | الموارد البشرية | — |
| `VIEWER` | قراءة فقط | — |

> **بند مستقبلي مسجَّل (غير مبني بعد):** الواقع التشغيلي فيه موظفون بأكثر من دور واحد (User.role حاليًا مفرد). تحويله لـ multi-role = تغيير schema + RBAC شامل، يحتاج تدقيق قراءة-فقط منفصل قبل البناء. لا تبدأ فيه بدون تكليف صريح.

---

## 4. القرارات المعتمدة (مختصرة)

- **W-01** طلبات التسعير: ✅ **مفروض فعليًا (دفعة هـ، 2026-07-12)** — التسعير حصري للمكتب الفني: `SALES_REP` خارج `PRICING_ROLES` (`lib/pricing/actions.ts`) وخارج guard صفحة `/quotations/new` (307). **نقطة الدخول الحقيقية:** المندوب ينشئ `QuotationRequest` من ملف العميل عبر dialog بمسار `technicalRoute` **إلزامي بلا افتراضي** (PROJECTS/SOCIAL_MEDIA — خاصية الطلب لا العميل؛ عميل واحد قد يطلب المسارين) + إشعار TECHNICAL_OFFICE "يحتاج إسنادًا" + قسم بارز "طلبات غير مُسنَدة" في شاشة TEC. `quotationId` صار nullable (migration `batch_e_request_nullable_quotation`) — الطلب أولًا، TEC ينشئ العرض من الطلب ويرث المسار (الهوية تصل للطباعة والترقيم: مشروعات `EG…` · سوشيال `C3_…`). ترقيم الطلبات `TEC-PRJ-/TEC-SOC-` في `document-number.ts` (max+1 يقاوم الحذف).
- **W-02** التعديل بعد المعاينة: مسار واحد يتقارب عند المكتب الفني (مالك إعادة التسعير). المبيعات تُخطَر دائمًا — ✅ **القاعدة قائمة، والدالة أُعيد بناؤها في SCR-018:** `addMeasurement` (`services/inspection-measurements.ts`) يُخطر TECHNICAL_OFFICE (INS-R05) + مالك العميل `Customer.ownerId` وإلا SALES_MANAGER (SAL-R10). ⚠️ `addMeasurements` القديم **حُذف** — لا تبحث عنه. **الحذف بلا إشعار** (D-38 — تصحيح لا حدث).
- **W-03** المشروعات: اكتساب موحد عبر المبيعات · توجيه داخلي بالمصدر · كريم بعد التعاقد (app-layer gate: APPROVED فقط). ✅ مُنفَّذ.
- **W-04** بطاقة الإكسسوار: ✅ **مُنفَّذ فعليًا (دفعة أ)** بالدورة الثلاثية — TEC ينشئ البنود · INS يؤكد المقاسات (`confirmedByInspection` + إشعار PRC) · PRC يُدخل `unitCost` فقط **دون أي تعديل مواصفة (مفروض server-side** — action التكلفة لا يقبل نوعًا/وصفًا/كمية بنيويًا، ولا تكلفة على بند غير مؤكَّد). `services/extra-items.ts` + لوحة في شاشة الأوردر.
- **W-05 / R-01** اعتماد الرسومات: 🔴 **البوابتان G2 و G3 أُلغيتا (BL-02 · BL-03 · D-02 · D-05).** G3 (بوابة CEO المشروطة بالعتبة) كانت **اختراعًا** — نشأت من قراءة "المدير التنفيذي" كـCEO، وهو في لغة الشركة **مدير المكتب الهندسي** (D-01). G2 (`INSPECTION_MANAGER` على الرسمة) لا وجود لها — المعاينات **بلا بوابة على الرسومات** (D-05). **البوابة الوحيدة النافذة: G1 = `TEC_APPROVER`** (DRAFT → TEC_APPROVED) — يعتمد الرسم **والتسعير** ويُصدر أمر التصنيع (D-22). منع اعتماد الذات قائم **inline** في action الاعتماد G1 (`technical-office/actions.ts` — فحص `errors.cannotApproveSelf`). ⚠️ ملف `services/drawing-approval.ts` (آلة G2/G3 الميتة) **حُذف** — كان كودًا ميتًا بصفر استدعاء (BL-142). **الرسمة النافذة واحدة:** اعتماد رسمة ⇒ كل رسمة `TEC_APPROVED` أخرى على نفس الطلب → `SUPERSEDED` (BL-78، commit `8e72113`). العمودان `ceoDrawingApprovalThreshold` و `reviewGatePosition` **ميتان** (صفر منطق يقرأهما) — حذفهما SCR لاحق (BL-20). **التفاصيل المُلزِمة: BACKLOG (D-01 · D-02 · D-05 · D-22 · BL-02 · BL-03 · BL-78).**
- **W-06** بدل الكسر: 🔴 **الوصف القديم (أمر بديل تلقائي + Fast-track) كان ثغرة أمنية — أُلغي بالكامل (BL-60 · D-18).** كان يُنشئ أمرًا `IN_PRODUCTION` مباشرة متخطّيًا: حارس الدور · العقد · الدفعة · فحص الرسمة المعتمدة · بوابة `REVIEW`. **المسار النافذ الآن (SCR-017a، commit `8e72113`):** بند تركيب (خطأ/كسر) → **تسجيل فقط + إشعار `REVIEW`** — لا أمر تلقائي إطلاقًا → `REVIEW` تفتح تحقيقًا وتجمّع الأثر → **`ADMIN` يحكم** بفئة العطل → **`TEC_APPROVER` يُصدر البديل** → **`REVIEW` تطابق وتعتمد كأي أمر — لا استثناء من المطابقة (D-29).** حكم `CUSTOMER_DELAY` (عطل العميل) **يُرفض** — لا بديل بتكلفة الشركة (حارس W-06، `fault-investigations.ts`). ⚠️ **الأوامر الثلاثة القديمة (`IN_PRODUCTION` بلا مراجعة) ما زالت في القاعدة — رُصدت ولم تُهاجَر (STD-14).** IMT-R05 (بنود) + IMT-R06 (صور، اختيارية) + IMT-R02 (بطاقة الفريق) منفّذة — الصلاحية لقائد الفريق حصريًا (R-04، ADMIN override). **التفاصيل المُلزِمة: BACKLOG (D-18 · D-25..D-29 · BL-60 · BL-63).**
- **W-07** استطلاع الرضا: ❌ **غير منفّذ — اكتُشف كذب توثيقي في اختبار Phase 5 (دفعة هـ، 2026-07-12).** لا يوجد أي حدث يُطلقه: إتمام التركيب (`InstStatus=COMPLETED`) لا يُخطر المبيعات ولا يجدول استطلاعًا، ولا يوجد enum `INSTALLED_FINAL` أصلًا. الموجود فعليًا: `createPostInstallReview` **يدوي فقط** + عمود config `satisfactionSurveyDelayDays=3` بلا مستهلِك. **بند معلّق صريح:** التوصيل الحدثي (COMPLETED → إشعار مالك العميل/SALES_MANAGER → استطلاع بعد delay) يحتاج تكليفًا منفصلًا.
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
- أي تعديل لعتبة الخصم = **قيمة config واحدة** يحددها عمرو، صفر كود. ✅ (دفعة د) **كل قيم SystemSettings القابلة للضبط متاحة الآن من شاشة عمرو** — لم يعد هناك عمود config بلا UI.

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

## 7. حالة الـ Schema (بعد SCR-018 — أحدث تجميد)

- تجميد حالي: tag `schema-scr018-done`، **migration حتى 29**، build GREEN، DB up to date.
- **SCR-017a (migration 28):** `DrawingStatus.SUPERSEDED` · `FaultInvestigation` (موديول التحقيق — BL-63).
- **SCR-018 (migration 29):** `AttachmentCategory` {SITE_PHOTO · SKETCH · OTHER} + `Attachment.category` · `MeasurementUnit` {SQM · CBM} · **`InspectionMeasurement` أُعيد بناؤه مهيكلًا** (description · width · height · unit · quantity · notes · createdById · Cascade) · `InspectionApprovalStatus` {DRAFT · PENDING_APPROVAL · APPROVED · RETURNED} + `InspectionRequest.approvalStatus`/`approvedById`/`approvedAt`/`returnReason`.
  ⚠️ **بوابة اعتماد المعاينة: schema جاهز، app-layer لم يُبنَ بعد** (BL-109) — `approvalStatus` لا كاتب له حتى الآن.
- `SystemSettings` (`id="singleton"`, typed fixed-column — أي مفتاح جديد = migration):
  - أساسي: `discountBasePct=18` · `discountMaxReqPct=25` · `factorMinimum=1.5` · `vatPct=14` · `quotationValidDays=3` · `cashbackActive` · `cashbackStartDate` · `companyLogoUrl`
  - SCR-013: `managerApprovalCeilingPct` · `ceoDrawingApprovalThreshold` (كلاهما nullable — دور فعلي محدود بعد قرار §5) · `satisfactionSurveyDelayDays=3` · `reviewGatePosition`
  - SCR-014 (ضمان): `warrantyTextProjects` (Text?) · `warrantyTextSocialMedia` (Text?) · `warrantyProjectsOnQuotation`/`warrantyProjectsOnContract`/`warrantySocialOnQuotation` (booleans, default true) — لا يوجد `warrantySocialOnContract` (السوشيال بلا عقد أصلاً)
- **نماذج موجودة بالفعل — تحقّق قبل أي migration جديدة:** `QuotationRequest`, `Drawing` (+ `status`: enum `DrawingStatus`), `ExtraItem` (+ `confirmedByInspection`), `Referral`, `CashbackTier`, `PriceListItem`, `PricingFactor`, `DiscountRequest`, `QuotationApproval`, `ManufacturingOrder` (+ `parentOrderId` + `faultType`: enum `FaultType` + self-relation `MfgReplacement`), `InstallationOrder`.
- **SCR-014 الجديد:** `PaymentMilestone` (contractId, label, percentage Decimal(5,2), plannedAmount Decimal(14,2), sortOrder) · `Payment.milestoneId` (nullable, onDelete SetNull) · `Contract.totalValue` (Decimal? — snapshot من Quotation.total وقت الإصدار، لا يُقرأ لايف).
- **الرقم 18 في الكود = fallback default فقط.** ✅ القراءة موحّدة الآن عبر `src/lib/config.ts` → `getSystemSettings()` (المسار الفعلي المفروض من tsconfig alias `@/lib/config` — وليس `lib/config.ts`). بلا caching (كل الصفحات `force-dynamic`) وبلا ابتلاع أخطاء (سلوك `findUnique` حرفيًا). مُتحقَّق: صفر `systemSettings.findUnique` خارج `config.ts` (commit `bdc873a`).
- **دفعة أ (migration `batch_a_factory_mfg_review`, tag `schema-batch-a-done`):** كيان `Factory` (name·code @unique·contact·isActive·notes — بسيط عمدًا، التقييم مؤجّل بعد UAT) · `ManufacturingOrder.factoryId?` (SetNull) + `rejectionReason?` · `MfgStatus` أصبح 6 قيم: `{PENDING, UNDER_REVIEW, REJECTED, IN_PRODUCTION, READY, DELIVERED}` — التسلسل الشرعي مفروض server-side، بوابة مراجعة أمر التصنيع = REVIEW (BL-07/D-04) — لا INSPECTION_MANAGER.
المرجع المُلزِم: BACKLOG "قرارات محسومة".
- **دفعة ج (migrations `batch_c_installation_items_photos` + `batch_c2_w06_unblock`, tag `schema-batch-c-done`):** `InstallationItem` (نوع/وصف/كمية/تكلفة اختيارية — Restrict، حادثة سند) + `InstallationPhoto` (Cascade مع الأمر) + enum `InstallationItemType` (6 قيم) · `FaultType` أُضيف له `TEC_ERROR` · **رُفع `@unique` عن `ManufacturingOrder.quotationId`** (يمنع W-06 بنيويًا) — "أمر أصلي واحد لكل عرض" يُفرض منطقيًا في `createManufacturingOrder` (`findFirst({quotationId, parentOrderId: null})`).

> 📐 **درس معماري مهم:** SCR-013 أضاف حقول W-06 (`parentOrderId`/`faultType`) دون رفع قيد `@unique` على `quotationId` المانع لها — فجعل الميزة مستحيلة بنيويًا لشهور. اكتُشف في دفعة ج. **الدرس: إضافة حقول لميزة لا تكفي — افحص القيود المانعة.**
- **يوسف وحده يطبّق أي migration، داخل Docker.**
### الطبقة 1 (تنظيف الديون) — مقفولة ✅ (commit bdc873a, 2026-07-10)
- توحيد قراءة SystemSettings في `src/lib/config.ts` (refactor صفري السلوك).
- شاشة إعدادات الخصم للأدمن: `updateDiscountSettings` (requireRole ADMIN + zod: موجبان ≤100 + refine maxPct≥basePct سيرفر-سايد + ActivityLog قديم/جديد). مُتحقَّق بالمسارات الأربعة (حفظ/validation/RBAC/إرجاع).
- توثيق NODE_ENV: كان نظيفًا سلفًا (commit `671ac34`) — لا تعديل.
- approvedById: منفّذ سلفًا (commit `68adec6`) — المساران يكتبان approvedById عند APPROVED، DiscountRequest.decidedById منفصل.

> ✅ **مُتحقَّق على مستوى القاعدة (2026-07-10):** سياسة deactivate-not-delete مفروضة فعليًا بـ FK constraints — محاولة حذف مستخدم له سجلات ActivityLog تُرفض بـ P2003 (سلوك صحيح يحمي الأثر التدقيقي). المستخدمون يُعطَّلون (`isActive=false`) لا يُحذفون. السجلات append-only لا تُمسّ.

### دفعة هـ (وصل الشريان المقطوع) — مقفولة ✅ (2026-07-12، tag `batch-e-done`)
- **الجذر المُصلَح:** `QuotationRequest`/`technicalRoute` لم يكن ينشئهما أي كود واجهة — كل ما بُني عليهما (شاشة TEC، W-04، W-05، القوالب) كان معلّقًا في الهواء. الآن: دورة كاملة عميل→طلب→عرض→طباعة→معاينة→مقاسات→FINAL→عقد→رسومات→تصنيع→تركيب→مستخلص→**فاتورة** من الشاشة، **بصفر بذرة**، مُثبَتة مرتين (دورتان كاملتان + دورة سوشيال).
- **الحالة مشتقّة (Phase 4):** المصدر الوحيد `src/lib/services/status-derivation.ts` — دوال نقية (`deriveTecJobStatus`/`deriveCustomerStage`) + recompute تكتب فقط عند التغيّر + ActivityLog (`STAGE_DERIVED`/`TEC_STATUS_DERIVED`). السلّم مُثبَت آليًا: `NEW→PRICED→INSPECTION→CONTRACT→EXECUTION` و `NEW→IN_PROGRESS→ON_HOLD→IN_PROGRESS→DONE` (معاينة تُعلّق، مقاسات تستأنف، عقد يُنهي). زر تغيير المرحلة اليدوي **ADMIN-only** (واجهة + server) — للـ override وقرار `REJECTED` البشري الذي لا يُشتق ولا يُدهس.
- **isRepeat مشتق (ثغرة كاش باك مغلقة):** حُذف مربع الاختيار من فورم الإنشاء — يُشتق `true` عند أول تعاقد فقط + ActivityLog `CUSTOMER_BECAME_REPEAT` (أثر أهلية الكاش باك).
- **شاشة الفواتير `/invoices` (سد البلوكر المالي):** قائمة + إنشاء (مشروعات: ربط عقد/مستخلص تلقائي · سوشيال: مباشرة بلا عقد) + إصدار + إلغاء بسبب إلزامي (ISSUED→CANCELLED، سند لا يُحذف) + طباعة. `requireRole(["ACCOUNTING","ADMIN"])`. مُثبَتة: `EG0003/26/7/12-INV1` (مربوطة) و `C3_2` (سوشيال مباشرة). **+ أُضيفت statements وinvoices للقائمة الجانبية** (كانتا شاشتين بلا مدخل).
- **إصلاح ضمن الاختبار:** `assignEngineerAction` كان يكسر على `job.quotation.number` (nullable الآن) — أُصلح (`?? job.code`) وأُزيلت كتابة الحالة اليدوية منه.

### معلّقات دفعة هـ الصريحة (تكليفات لاحقة)
- **W-07 استطلاع الرضا:** غير منفّذ (انظر §4) — يحتاج توصيلًا حدثيًا.
- **FOLLOW_UP / RE_INSPECTION_FOLLOWUP:** بلا حدث مشتِق (لا "إرسال عرض" مسجَّلًا كحدث، ولا تمييز لمعاينة الإعادة) — تبقيان عبر ADMIN override حتى تعريف الحدث.
- **@mention (دفعة و):** غير مبدوء.
---

## 8. الضمان + العقد + محرك الدفعات (SCR-014 — مكتمل)

### الضمان (نصوص فعلية محسومة، مربوطة بالمسار)
| المسار | النص | يظهر في |
|---|---|---|
| `PROJECTS` | سنة ميلادية واحدة من التسليم الابتدائي ضد عيوب الصناعة، بشرط الفاتورة الضريبية، لا يشمل كسر الزجاج | عرض السعر + العقد (حسب booleans) |
| `SOCIAL_MEDIA` | صيانة مجانية 3 سنوات ضد عيوب الصناعة + ضمان صيانة مدى الحياة | عرض السعر فقط (لا عقد للسوشيال) |

النصوص حقول حرة في `SystemSettings` — التعديل `ADMIN` فقط + `ActivityLog`، القراءة عبر `lib/config.ts`. ✅ **شاشة الإعدادات موجودة الآن (دفعة د)** — كانت مفارقة موثّقة (أعمدة بلا UI): لوحة كاملة في `/admin/pricing` بأقسام (ضمان/سياسات/كاش باك) تغطي النصوص والمفاتيح والعتبات (`ceoDrawingApprovalThreshold` مثبت أنها تُشغّل G3 فعليًا) و`managerApprovalCeilingPct`/`reviewGatePosition`/`satisfactionSurveyDelayDays`/`quotationValidDays`/`vatPct`/الكاش باك. **النصوص الرسمية للضمان أُدخلت فعليًا عبرها وتظهر في قوالب الطباعة.**

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

المبيعات → (طلب معاينة — تختار الطلب صراحةً، D-31)
   → INSPECTION_MANAGER (توزيع على مندوب من فريقه — لا إنشاء، D-37)
   → INSPECTION_REP (مقاسات مهيكلة + صور + كروكي)
   → [تلقائيًا بعد الحفظ] → INSPECTION_MANAGER (اعتماد، D-37)
   → المكتب الفني

المكتب الفني → (إعادة تسعير) → المبيعات → (موافقة العميل)
   → عقد + دفعة (شرط قبل التصنيع — D-10)

TEC_APPROVER → يعتمد الرسم + يعتمد التسعير + يُصدر أمر التصنيع (D-22)
   → 🔴 REVIEW → مطابقة ثلاثية صريحة + اعتماد الأمر (D-04 · D-09)
   → PROCUREMENT (اختيار المصنع + التاريخ + التكاليف — D-12)
   → تصنيع → استلام → التركيبات → بنود إضافية → صور وتقرير
   → متابعة رضا العميل
```

---

## 10. قوالب الطباعة (P3 — src/app/(print)/)

- قالب السوشيال (pilot، commit `8ad0a22`): مطابق لعينة C3_7306 — لوجو + ضمان config + خصم صريح + سجل مستند.
- قالب المشروعات: مطابق بصريًا لعينة استاد EG0233 — 21 بند، توقيعان (مكتب فني + مدير)، ضمان سنة config.
- توقيعات المشروعات: اسم المهندس من `engineerId ?? createdBy` (موجود ✅). اسم المعتمِد من `Quotation.approvedById` — ✅ **يُكتب فعليًا** في مساري الاعتماد (`discount.ts:248` + `pricing/actions.ts:484` عند APPROVED فقط) ويُعرض في القالب (68adec6). "—" يظهر فقط للعروض المعتمدة قبل هذا الإصلاح.
- تعديلات عمرو البصرية الستة: ✅ **منفذة ومعتمدة رسميًا** (beff40c) — حذف الترويسة الإنجليزية، "Quotation" فوق "عرض سعر"، ضبط الخط العربي (Cairo)، مقاس A4، توسيع مربع "البيان"، مكان الرسمة (سوشيال فقط). + ترقيم متعدد الصفحات وضغط الشروط (a9a26ab). مُتحقق بالدليل بند-بند مقابل ورقة اعتماد عمرو.
- **بند تشغيلي (أدمن، صفر كود):** نصوص الضمان بنيتها config جاهزة والقوالب تقرؤها، لكن `warrantyTextProjects`/`warrantyTextSocialMedia` حاليًا NULL في الـ DB — عمرو يُدخل النصوص النهائية المعتمدة من شاشة الأدمن.
- **بند معلّق (نصوص):** بنود الشروط (`projectNote1..21` + `socialNote1..11` = 32 مفتاح في ar.json) نصوصها مبدئية حاليًا — بانتظار النص الحرفي النهائي من العينات لاستبدالها.

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

### قرارات نطاق UAT (صريحة)
- **HR خارج نطاق UAT بقرار يوسف (2026-07-11)** — نواة فقط (0✅/2⚠️/5❌ في تدقيق B2): سجل موظفين أساسي + طلبات إجازة خام. **Payroll/الحضور/التقييم/عقود الموظفين/الأرصدة = مرحلة تالية معلَنة. يُبلَّغ عمرو وراندا قبل UAT.**
- **مؤجّلات كريم المعلَنة (PRJ):** تعليقات على الرسومات · اعتماد الخامات · IR التسليم النهائي (handover) — غير مبنية، تُدار خارج النظام مؤقتًا حتى دفعة لاحقة.
- (دفعة د سدّت: شاشة الإعدادات الكاملة · لوحة KPIs المُثراة CEO-R06 · إشعار الحسابات عند التعاقد ACC-R01.)

### تشغيلي — قبل UAT
- ~~`notifyRole` لصفر مستلمين يضيع بصمت~~ ✅ **نُفّذ (دفعة ب):** عند 0 مستلمين نشطين → `console.warn` + ActivityLog `NOTIFICATION_ZERO_RECIPIENTS` (مُسند لأقدم ADMIN بوسم "[تحذير آلي]").
- ⚠️ **تحذير UAT (قائم):** seed UAT يجب أن يولّد مستخدمًا نشطًا لكل دور يستقبل إشعارات (TEC/PRC/INSTALLATIONS/INS/SALES/ACCOUNTING) — الإشعار الضائع الآن يُسجَّل تحذيرًا لكنه يظل ضائعًا.
- ~~دين تقني: المقاسات نصًا في ActivityLog~~ ✅ **مُنفَّذ (SCR-018 · BL-81، commit `eac9d38`):** المقاسات صارت **صفوفًا مهيكلة** في `InspectionMeasurement` (بيان · عرض · ارتفاع · وحدة م²/م³ · كمية). المسار النصي القديم **حُذف بالكامل**، والقرّاء الأربعة حُوّلوا (اشتقاق الحالة · بوابة REVIEW · شاشة التحقيق · شاشة المعاينة). `.multipleOf(0.001)` يمنع التقريب الصامت.

### درس تشغيلي إلزامي (قاطع)
- **كل أوامر docker compose / psql من جذر المشروع حصرًا. ممنوع كتم مخرجاتها (`>/dev/null`) — الفشل الصامت أخطر من الخطأ الظاهر.** (وقع 3 مرات، آخرها أنتج نتيجة اختبار كاذبة.)

### تنظيف توثيقي (غير عاجل)
- لوحة `factorMinimum` في `pricing-catalog-client.tsx` فيها نصوص عربية hardcoded قديمة (عناوين) تخرق قاعدة `t()` الإلزامية — تُحوّل لـ i18n في جلسة تنظيف لاحقة. اللوحة الجديدة (الخصم) كلها `t()` سليمة.

## 12. الدروس المنهجية القاطعة (دفعة هـ — تسبق أي تكليف جديد)

**الدرس 1 — البذرة قناع لا أداة:**
إسناد المهندس كان مكسورًا كليًا (`serverError` على كل محاولة) ولم يظهر في أي تدقيق — لأن البذور كانت تربط العرض مسبقًا فتخفي الكسر. **كلما احتجت بذرة، اسأل: ما الذي تُخفيه؟ كل اختبار يبدأ من فعل المستخدم الأول.**

**الدرس 2 — "الدالة موجودة" ≠ "المستخدم يصل إليها":**
تدقيقا B1/B2 أثبتا أن كل الـ actions تعمل — والنظام كان غير قابل للاستخدام. **ستة كيانات/شاشات بُنيت ولم يكن لها مدخل:** `QuotationRequest` · `technicalRoute` · `DrawingStatus` · `inspectionRequestId` · شاشة الفواتير · شاشة المستخلصات (غائبة عن القائمة). **تدقيق الكود لا يكشف انقطاع الواجهة — يلزم تدقيق رحلة مستخدم منفصل.**

**الدرس 3 — افحص القيود المانعة:**
حقول الميزة لا تكفي. SCR-013 أضاف حقول W-06 دون رفع `@unique` المانع (مستحيلة لشهور). `QuotationRequest.quotationId` كان إلزاميًا — **عكس W-01 تمامًا** (نقطة الدخول مستحيلة بنيويًا).

**الدرس 4 — النظام يعرف، فلا يسأل:**
أي حقيقة يستطيع النظام حسابها لا تُسأل للإنسان. منع ثلاثة عيوب: مرحلة الطلب (زر يدوي يكذب) · `isRepeat` (مربع اختيار يفتح بوابة كاش باك بلا تحقق) · رقم المستند (count+1 هش). **الاستثناء الوحيد: القرار البشري الحقيقي (`REJECTED`) — لا يُشتق.**

---

## 13. قالب البرومبت المحكوم

```
ROLE: (وكيل واحد، مهمة واحدة)
GROUND TRUTH: (الحقائق المتحقّقة — تغلب أي وثيقة قديمة)
ABSOLUTE RULES: (ماتعدّلش schema · بلا أسماء · بلا أرقام صلبة · requireRole · ActivityLog · t() · DEV only)
PHASES: (مرقّمة، كل واحدة هدف + متطلبات + CHECKPOINT يقف ويستنى)
FIX LIMIT: 2
REPORTING: (ما عملته · الدليل · المفاجآت · الخطوة الجاية · "في انتظار موافقتك")
```
