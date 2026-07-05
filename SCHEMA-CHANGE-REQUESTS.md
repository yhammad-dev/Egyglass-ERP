# SCHEMA-CHANGE-REQUESTS — طلبات تغيير الـ Schema (المرحلة الأولى)

> **الغرض:** توثيق كل تغييرات الـ schema اللي ظهرت من مرحلة التصوّر (mockups) ومراجعات التيم.
> **القاعدة (الدرس 10):** الـ schema مجمّد. هذه التغييرات تُطبَّق **يدويًا على main بواسطة يوسف**، تُعمل migration، ويُعاد بثّ Ground Truth لكل الـ streams — **قبل** أي بناء متوازي. لا يعدّل أي وكيل الـ schema.
>
> **الحالة الحالية (متحقّقة بالعين):** commit `d109648`, tag `foundation-done`.
> 8 enums + 8 models: User, Customer, Interaction, Quotation, QuotationItem, InspectionRequest, Attachment, ActivityLog.

---

## مصدر الحقيقة — قبل أي تطبيق

قبل تطبيق أي تغيير، نظّف حالة العمل:
```bash
git status                 # راجع التعديلات غير المحفوظة (AGENTS.md, MULTI-AGENT.md, START-HERE.md)
# قرار: commit التعديلات دي أو راجعها — لا تبدأ schema changes فوق شجرة عمل غير نظيفة (الدرس 2)
```

---

## التغييرات المطلوبة للمرحلة الأولى (MVP)

### CR-01 — دور المراجعة (REVIEW) في RBAC
**المصدر:** قسم المراجعة الجديد (محمد حسام) — اعتماد عمرو + PRC-R02/R03.
**التغيير:** إضافة `REVIEW` لـ `enum Role`.
**الخطورة:** منخفضة (إضافة قيمة enum، غير كاسرة).
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  REVIEW          // ← جديد: قسم المراجعة (محمد حسام)
  VIEWER
}
```

### CR-02 — حالة المراجعة على عرض السعر / أمر التصنيع
**المصدر:** بوابة المراجعة بعد التعاقد قبل التصنيع (نظرية شكري — PRC-R02).
**التغيير:** enum جديد لحالة المراجعة + حقول على الكيان المناسب.
**الخطورة:** متوسطة (حقول جديدة، تحتاج default للسجلات الحالية).
```prisma
enum ReviewStatus {
  PENDING_REVIEW
  APPROVED
  RETURNED        // أُرجع للمكتب الفني مع سبب
}
// تُضاف الحقول على الكيان الذي يمثل أمر التصنيع/العرض عند المراجعة:
//   reviewStatus  ReviewStatus @default(PENDING_REVIEW)
//   reviewNote    String?
//   reviewedById  String?
//   reviewedAt    DateTime?
```

### CR-03 — نوع المعاينة (تسعيري / تنفيذي)
**المصدر:** ملاحظة تيم عمرو — نوع المعاينة يحدّد ظهور خيار التصنيع.
**التغيير:** enum + حقل على InspectionRequest.
**الخطورة:** منخفضة (حقل واحد، يحتاج default).
```prisma
enum InspectionType {
  PRICING         // تسعيري — لأخذ مقاسات التسعير
  EXECUTION       // تنفيذي — للتحضير للتصنيع
}
// على InspectionRequest:
//   type  InspectionType @default(PRICING)
```

### CR-04 — نظام الخصم التفاوضي
**المصدر:** ملاحظة تيم عمرو — خصم متدرّج تفاوضي (18% مندوب / طلب لحد 25% / عمرو يحدّد).
**التغيير:** كيان `DiscountRequest` لتتبّع الطلب والموافقة.
**الخطورة:** متوسطة (كيان جديد + علاقات).
```prisma
enum DiscountRequestStatus {
  PENDING
  APPROVED
  REJECTED
  ADJUSTED        // عمرو حدّد نسبة مختلفة
}
model DiscountRequest {
  id              String   @id @default(cuid())
  quotationId     String
  requestedPct    Float    // النسبة المطلوبة
  approvedPct     Float?   // النسبة المعتمدة فعليًا (قد تختلف)
  status          DiscountRequestStatus @default(PENDING)
  requestedById   String   // مدير المبيعات
  decidedById     String?  // عمرو أو مفوّض
  reason          String?
  createdAt       DateTime @default(now())
  decidedAt       DateTime?
  // + relations لـ Quotation و User
}
```

### CR-05 — إعدادات النظام (الخصم + اللوجو + إعدادات الشركة)
**المصدر:** صلاحيات الخصم القابلة للتهيئة + خانة اللوجو في شاشة الأدمن.
**التغيير:** كيان `SystemSettings`.
**الخطورة:** منخفضة (كيان إعدادات مستقل، لا يؤثر على غيره).
> ⚠ **ملاحظة دمج:** هذا الكيان وُسِّع لاحقًا في **CR-10** ليشمل كل المتغيّرات القابلة للتهيئة (الضريبة، صلاحية العرض، الكاش باك). **طبّق نسخة CR-10 الموسّعة** (وليس هذه)، فهي تشمل كل حقول CR-05.
```prisma
// نسخة مبدئية — انظر CR-10 للنسخة النهائية الموسّعة
model SystemSettings {
  id                String   @id @default("singleton")
  discountBasePct   Float    @default(18)
  discountMaxReqPct Float    @default(25)
  companyLogoUrl    String?
  companyName       String?
  updatedById       String?
  updatedAt         DateTime @updatedAt
}
```

### CR-06 — المفوّضون بالموافقة على الخصم
**المصدر:** عمرو يفوّض أكثر من شخص بنفس صلاحيته الكاملة في الخصم.
**التغيير:** علاقة مفوّضين (إما حقل boolean على User أو جدول وسيط).
**الخطورة:** منخفضة.
```prisma
// الخيار الأبسط: حقل على User
//   canApproveDiscount  Boolean @default(false)
// عمرو دائمًا true؛ المفوّضون يُفعّلون من شاشة الأدمن.
```

### CR-07 — محرك الأسعار المركزي (Price List)
**المصدر:** شاشة إدارة محرك الأسعار — المكتب الفني يقرأ منها عند التسعير.
**التغيير:** كيان `PriceListItem`.
**الخطورة:** منخفضة (كيان مرجعي مستقل).
```prisma
model PriceListItem {
  id          String   @id @default(cuid())
  category    String   // زجاج، إطار، إكسسوار، خدمة
  spec        String   // شفاف 10مم...
  unit        String   // م²، م.ط، قطعة
  price       Float
  isActive    Boolean  @default(true)
  updatedById String?
  updatedAt   DateTime @updatedAt
}
```

### CR-08 — الاحتفاظ بعرضين منفصلين (مبدئي + نهائي)
**المصدر:** ملاحظة تيم عمرو — مساران للتسعير/المعاينة، والنظام يحتفظ بالعرضين منفصلين.
**التغيير:** enum لنوع العرض + ربط النهائي بالمبدئي على Quotation.
**الخطورة:** منخفضة (حقل + علاقة اختيارية، غير كاسرة).
```prisma
enum QuotationType {
  INITIAL    // مبدئي — قبل المعاينة (تقدير)
  FINAL      // نهائي — بعد المعاينة (بالمقاسات الفعلية)
}
// على Quotation:
//   type                 QuotationType @default(INITIAL)
//   previousQuotationId  String?       // يربط العرض النهائي بالمبدئي
```
**منطق المسارين (Ground Truth — يُضاف لـ AGENTS.md):**
المسار مرن — التسعير والمعاينة ترتيبهم غير ثابت:
- المسار الأكثر شيوعًا: طلب ← تسعير مبدئي (INITIAL) ← معاينة ← تسعير نهائي (FINAL).
- المسار الأقل شيوعًا: طلب ← معاينة ← تسعير (مباشرة نهائي).
- الكيانات الحالية تتحمّل المسارين (pipeline فيه PRICED، Quotation منفصل عن InspectionRequest).

---

## قاعدة الكاش باك (Cashback) — نظام إحالة متدرّج — Ground Truth لـ Stream B

**المصدر:** وثيقة رسمية من عمرو (سريان 24 مايو 2026). محسومة بالكامل.

**الآلية الصحيحة (تصحيح للفهم القديم):**
- ليست "خصم تكرار" — بل **نظام إحالة (Referral)**: العميل الحالي يرشّح/يحوّل عملاء جدد، فيستحق كاش باك على عملياتهم.

**شروط الاستحقاق (كلها لازم تتحقق):**
1. العميل الجديد تواصَل/تعاقد عبر العميل الحالي (ترشيح مكتوب أو عن طريقه).
2. العميل الجديد جديد بالكامل (لا تعامل سابق مع الشركة).
3. تنفيذ الأعمال بالكامل.
4. سداد العميل الجديد كامل القيمة دون متأخرات أو نزاعات.

**شرط القيمة السعرية:**
- النسبة الكاملة تُستحق إذا كانت قيمة عقد العميل الجديد **ليست أقل** من قيمة عقد العميل الحالي (المُحوِّل).
- إذا قلّت قيمة العقد الجديد عن القديم → يُحتسب الكاش باك على **القيمة الفعلية للعملية الجديدة فقط** (الأقل)، لا القديمة.

**النسب المتدرّجة (حسب ترتيب العميل المُحوَّل لكل عميل مُحوِّل على حدة):**
| ترتيب العميل الجديد المُحوَّل | النسبة |
|---|---|
| الأول | 5% |
| الثاني | 4% |
| الثالث | 3% |
| الرابع | 2% |
| الخامس فما بعد | 2% |

**شرط الصرف:** بعد اكتمال التنفيذ + التحصيل الكامل لقيمة العملية الجديدة.
**السريان:** 24 مايو 2026، على العمليات الجديدة فقط (لا أثر رجعي).
**حق التعديل:** للشركة (عمرو) تعديل أو إيقاف النظام في أي وقت → لذلك كل أرقامه **قابلة للتهيئة** (انظر CR-09).

> 📌 **افتراض صريح يُراجَع (بالدليل لا بالحدس):** "ترتيب العميل المُحوَّل" يُحسب بعدّاد **مستقل لكل عميل مُحوِّل** — أي أول من يرشّحه أحمد = 5%، ثانيهم = 4%... وهكذا. مأخوذ من نص الوثيقة. إن كان القصد مختلفًا، يُصحَّح قبل بناء Stream B.

### CR-09 — كيانات الكاش باك / الإحالة (Referral)
**المصدر:** قانون الكاش باك الرسمي من عمرو.
**التغيير:** كيان يربط العميل المُحوِّل بالعميل الجديد + النسبة + الحالة.
**الخطورة:** متوسطة (كيان جديد + علاقات).
```prisma
enum CashbackStatus {
  PENDING       // بانتظار اكتمال التنفيذ والتحصيل
  ELIGIBLE      // استوفى الشروط، جاهز للصرف
  PAID          // صُرف
  CANCELLED     // أُلغي (إلغاء عقد/نزاع/عدم اكتمال)
}
model Referral {
  id               String   @id @default(cuid())
  referrerId       String   // العميل المُحوِّل (الحالي)
  newCustomerId    String   // العميل الجديد المُحوَّل
  newQuotationId   String   // عملية العميل الجديد
  referralOrder    Int      // ترتيب هذا المُحوَّل لدى المُحوِّل (1,2,3,4,5+)
  cashbackPct      Float    // النسبة المطبّقة (تُؤخذ من الإعدادات وقت الإنشاء)
  baseAmount       Float    // القيمة التي حُسبت عليها (الأقل بين الجديد والقديم)
  cashbackAmount   Float    // المبلغ المستحق
  status           CashbackStatus @default(PENDING)
  createdAt        DateTime @default(now())
  paidAt           DateTime?
  // + relations: referrer(Customer), newCustomer(Customer), newQuotation(Quotation)
}
```

### CR-10 — الإعدادات القابلة للتهيئة (Configurable Business Rules)
**المصدر:** مبدأ "المتغيّرات سهلة التغيير" — كل رقم يتغيّر مع السوق يُدار من شاشة الأدمن، لا يُثبّت في الكود.
**التغيير:** توسيع `SystemSettings` (CR-05) ليشمل كل المتغيّرات + جدول نسب الكاش باك القابل للتعديل.
**الخطورة:** منخفضة (إعدادات مستقلة).
```prisma
// توسيع SystemSettings (دمج مع CR-05):
model SystemSettings {
  id                String   @id @default("singleton")
  // الخصم
  discountBasePct   Float    @default(18)
  discountMaxReqPct Float    @default(25)
  // الضريبة
  vatPct            Float    @default(14)
  // العروض
  quotationValidDays Int     @default(3)
  // الكاش باك
  cashbackActive    Boolean  @default(true)
  cashbackStartDate DateTime?           // 2026-05-24
  // الشركة
  companyLogoUrl    String?
  companyName       String?
  updatedById       String?
  updatedAt         DateTime @updatedAt
}

// نسب الكاش باك المتدرّجة — جدول مستقل قابل للتعديل من الأدمن (عدد المستويات مرن)
model CashbackTier {
  id         String  @id @default(cuid())
  orderFrom  Int     // من ترتيب
  orderTo    Int?    // إلى ترتيب (null = فما بعد)
  pct        Float   // النسبة
  isActive   Boolean @default(true)
}
```
**الأرقام التي انتقلت من الكود إلى الإعدادات:** نسب الكاش باك (5/4/3/2) + عددها، حدود الخصم (18/25)، الضريبة (14)، صلاحية العرض (3 أيام)، تاريخ سريان الكاش باك. **عمرو يعدّلها من شاشة الأدمن.**

---

| الكود | المفهوم | المرحلة |
|---|---|---|
| CR-L1 | كيان رضا العميل / الشكاوى (CustomerSatisfaction) | متابعة — مرحلة 1.5/2 |
| CR-L2 | المخازن: تكاليف + أمر تصنيع كامل + تتبّع مصنع | مرحلة 2 |
| CR-L3 | الحسابات: دفعات + مستخلصات + شيت عميل مالي | مرحلة 2 |
| CR-L4 | التركيبات: جدولة + بنود خاصة + حالة مشروع | مرحلة 2 |
| CR-L5 | المشروعات: طلب مقاس + ملحقات + محاضر تسليم | مرحلة 3 |
| CR-L6 | الموارد البشرية: موظفين + إجازات + عقود | مرحلة 3 |

---

## قاعدتان للعرض (UI) — تُضاف لـ AGENTS.md (ليست schema)

1. **أرقام لاتينية في RTL:** كل حقل رقمي (هاتف/إيميل/مبلغ/كود) يُلفّ بـ `dir="ltr"` لمنع الانعكاس.
2. **محاذاة الأعمدة الرقمية في الجداول:** العنوان (th) والقيمة (td) يتحاذيان معًا، مع `direction:ltr` للرقم نفسه فقط — حتى لا تترحّل الأرقام بعيدًا عن عناوينها.

---

## مبدأ معماري — القواعد القابلة للتهيئة (Configurable Business Rules)

**القاعدة:** أي رقم/نسبة يتغيّر مع السوق أو سياسة الشركة **لا يُثبّت في الكود (no hardcoding)** — يُقرأ من `SystemSettings` / `CashbackTier`، ويُعدَّل من شاشة الأدمن بواسطة عمرو.

تشمل: نسب الكاش باك وعددها، حدود الخصم (الأساسي/السقف)، الضريبة، صلاحية العرض، تواريخ السريان.

**فائدة تشغيلية:** تغيير أي سياسة = تعديل من شاشة، لا طلب تعديل كود ولا إعادة نشر. كل تعديل يُسجَّل في ActivityLog (من غيّر، متى، القيمة القديمة/الجديدة) — للتدقيق.

---

## خطوات التطبيق (بترتيب — بواسطة يوسف على main)

1. نظّف شجرة العمل (commit/راجع التعديلات غير المحفوظة).
2. طبّق CR-01 → CR-10 على `prisma/schema.prisma` (لاحظ: CR-10 يستبدل CR-05 بالنسخة الموسّعة).
3. `npx prisma migrate dev --name phase1-review-discount-pricelist` (بحذر — الدرس 11: قد يعمل reset؛ تأكد من named volume).
4. تحقّق: `npx prisma studio` أو `npx prisma validate`.
5. commit + tag جديد (مثلاً `schema-phase1`).
6. حدّث AGENTS.md بـ Ground Truth الجديد + القاعدتين.
7. أعد بثّ Ground Truth لكل الـ streams قبل بدء البناء المتوازي.

---

*هذا الملف مصدر الحقيقة لتغييرات schema المرحلة 1. يُحدّث عند أي طلب تغيير جديد، ويُطبّق يدويًا فقط — لا وكيل يعدّل الـ schema (الدرس 10).*

---

## SCR-001 — Pricing Engine Models
Date: 2026-07-05
Requested by: Youssif
Status: PENDING_APPROVAL

### Required Additions:
1. enum FactorMode { STANDARD FIXED_AFTER CUSTOM_FACTOR }

2. model ProductRecipe {
   id         String         @id @default(cuid())
   name       String
   configType String
   lines      RecipeLine[]
}

3. model RecipeLine {
   id           String      @id @default(cuid())
   recipeId     String
   recipe       ProductRecipe @relation(fields: [recipeId], references: [id])
   itemId       String
   item         PriceListItem @relation(fields: [itemId], references: [id])
   qty          Decimal     @db.Decimal(10, 4)
   factorMode   FactorMode  @default(STANDARD)
   customFactor Decimal?    @db.Decimal(4, 2)
}

### Reason:
B4 calculation engine requires recipe-based pricing structure.
Cannot proceed without schema approval.

---

## SCR-002 — Notification Model
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  title      String
  body       String
  type       String
  entityId   String?
  entityType String?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

### Reason:
Phase 2 Stream E — notification infrastructure for cross-role events (starting with review approval/rejection).

---

## SCR-003 — Manufacturing Order
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06

```prisma
model ManufacturingOrder {
  id          String   @id @default(cuid())
  quotationId String   @unique
  quotation   Quotation @relation(fields:[quotationId], references:[id])
  status      MfgStatus @default(PENDING)
  assignedTo  String?
  notes       String?
  expectedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum MfgStatus {
  PENDING
  IN_PRODUCTION
  READY
  DELIVERED
}
```

### Additional change — PROCUREMENT role
**Reason:** Stream F requires an `ADMIN/PROCUREMENT` gate for manufacturing status updates and a "notify PROCUREMENT users" step on order creation. No procurement role existed in `enum Role`. Added `PROCUREMENT` as an additive, non-breaking enum value:
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  VIEWER
  REVIEW
  PROCUREMENT   // ← جديد: قسم المشتريات/التصنيع (Stream F)
}
```

### Reason:
Phase 2 Stream F — manufacturing order tracking triggered on quotation review approval.

---

## SCR-004 — Installation Order
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06

```prisma
model InstallationOrder {
  id                  String      @id @default(cuid())
  manufacturingOrderId String     @unique
  manufacturingOrder  ManufacturingOrder @relation(fields:[manufacturingOrderId], references:[id])
  teamLeadId          String?
  teamLead            User?       @relation(fields:[teamLeadId], references:[id])
  scheduledAt         DateTime?
  status              InstStatus  @default(PENDING)
  notes               String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
}

enum InstStatus {
  PENDING
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### Additional change — INSTALLATIONS role
**Reason:** Stream G requires an `ADMIN/INSTALLATIONS` gate for scheduling/status updates and a "notify INSTALLATIONS users" step when manufacturing status reaches READY. No installations role existed in `enum Role`. Added `INSTALLATIONS` as an additive, non-breaking enum value, consistent with the `PROCUREMENT` precedent in SCR-003:
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  VIEWER
  REVIEW
  PROCUREMENT
  INSTALLATIONS   // ← جديد: قسم التركيبات (Stream G)
}
```

### Reason:
Phase 2 Stream G — installation order tracking triggered on manufacturing order reaching READY.

---

## SCR-005 — Payment (Accounting)
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06

```prisma
model Payment {
  id          String   @id @default(cuid())
  quotationId String
  quotation   Quotation @relation(fields:[quotationId], references:[id])
  amount      Decimal  @db.Decimal(12,2)
  paidAt      DateTime
  method      String
  notes       String?
  createdById String
  createdBy   User     @relation(fields:[createdById], references:[id])
  createdAt   DateTime @default(now())
}
```

### Additional change — ACCOUNTING role
**Reason:** Stream I requires an `ADMIN/ACCOUNTING` gate for recording payments and viewing the accounting dashboard. No accounting role existed in `enum Role`. Added `ACCOUNTING` as an additive, non-breaking enum value, consistent with the `PROCUREMENT`/`INSTALLATIONS` precedent (SCR-003/SCR-004):
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  VIEWER
  REVIEW
  PROCUREMENT
  INSTALLATIONS
  ACCOUNTING   // ← جديد: قسم الحسابات (Stream I)
}
```

### Reason:
Phase 2 Stream I — payment tracking per quotation, feeding a per-customer accounting dashboard (contract total / paid / remaining).

---

## SCR-006 — Employee / LeaveRequest (HR)
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06

```prisma
model Employee {
  id         String     @id @default(cuid())
  userId     String?    @unique
  user       User?      @relation(fields:[userId], references:[id])
  nameAr     String
  department Department
  position   String
  hireDate   DateTime
  salary     Decimal?   @db.Decimal(12,2)
  isActive   Boolean    @default(true)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model LeaveRequest {
  id         String      @id @default(cuid())
  employeeId String
  employee   Employee    @relation(fields:[employeeId], references:[id])
  type       String
  startDate  DateTime
  endDate    DateTime
  status     LeaveStatus @default(PENDING)
  notes      String?
  createdAt  DateTime    @default(now())
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Additional change — HR role
**Reason:** Stream H requires an `ADMIN/HR` gate for managing employees and leave requests. No HR role existed in `enum Role`. Added `HR` as an additive, non-breaking enum value, consistent with the `PROCUREMENT`/`INSTALLATIONS`/`ACCOUNTING` precedent (SCR-003/004/005):
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  VIEWER
  REVIEW
  PROCUREMENT
  INSTALLATIONS
  ACCOUNTING
  HR   // ← جديد: قسم الموارد البشرية (Stream H)
}
```

### Reason:
Phase 2 Stream H — employee records and leave request tracking for HR department.

---

## SCR-007 — Project
Date: 2026-07-06
Requested by: Youssif
Status: APPROVED — Youssif Hammad, 2026-07-06 (pre-approved)

```prisma
model Project {
  id          String        @id @default(cuid())
  nameAr      String
  customerId  String
  customer    Customer      @relation(fields:[customerId], references:[id])
  managerId   String?
  manager     User?         @relation(fields:[managerId], references:[id])
  status      ProjectStatus @default(ACTIVE)
  startDate   DateTime?
  endDate     DateTime?
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  quotations  Quotation[]
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}
```

### Additional change — PROJECTS role
**Reason:** Stream J requires an `ADMIN/PROJECTS` gate for managing projects and linking quotations. No PROJECTS role existed in `enum Role`. Added `PROJECTS` as an additive, non-breaking enum value, consistent with the `PROCUREMENT`/`INSTALLATIONS`/`ACCOUNTING`/`HR` precedent (SCR-003/004/005/006). Note: `Department` enum already has a `PROJECTS` value — this is a separate `Role` enum value, unambiguous since they're distinct types:
```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  INSPECTION_MANAGER
  VIEWER
  REVIEW
  PROCUREMENT
  INSTALLATIONS
  ACCOUNTING
  HR
  PROJECTS   // ← جديد: قسم المشروعات (Stream J)
}
```

### Additional change — Quotation.projectId
**Reason:** `Project.quotations Quotation[]` requires a matching scalar + relation field on `Quotation` to link it to a project (many quotations per project, optional).
```prisma
// على Quotation:
//   projectId String?
//   project   Project? @relation(fields: [projectId], references: [id])
```

### Reason:
Phase 2 Stream J — project tracking per customer, linking one or more quotations to a project.
