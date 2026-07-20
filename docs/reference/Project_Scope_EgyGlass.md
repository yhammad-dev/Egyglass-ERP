> ⚠️ **تحديث الحقيقة (Reconciliation) — ملف سياق:** هذا الملف مرجع سياقي شامل (النطاق الكامل).
> بعض تفاصيله من النطاق الأولي وتغيّرت. **مصادر الحقيقة المحدّثة للتنفيذ:** AGENTS.md +
> SCHEMA-CHANGE-REQUESTS.md + docs/quotation-math.md + NON-COLLISION-PROTOCOL.md.
> تحديدًا تجاوز ما يلي هنا:
> - **التسعير:** ليس "19% + 5% كاش باك تكرار". الصحيح: خصم تفاوضي (18→25%، قابل للتهيئة)
>   + كاش باك **نظام إحالة متدرّج** (5/4/3/2%) — راجع docs/quotation-math.md.
> - **دور REVIEW** (قسم المراجعة — محمد حسام) مضاف إلى الصلاحيات.
> - أرقام السياسات (خصم/ضريبة/كاش باك) **قابلة للتهيئة** من شاشة الأدمن، لا ثابتة.
> هذا الملف للسياق والخلفية — التنفيذ يتبع المصادر أعلاه.

---

# Project Scope — EgyGlass Internal Management System
# نطاق المشروع — نظام إدارة إيجي جلاس الداخلي

---

## English Version

### 1. Project Overview

**Project Name:** EgyGlass Internal Management System (Custom ERP)

**Company:** EgyGlass — Architectural glass company established 2001, Cairo, Egypt

**Project Type:** Custom-built, cloud-based Enterprise Resource Planning (ERP) system

**Objective:** Replace current fragmented workflows (Excel sheets, WhatsApp, paper) with a unified digital platform connecting 8 departments end-to-end — from lead acquisition through sales, survey, technical design, procurement, installation, accounting, and post-delivery.

**Target Users:** ~40+ employees across 8 departments + executive management

---

### 2. Modules In Scope

#### Module 1: Sales CRM
- Unified client profile (Customer 360) with full interaction history
- Sales rep assignment and load balancing by manager
- Automatic absence coverage mechanism (rep can cover colleague's clients)
- Sales pipeline statuses: New → Priced → Follow-up → (Inspection / Execution / Re-inspection Follow-up / Rejected)
- Daily activity log with timestamps
- Quotation management with 3-day validity + general price change clause
- WhatsApp integration for automated quotation delivery
- Discount engine: up to 19% standard + 5% cashback for repeat clients; additional discounts via manager → board approval
- Source tracking (ad, referral, WhatsApp, exhibition, visit)
- Contract management: individual contracts and project contracts (paper-based + scanned upload)
- Client classification: Individual (فردي) / Engineer (مهندس) / Company (شركه)
- Post-installation tracking and customer satisfaction survey
- No follow-up after rejection (rejection reason recorded)
- Full EGP-only pricing
- Reports: weekly/monthly rep performance, new clients, cabinet/handrail mix, total sales, paid amounts, outstanding balances, rejection analysis

#### Module 2: Inspections & Survey
- Standardized inspection request form (location, address, phone, attachments)
- Automatic routing to Procurement & Warehouses and Technical Office
- Scheduling calendar / task board with SLA tracking
- SLAs: 2 business days inside Cairo, 3-4 business days outside Cairo
- Mobile photo upload from site (current practice maintained and digitized)
- Site readiness evaluation (optional)
- Post-inspection re-pricing trigger to Technical Office
- Volume: ~40 inspections/week, 2-7 per day

#### Module 3: Technical Office
- Quotation preparation (15-30 min SLA from receiving full details)
- Unified price list (Price List)
- Re-pricing after inspection when actual measurements differ
- Drawing management: structural calculations (PDF), data sheets (PDF), executive drawings (PDF/DWG), approvals (PDF/JPG)
- Built-in PDF and DWG viewer
- Dashboard split: Projects vs. Social Media, each with New / In Progress / Pending / Completed
- Extra items catalog: edge-polishing (شطف), welding (لحام), extra accessories, outside-Cairo transport
- Archive: project name, type, location, specs, drawings, approvals with dates and photos
- Excel-sheet-based pricing (system reads existing sheets)
- Staff: 3 engineers expanding to 5
- Drawing review and approval by senior engineers
- All departments connected to Technical Office workflow

#### Module 4: Procurement & Warehouses
- Manufacturing order management with multi-factory routing (fixed + variable suppliers)
- Factory communication via email and WhatsApp
- Delivery readiness notification sent to Installations
- Cost tracking per project (not inventory-based)
- Separate accessory suppliers management
- Unified cost sheet (to be built; currently absent)
- Price list management with periodic updates
- Factory evaluation based on error rate and delay rate
- Procurement cost reports: per-operation and monthly totals
- Transport cost recording per operation
- Drawing review step before manufacturing (reviewer: Inspection Manager)
- Delay notifications (internal system only)
- Project-based, not barcode-based (no barcode system currently)

#### Module 5: Installations
- Team scheduling: 4 teams × 3 members each, with calendar
- Site data display: full address, contact, access notes
- Project team contact card (Technical Office, Survey, Sales contacts)
- Readiness notification from Warehouses
- Post-installation item recording with classification: breakage replacement, manufacturing error, technical-office error, client postponement
- Auto-generation of replacement manufacturing order upon breakage/error recording
- Photo and report upload from site (per-project album)
- Real-time project status visible to all departments
- Satisfaction survey (in coordination with Sales)
- Permissions: team leaders only
- Post-delivery maintenance per contract terms

#### Module 6: Accounting
- Payment structure per project: advance payment (دفعة مقدمة) + progress payment installments (دفعات مستخلصات) + supply payment (دفعة توريد) + installation payment (دفعة تركيب)
- Value Added Tax: 14%
- Manual payment recording
- Daily, weekly, and monthly collection reports
- Invoice management (standard format, not government e-invoice — company not yet registered with ETA)
- Financial visibility levels: عمرو (full access), كريم + نوران (contracts, extracts, payments only)
- Unified chart of accounts (existing codification system maintained)
- ~80 active projects tracked (projects + social media)
- Project financial closure and settlement

#### Module 7: Human Resources
- Employee records and personnel files (33 employees)
- Attendance tracking: current manual (WhatsApp group + fingerprint) to be digitized
- Leave management: 21 days/year (14 regular + 7 emergency)
- Payroll calculation
- Performance evaluations
- Unified employment contracts
- Organizational chart
- Commission rules (details pending clarification)

#### Module 8: Projects Management
- End-to-end project oversight from contracting to delivery
- Three approval gates: contract approval, materials approval, drawings approval
- Project handoff: Marketing → Contracts → Projects Department → Inspection routing
- Small-project direct flow: Stores → Installations (overseen by Projects Manager)
- Inspection request generation: project name + required measurement models
- Drawing review: Projects Manager reviews and can request corrections
- Reports: installation progress, problems log, pending work
- IR (Inspection Report) = final delivery inspection
- MRI (Material Review Inspection) = in-progress material/design inspection

#### Module 9: Cross-Cutting Features
- Dashboard for Executive Management with KPIs across all departments
- Role-based access control (permissions by department and role)
- Activity logging (username tracked on every action)
- Arabic + English interface
- Cloud-hosted
- Notifications (push and in-system)
- Unified customer profile viewable across all departments

---

### 3. Out of Scope (Current Phase)

- Government e-invoice integration (ETA) — company not yet registered
- Barcode / QR-based inventory system
- Mobile app for field crews (separate phase)
- AI-powered delivery time prediction
- Direct factory API integration
- Point of Sale (POS) system
- Laser Distance Meter integration for surveys

---

### 4. Key Stakeholders

| Name | Role | Department |
|------|------|------------|
| عمرو فاروق | CEO / Chairman | Executive Management |
| يوسف حماد | Decision Maker | Executive Management |
| طارق | Sales Manager | Sales & Marketing |
| حسن بهاء | Inspection Manager | Inspections |
| محمد فاروق | Technical Office Manager | Technical Office |
| إسراء | Social Media Team Lead | Technical Office |
| نوران | Projects Team Lead | Technical Office |
| شكري | Procurement Manager | Procurement & Warehouses |
| إسلام السيد | Installations Manager | Installations |
| راندا | Accountant / HR | Accounting / HR |
| كريم زيان | Projects Manager | Projects |

---

### 5. Constraints

- **Budget:** Not yet defined (needs CEO confirmation)
- **Timeline:** Not yet defined (needs CEO confirmation)
- **Hosting:** Cloud-based (confirmed)
- **Development:** Custom-built from scratch (no off-the-shelf ERP)
- **Language:** Arabic primary, English secondary
- **Approach:** MVP first, then iterative enhancement

---

### 6. Risks

1. **CEO strategic gaps:** Budget, timeline, user count, and infrastructure decisions not yet provided — may delay planning
2. **Current Excel dependency:** Accounting and Technical Office rely heavily on Excel sheets — migration complexity
3. **Manual attendance:** HR attendance currently manual (WhatsApp + fingerprint) — digitization requires hardware coordination
4. **No barcode system:** Warehouses lack barcode infrastructure — pure manual tracking
5. **Volume variability:** Sales volume fluctuates (~400 clients in May) — system must handle peaks
6. **Change management:** Transitioning 8 departments from paper/Excel to digital requires training and adoption effort
7. **Multi-factory coordination:** Not all factories have email — requires flexible communication methods

---

## النسخة العربية

### 1. نظرة عامة على المشروع

**اسم المشروع:** نظام إدارة إيجي جلاس الداخلي (ERP مخصص)

**الشركة:** إيجي جلاس — شركة زجاج معماري، تأسست 2001، القاهرة، مصر

**نوع المشروع:** نظام تخطيط موارد المؤسسات (ERP) مطور خصيصًا، مستضاف سحابيًا

**الهدف:** استبدال سير العمل الحالي (شيتات Excel، واتساب، ورق) بمنصة رقمية موحدة تربط 8 أقسام من البداية حتى النهاية — من استقطاب العملاء مرورًا بالمبيعات والمعاينات والمكتب الفني والمشتريات والتركيبات والحسابات ووصولًا إلى خدمة ما بعد التسليم.

**المستخدمون المستهدفون:** ~40+ موظف عبر 8 أقسام + الإدارة العليا

---

### 2. الوحدات المدرجة في النطاق

#### الوحدة 1: CRM وإدارة المبيعات
- بروفايل عميل موحد (Customer 360) مع تاريخ تفاعلات كامل
- توزيع العملاء على مندوبي المبيعات من قبل المدير
- آلية تغطية الغياب التلقائي
- مراحل البيع: جديد → تم التسعير → متابعة → (معاينة / تنفيذ / متابعة بعد المعاينة / رفض)
- تسجيل متابعات يومية مؤرخة ومُوقَّتة
- إدارة عروض الأسعار (صلاحية 3 أيام + شرط تغير الأسعار العام)
- ربط بالواتساب لإرسال العروض تلقائيًا
- نظام الخصم: حتى 19% خصم + 5% كاش باك للعملاء المتكررين، الخصم الإضافي عبر مدير المبيعات ثم رئيس مجلس الإدارة
- تتبع مصدر العميل (إعلان / توصية / واتساب / معرض / زيارة)
- إدارة العقود: عقد أفراد + عقد مشاريع (ورقي + رفع صورة)
- تصنيف العملاء: فردي / مهندس / شركه
- متابعة ما بعد التركيب واستطلاع رأي العميل
- تسجيل أسباب الرفض (بدون متابعة لاحقة)
- التعامل بالجنيه المصري فقط
- تقارير: أداء المندوب أسبوعي/شهري، العملاء الجدد، نسب الكبائن والهاندريل، إجمالي المبيعات، المدفوع، المتبقي، تحليل الرفض

#### الوحدة 2: المعاينات
- نموذج طلب معاينة موحد (الموقع، العنوان، التليفون، المرفقات)
- توجيه تلقائي للمخازن والمكتب الفني
- تقويم وجدولة المعاينات مع تتبع مستوى الخدمة (SLA)
- SLA: يومين داخل القاهرة، 3-4 أيام خارج القاهرة
- رفع صور من الموقع (ممارسة حالية يتم رقمنتها)
- تقييم جاهزية الموقع (اختياري)
- إعادة التسعير بعد المعاينة (إشعار للمكتب الفني)
- الحجم: ~40 معاينة/أسبوع، 2-7 يوميًا

#### الوحدة 3: المكتب الفني
- إعداد عروض الأسعار (SLA: 15-30 دقيقة من استلام كافة التفاصيل)
- قائمة أسعار موحدة (Price List)
- إعادة التسعير بعد المعاينة عند اختلاف المقاسات
- إدارة الرسومات: حسابات إنشائية (PDF)، داتا شيت (PDF)، رسومات تنفيذية (PDF/DWG)، اعتمادات (PDF/JPG)
- Viewer مدمج لملفات PDF و DWG
- لوحة تحكم مقسمة: مشروعات / سوشيال ميديا، كل منها: جديدة / قيد التنفيذ / معلقة / تمت
- كتالوج البنود الإضافية: شطف، لحام، اكسسوار زائد، نقل خارج القاهرة
- أرشيف: اسم المشروع / نوع التطبيق / الموقع / المواصفات / الرسومات / الاعتمادات بالتواريخ والصور
- التسعير عبر Excel sheets (قراءة من الملفات الحالية)
- الموظفون: 3 مهندسين → ستزيد إلى 5
- مراجعة واعتماد الرسومات بواسطة مهندسين أولين
- جميع الإدارات مرتبطة بالمكتب الفني

#### الوحدة 4: المشتريات والمخازن
- إدارة أوامر التصنيع مع توجيه لمصانع متعددة (ثابتة + متغيرة)
- التواصل مع المصانع عبر الإيميل والواتساب
- إشعار الجاهزية للتركيبات
- تتبع التكاليف لكل مشروع (وليس على أساس المخزون)
- إدارة موردي الاكسسوارات المنفصلين
- إنشاء شيت تكلفة موحد (غير موجود حاليًا)
- إدارة قائمة الأسعار مع تحديثات دورية
- تقييم المصانع بناءً على نسبة الأخطاء والتأخير
- تقارير تكلفة المشتريات: لكل عملية + إجمالي شهري
- تسجيل تكلفة النقل لكل عملية
- مراجعة الرسومات قبل التصنيع (المراجع: مدير المعاينات)
- إشعارات التأخير (داخل النظام فقط)
- تتبع المشاريع (بدون باركود — غير موجود حاليًا)

#### الوحدة 5: التركيبات
- جدولة فرق التركيب: 4 فرق × 3 أفراد لكل فريق، مع تقويم
- عرض بيانات الموقع: العنوان الكامل، التليفون، طرق الوصول
- بطاقة فريق المشروع (المكتب الفني، المعاينات، المبيعات)
- إشعار الجاهزية من المخازن
- تسجيل البنود بعد التركيب مصنفة: بدل كسر، خطأ تصنيع، خطأ مكتب فني، تأجيل عميل
- توليد أمر تصنيع تلقائي لتعويض القطع المكسورة أو الخاطئة
- رفع صور وتقارير من الموقع (ألبوم لكل مشروع)
- حالة المشروع في الوقت الفعلي مرئية لجميع الإدارات
- استطلاع رضا العميل (بالتنسيق مع المبيعات)
- الصلاحيات: قادة الفرق فقط
- صيانة ما بعد التسليم حسب العقد

#### الوحدة 6: الحسابات
- هيكل الدفع لكل مشروع: دفعة مقدمة + دفعات مستخلصات + دفعة توريد + دفعة تركيب
- ضريبة القيمة المضافة: 14%
- تسجيل المدفوعات يدويًا
- تقارير التحصيل: يومي / أسبوعي / شهري
- إدارة الفواتير (نموذج عادي، غير إلكتروني حكومي — الشركة غير مسجلة بمصلحة الضرائب)
- مستويات صلاحيات البيانات المالية: عمرو (كامل)، كريم + نوران (عقود/مستخلصات/مدفوعات فقط)
- دليل حسابات موحد (النظام الترميزي الحالي)
- ~80 مشروع نشط (مشروعات + سوشيال ميديا)
- التسوية المالية وإقفال المشاريع

#### الوحدة 7: الموارد البشرية
- ملفات الموظفين والسجلات الشخصية (33 موظفًا)
- تسجيل الحضور والانصراف (حاليًا يدوي عبر واتساب + بصمة، يتم رقمنته)
- إدارة الإجازات: 21 يوم/سنة (14 عادية + 7 طارئة)
- حساب الرواتب
- تقييم الأداء
- عقود عمل موحدة
- هيكل تنظيمي
- قواعد العمولات (التفاصيل تحتاج تأكيد)

#### الوحدة 8: إدارة المشروعات
- الإشراف الكامل على المشروع من التعاقد إلى التسليم
- ثلاث بوابات اعتماد: اعتماد العقد، اعتماد المواد، اعتماد الرسومات
- تسليم المشروع: تسويق → عقود → إدارة المشروعات → توجيه المعاينات
- المشاريع الصغيرة: تدفق مباشر مخازن → تركيبات (بإشراف مدير المشروعات)
- إنشاء طلب معاينة: اسم المشروع + نماذج القياس المطلوبة
- مراجعة الرسومات: مدير المشروعات يراجع ويطلب التعديلات
- تقارير: تقدم التركيب، سجل المشاكل، الأعمال المطلوبة
- IR (تقرير المعاينة النهائي) = فحص التسليم النهائي
- MRI (فحص مراجعة المواد) = فحص المواد والتصميم أثناء العمل

#### الوحدة 9: ميزات مشتركة
- لوحة تحكم الإدارة العليا مع مؤشرات أداء (KPIs) عبر جميع الإدارات
- التحكم في الصلاحيات حسب الدور والقسم
- تسجيل النشاط (تسجيل اسم المستخدم على كل إجراء)
- واجهة بالعربية والإنجليزية
- استضافة سحابية
- إشعارات (داخل النظام و push)
- بروفايل عميل موحد مرئي لجميع الإدارات

---

### 3. خارج النطاق (المرحلة الحالية)

- التكامل مع الفاتورة الإلكترونية الحكومية (الشركة غير مسجلة)
- نظام المخزون بالباركود / QR
- تطبيق موبايل للفنين في الموقع (مرحلة منفصلة)
- التنبؤ بمواعيد التسليم بالذكاء الاصطناعي
- تكامل مباشر مع المصانع عبر API
- نظام نقاط البيع (POS)
- دمج جهاز قياس المسافات بالليزر مع المعاينات

---

### 4. الجهات المعنية الرئيسية

| الاسم | الدور | القسم |
|------|------|-------|
| عمرو فاروق | الرئيس / رئيس مجلس الإدارة | الإدارة العليا |
| يوسف حمد | صاحب القرار | الإدارة العليا |
| طارق | مدير المبيعات | المبيعات والتسويق |
| حسن بهاء | مدير المعاينات | المعاينات |
| محمد فاروق | مدير المكتب الفني | المكتب الفني |
| إسراء | قائدة قسم السوشيال ميديا | المكتب الفني |
| نوران | قائدة قسم المشروعات | المكتب الفني |
| شكري | مدير المشتريات | المشتريات والمخازن |
| إسلام السيد | مدير التركيبات | التركيبات |
| راندا | محاسبة / موارد بشرية | الحسابات / الموارد البشرية |
| كريم زيان | مدير المشروعات | المشروعات |

---

### 5. القيود

- **الميزانية:** غير محددة بعد (تحتاج تأكيد من الإدارة العليا)
- **الجدول الزمني:** غير محدد بعد (تحتاج تأكيد من الإدارة العليا)
- **الاستضافة:** سحابية (مؤكد)
- **التطوير:** برمجة من الصفر (بدون ERP جاهز)
- **اللغة:** العربية أساسي، الإنجليزية ثانوي
- **المنهجية:** MVP أولاً، ثم تحسينات تدريجية

---

### 6. المخاطر

1. **الفجوات الاستراتيجية للإدارة العليا:** الميزانية والجدول الزمني وعدد المستخدمين وقرارات البنية التحتية لم يتم تحديدها بعد — قد تؤخر التخطيط
2. **الاعتماد على Excel:** الحسابات والمكتب الفني يعتمدان بشكل كبير على شيتات Excel — تعقيد في الترحيل
3. **الحضور اليدوي:** تسجيل الحضور حاليًا يدوي (واتساب + بصمة) — الرقمنة تتطلب تنسيق مع أجهزة
4. **عدم وجود باركود:** المخازن تفتقر إلى بنية تحتية للباركود — تتبع يدوي بالكامل
5. **تقلب حجم العمل:** حجم المبيعات متغير (~400 عميل في مايو) — يجب أن يتعامل النظام مع الذروات
6. **إدارة التغيير:** انتقال 8 أقسام من الورق و Excel إلى الرقمنة يتطلب تدريبًا وجهدًا للتبني
7. **التنسيق مع مصانع متعددة:** ليس كل المصانع لديها إيميل — يتطلب طرق تواصل مرنة
