# تقرير تدقيق التغطية — دفعة 1 (خمس إدارات)

> **التاريخ:** 2026-07-11 · **المرجع:** `docs/ERP_DA/Data Collections/EgyGlass_ERP_Client_Requirements_Package_v1.0_ Clint Answers/MD files/`
> **المنهج:** كل تصنيف مسنود بدليل من الكود الفعلي (ملف/سطر/دالة أو grep صفري مثبت). الكود هو الحقيقة (الدرس 8).
> **الحالة وقت التدقيق:** master `6f0a662` · tags: `schema-scr016-done`, `schema-scr015-done`.
> **التصنيفات:** ✅ منفّذ ومتحقَّق · ⚠️ منفّذ جزئيًا · ❌ غير منفّذ · ❓ غير واضح

---

## 1. المبيعات والتسويق (SAL) — جهة الاتصال: طارق

| المتطلب | التصنيف | الدليل | الناقص بالضبط |
|---|---|---|---|
| SAL-R01 توزيع العملاء (لوحة مدير) | ✅ | `Customer.ownerId` + إسناد في `src/lib/actions/customers.ts` + سجل ActivityLog | — |
| SAL-R02 شاشة المندوب (عملاؤه + قراءة/كتابة زملاء مسجَّلة) | ✅ | row-level scoping (sal-gaps-closed `e5b4ff8`) + R-02 عبر `src/app/(dashboard)/coverage-edits/` (لوحة رؤية المدير) | — |
| SAL-R03 تغطية الغياب | ✅ | `set-coverage-dialog.tsx` + `Customer.coveredById` + `lib/coverage-edits/actions.ts` | — |
| SAL-R04 متابعة العملاء (مراحل) | ✅ | `PipelineStage` (schema:568 — مطابق لإجابة SAL-02) + `stage-change-dialog.tsx` | — |
| SAL-R05 تحديثات يومية مؤرخة | ✅ | `model Interaction` (schema:115) + `addInteraction` في `src/lib/actions/customers.ts` | — |
| SAL-R06 مرحلة Done بعدادات زمنية | ⚠️ | المراحل والفلترة موجودتان | لا عدادات زمنية/تنبيهات (grep صفري على أي SLA timer) |
| SAL-R07 بروفايل عميل 360 | ✅ | `customers/[id]/customer-profile-client.tsx` (تفاعلات/عروض/معاينات/تعاقد/ما بعد التركيب) | — |
| SAL-R08 أسباب الرفض (قائمة + حر) | ✅ | `rejectionReason` (schema + stage-change-dialog، sal-gaps-closed) | التقارير التحليلية للأسباب غير موجودة |
| SAL-R09 تحويل لطلب معاينة | ✅ | `request-inspection-dialog.tsx` + `createInspectionAction` | — |
| SAL-R10 فيدباك المعاينات في البروفايل | ⚠️ | المعاينة مرتبطة بالعميل وتظهر في البروفايل | لا إشعار للمبيعات عند اختلاف المقاسات — `addMeasurements` (inspections/actions.ts:144) لا يرسل أي إشعار (تحقق مباشر). التزام W-02 «المبيعات تُخطَر دائمًا» غير منفّذ |
| BRD-7 VIP (معايير: مبلغ/تكرار/مهندس) | ⚠️ | `Customer.isVip` (schema:66) يدوي | المعايير التلقائية غير منفّذة |
| BRD-8 مصدر العميل | ✅ | `CustomerSource` enum (schema:60) | — |
| BRD-9 صلاحية العرض 3 أيام + تنبيه | ⚠️ | `quotationValidDays=3` (config) + `validUntil` (pricing/actions:261) + حالة EXPIRED | لا تنبيه ولا انتهاء تلقائي — لا cron/scheduler في المشروع (grep صفري)؛ EXPIRED يدوي |
| BRD-10 الخصم الهرمي 19% + كاش باك | ✅ | discount.ts الهرمي (base → مدير → CEO) + `CashbackTier` | محرك صرف الكاش باك معلّق موثَّقًا (pricing/actions:253 — يحتاج referrer linkage، schema gap مسجَّل) |
| SAL-03 ربط واتساب (إرسال عروض) | ⚠️ | حقل `whatsapp` على العميل | لا إرسال فعلي عبر واتساب — تخزين الرقم فقط |
| ملاحظة SAL الحرة: شاشة ما بعد التركيب + استطلاع الرضا | ✅ | `post-install-tab.tsx` + `src/lib/actions/post-install.ts` + W-07 (`satisfactionSurveyDelayDays`) | — |
| BRD-3 شاشة التعاقد داخل البروفايل + فلتر متعاقدين خارجي | ⚠️ | Contract + مستندات (Document) + خطة الدفع (PaymentMilestone) | فلتر «المتعاقدين» بعناوين خارجية في قائمة العملاء غير موجود |
| BRD-11 تقارير الأداء الدورية (مندوب/تطبيقات/مدد مختارة) | ❌ | لوحة executive KPIs عامة فقط (`lib/executive/actions.ts`) — grep صفري على تقارير أداء مندوب | كامل |

**العدّ:** 9✅ · 6⚠️ · 1❌

---

## 2. المعاينات (INS) — جهة الاتصال: حسن بهاء

| المتطلب | التصنيف | الدليل | الناقص بالضبط |
|---|---|---|---|
| INS-R01 استلام طلب معاينة | ✅ | `createInspectionAction` + نموذج (عميل/عنوان/داخل-خارج القاهرة) | location link كحقل مستقل غير مؤكد (داخل العنوان النصي) |
| INS-R02 مرفقات المشروع | ✅ | `addInspectionAttachment` (inspections/actions:184) + `InspectionPhoto` | — |
| INS-R03 جدولة/تقويم + تذكيرات | ⚠️ | `scheduledAt` + `scheduleInspectionAction` (:30) | لا شاشة تقويم/Task Board ولا تذكيرات (إجابة BRD-4: مطلوبة) — grep "calendar" صفري في src |
| INS-R04 تسجيل مقاسات + صور | ✅ | `addMeasurements` (:144) + `InspectionMeasurement` + `InspectionPhoto` | — |
| INS-R05 إرسال المقاسات للمكتب الفني تلقائيًا | ❌ | `addMeasurements` لا يرسل أي إشعار (فحص مباشر للدالة — صفر notify) | كامل — يكسر تدفق W-02 المركزي |
| INS-R06 أمر تصنيع تلقائي عند التعاقد (رسم + بطاقة برقم موحد) | ⚠️ | `createManufacturingOrder` موجود (manufacturing/actions:45) لكنه يدوي | التوليد التلقائي عند التعاقد غير موجود |
| INS-R07 توجيه الرسم التنفيذي للمهندس | ⚠️ | الرفع بفئة `EXECUTION_DRAWINGS` متاح في TEC | التوجيه/الإشعار التلقائي غير موجود |
| INS-R08 توجيه بطاقة الإكسسوار لشكري | ❌ | `ExtraItem` schema فقط — صفر UI/actions/إشعارات في src+lib (grep صفري خارج الـ schema) | كامل — W-04 غير منفّذ منطقيًا |
| BRD-5 SLA (يومان داخل القاهرة / 3-4 خارجها) | ❌ | لا حقول SLA ولا عدادات | كامل |
| BRD-6 جاهزية الموقع (أوبشن اختياري) | ✅ | `siteReadiness` (schema:212) + `updateSiteReadiness` (inspections/actions:299) | — |

**العدّ:** 4✅ · 3⚠️ · 3❌

---

## 3. التركيبات (IMT) — جهة الاتصال: إسلام السيد

| المتطلب | التصنيف | الدليل | الناقص بالضبط |
|---|---|---|---|
| IMT-R01 عرض بيانات الموقع | ⚠️ | شاشة التركيبات تعرض الأوردر والعميل | العنوان/طرق الوصول الكاملة في شاشة التركيب: جزئي (العنوان على العميل؛ لا حقل طرق وصول) |
| IMT-R02 بيانات مسؤولي المشروع (بطاقة فريق) | ❌ | grep صفري في `installations-client.tsx` | كامل |
| IMT-R03 استلام إشعار الجاهزية | ✅ | `updateMfgStatus` عند READY → إشعار `MFG_READY_FOR_INSTALLATION` لكل INSTALLATIONS (manufacturing/actions:95-115) | — |
| IMT-R04 جدولة موعد التركيب (بقائد فريق) | ✅ | `scheduleInstallation` + `teamLeadId` (R-04) + `scheduledAt` | تقويم مرئي غير موجود |
| IMT-R05 تسجيل البنود الخاصة (بدل كسر/أخطاء/تأجيل) | ❌ | صفر في `installations-client.tsx` على photo/بدل كسر/extra (grep مباشر) | كامل |
| IMT-R06 رفع صور وتقارير بعد التركيب | ❌ | لا نموذج صور تركيب (InspectionPhoto للمعاينات فقط) | كامل |
| IMT-R07 حالة المشروع الفعلية (نسبة) لكل الإدارات | ⚠️ | `InstStatus` (PENDING→SCHEDULED→IN_PROGRESS→COMPLETED→CANCELLED) | نسبة إنجاز تنفيذية + رؤية موحدة: غير موجودة (progressPct الحالي مالي على المستخلص فقط) |
| BRD-4 بدل كسر → أمر تصنيع تلقائي (+ خطأ مكتب فني/مقاس يرجع للمسؤول) | ❌ | `parentOrderId` + `faultType` schema فقط (SCR-013) — **صفر كود يكتبهما** (grep صفري في src+lib) | كامل |
| BRD-6 الصور إجبارية للإغلاق «حسب الحالة» | ❌ | لا صور تركيب أصلًا | كامل (تابع IMT-R06) |
| BRD-7 تقييم الرضا | ✅ | «مع المبيعات» (إجابة إسلام) — منفّذ هناك (W-07) | — |

**العدّ:** 3✅ · 2⚠️ · 4❌ (+BRD-6 ضمن IMT-R06)

---

## 4. المشتريات والمخازن (PRC) — جهة الاتصال: شكري

| المتطلب | التصنيف | الدليل | الناقص بالضبط |
|---|---|---|---|
| PRC-R01 استلام أمر تصنيع كامل بالمرفقات الثلاثة | ⚠️ | `ManufacturingOrder` + الرسومات عبر `Drawing→QuotationRequest` | شاشة أوردر موحدة تجمع (رسم معاينات + رسم فني + بطاقة إكسسوار): غير موجودة؛ البطاقة بلا منطق أصلًا |
| PRC-R02 مراجعة إجبارية قبل التصنيع | ❌ | `MfgStatus = {PENDING, IN_PRODUCTION, READY, DELIVERED}` (schema:628) — لا حالة مراجعة ولا بوابة | كامل (المراجع المسمّى في إجابة BRD-11: مدير المعاينات) |
| PRC-R03 رفض الأوردر للمكتب الفني بسبب | ❌ | لا rejection flow على MfgOrder | كامل |
| PRC-R04 إرسال للمصنع (قائمة مصانع + تكويد) | ❌ | **لا نموذج Factory/مصنع في الـ schema إطلاقًا** (grep صفري) — `assignedTo String?` نص حر | كامل |
| PRC-R05 تاريخ تسليم متوقع + عدّاد | ⚠️ | `expectedAt DateTime?` (schema:273) | لا UI إدخال واضحة ولا countdown |
| PRC-R06 إشعارات التأخير | ❌ | لا آلية زمنية في المشروع كله (لا cron/scheduler — grep صفري) | كامل |
| PRC-R07 بطاقة الإكسسوار (تجهيز → اعتماد إدارة → مصنع) | ❌ | `ExtraItem` + `confirmedByInspection` schema فقط | كامل |
| PRC-R08 إشعار الجاهزية للتركيبات | ✅ | manufacturing/actions:95-115 (مثبت) | — |
| PRC-R09 إشعارات المناديب (مواعيد استلام) | ❌ | لا شيء | كامل |
| PRC-R10 تسجيل التكاليف الكاملة (شراء/تصنيع/مستهلكات/نقل) | ❌ | `ExtraItem.unitCost` schema فقط؛ grep صفري على transport/نقل في manufacturing | كامل (إجابة PRC-04: «لا يوجد شيت تكاليف» — النظام مطالَب به) |
| PRC-R11 لوحة تكاليف المشروع | ❌ | لا شيء (شيت العميل الجديد `getCustomerSheet` = إيرادات لا تكاليف) | كامل |
| BRD-8 تقييم المصانع (أخطاء/تأخير) | ❌ | لا نموذج مصنع أصلًا | كامل |

**العدّ:** 1✅ · 2⚠️ · 9❌ — **الإدارة الأقل تغطية**

---

## 5. المكتب الفني + الرسومات (TEC)

| المتطلب | التصنيف | الدليل | الناقص بالضبط |
|---|---|---|---|
| TEC-R01 استلام طلبات التسعير | ✅ | `QuotationRequest` + شاشة TEC: تقسيم مشروعات/سوشيال وحالات جديد/قيد/معلق/تم + المسؤولون الثلاثة — مطابق حرفيًا لإجابة TEC-10 | — |
| TEC-R02 إعادة التسعير بعد المعاينة | ⚠️ | `previousQuotationId` + `quotationType` (schema:138-139) + P-02 | شاشة مقارنة التسعير الأولي/النهائي غير موجودة |
| TEC-R03 إدارة رسوم PDF/DWG | ✅ | `uploadDrawingAction` (technical-office/actions:155) + `DrawingFileType {PDF,DWG,JPG}` + UI رفع (tec-detail:438) | الإرسال للمصانع: لا آلية (مرتبط بغياب نموذج المصنع) |
| TEC-R04 بنود خاصة (شطف/لحام/إكسسوار زائد/نقل/صنفرة) | ⚠️ | `ExtraItemType` enum مطابق حرفيًا لإجابة TEC-07 | schema فقط — صفر UI/actions |
| BRD-3 تصنيف الرسومات الخمسة | ✅ | `DrawingCategory` (schema:937): DRAWINGS / STRUCTURAL_CALC / DATA_SHEET / EXECUTION_DRAWINGS / APPROVALS — مطابق حرفيًا لإجابة المكتب الفني | — |
| BRD-2 Viewer مدمج | ❌ | grep صفري على viewer/embed/iframe في tec-detail — روابط تحميل فقط | كامل |
| BRD-4 أرشيف قابل للبحث (مواصفات/اعتمادات بتواريخ) | ❌ | لا شاشة أرشيف | كامل |
| **سلسلة اعتماد W-05 (G1→G2→G3 + REVIEW)** | ⚠️ | **G1 فقط:** `approveDrawingAction` (technical-office/actions:228، TEC_APPROVER، منع اعتماد الذات :244) يكتب `approvedById/At`. **`DrawingStatus` (DRAFT→TEC_APPROVED→INS_VERIFIED→CEO_APPROVED→RELEASED_TO_FACTORY) لا يكتبه أي كود** (grep صفري) | G2 (INSPECTION_MANAGER verify) ❌ · G3 (CEO بعتبة `ceoDrawingApprovalThreshold` — العمود موجود غير مقروء) ❌ · موضع REVIEW (`reviewGatePosition`) ❌ |

**العدّ:** 3✅ · 3⚠️ · 2❌

---

## الملخص التنفيذي

### العدّ الإجمالي
| الإدارة | ✅ | ⚠️ | ❌ |
|---|---|---|---|
| SAL | 9 | 6 | 1 |
| INS | 4 | 3 | 3 |
| IMT | 3 | 2 | 4 |
| PRC | 1 | 2 | 9 |
| TEC | 3 | 3 | 2 |

### الفجوات الحرجة (بترتيب الأثر على UAT)
1. **بطاقة الإكسسوار (W-04) بلا أي منطق** — `ExtraItem` schema صرف. تكسر INS-R08 + PRC-R01/R07 + TEC-R04 معًا: **قلب دورة التصنيع مقطوع** لثلاثة أقسام.
2. **PRC شبه فارغ (9❌)** — لا مراجعة قبل تصنيع، لا رفض، لا نموذج مصانع أصلًا، لا تكاليف ولا لوحة تكاليف. مسار شكري في UAT شبه معدوم.
3. **سلسلة اعتماد الرسومات ناقصة G2/G3** — `DrawingStatus` لا يُكتب أبدًا؛ بوابة مدير المعاينات (المراجع المسمّى) غير مبنية؛ عتبة CEO غير مقروءة.
4. **INS-R05: المقاسات لا تُخطر المكتب الفني** — ومعها التزام W-02 بإخطار المبيعات (SAL-R10) غير منفّذ.
5. **التركيبات:** لا بنود إضافية/بدل كسر ولا صور من الشاشة (IMT-R05/R06)، و**W-06 (بدل الكسر التلقائي) غير موجود منطقيًا** رغم schema.
6. أقل حدة: تقويم INS/IMT · تقارير SAL الدورية · إرسال واتساب · Viewer/أرشيف TEC · إشعارات التأخير · عدّاد التسليم.

### إجابة سؤال الرسومات (صريحة)
**إرفاق/تجميع الرسومات المعتمدة في المستند المطبوع: ❌ غير منفّذ.**
الدليل القاطع: قالب الطباعة `src/app/(print)/quotations/[id]/print/page.tsx` لا يقرأ نموذج `Drawing` إطلاقًا؛ الموجود (سطر ~275) placeholder إطار فارغ (`drawingPlaceholder`، سوشيال فقط) وُضع بقرار يوسف الصريح: «تجميع الرسومات feature منفصل لاحق». الرفع والتصنيف موجودان؛ التجميع في المطبوع لا.

### تناقضات CLAUDE.md مقابل الكود (موثَّقة، لم تُصلح)
1. **§4 «W-06 ✅ مُنفَّذ (SCR-013)»** → الواقع: `parentOrderId`/`faultType` على مستوى الـ schema فقط، لا كود ينشئ أمر تصنيع بديلًا.
2. **W-04** (`confirmedByInspection`) يوحي سياق §4 بتنفيذه → الواقع: schema فقط، صفر منطق.
3. (تاريخي، عكسي) وثائق قديمة: «G4 siteReadiness معلّق» → الواقع: منفّذ كاملًا (`updateSiteReadiness`).

---
*تدقيق قراءة فقط — أُنتج بواسطة وكيل تدقيق التغطية، جلسة 2026-07-11. لا توصيات ولا حلول — القرار ليوسف.*
