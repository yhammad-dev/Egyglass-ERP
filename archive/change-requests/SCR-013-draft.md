# SCR-013 — DRAFT (منقّح) · الهجرة المجمّعة للمرحلة الأولى

> **الحالة:** مسودة منقّحة بعد قراءة الـ schema الكامل · **المعتمِد الوحيد:** يوسف · **التطبيق:** يدويًا داخل Docker
> **القاعدة:** لا يطبّقها أي وكيل. تُراجَع field-to-spec، تُطبَّق على master، ثم tag.
> **النموذج المقترح للكتابة:** Opus 4.8.

---

## 0. تنبيه: تقلّص النطاق بعد قراءة الواقع

قراءة `prisma/schema.prisma` الكامل كشفت أن **نصف بنود المسودة الأصلية موجودة بالفعل**. هذه النسخة تحتوي **فقط ما ينقص فعليًا**.

### موجود بالفعل — لا تلمسه ❌
- `DiscountRequest` + `QuotationApproval` → الخصم الهرمي **منفّذ**.
- `Referral` + `CashbackTier` → الكاش باك/الإحالة **منفّذ** (SCR-009).
- `InspectionRequest.siteReadiness` → INS G4 **منفّذ** (SCR-012).
- `Drawing.approvedById` + `approvedAt` → أساس اعتماد الرسم **موجود**.
- `ManufacturingOrder` · `ExtraItem` · `QuotationRequest.technicalRoute {PROJECTS, SOCIAL_MEDIA}` → **موجودة**.
- `InstallationOrder.teamLeadId` → قائد الفريق **موجود** (لا حاجة لنموذج `Team`).
- `QuotationStatus {DRAFT, SENT, PENDING_APPROVAL, APPROVED, EXPIRED}` → **يبقى كما هو** (قرار: أبسط، لا نوسّعه).
- `PriceListItem` · `PricingFactor` · `ProductRecipe` · `ProductType` · `ConfigType` · `Material` → طبقة التسعير **موجودة** (P-01 شبه منفّذ).

---

## 1. الهدف

إضافة **الحقول الناقصة فعليًا فقط** في migration واحد مجمّع. كل أعمدة السياسة `nullable` — عمرو يملؤها من الإعدادات.

---

## 2. التغييرات المطلوبة (الناقص فعليًا فقط)

### 2.1 — `SystemSettings` · أعمدة سياسة جديدة

```prisma
model SystemSettings {
  // ... الأعمدة الحالية كما هي (discountBasePct=18, discountMaxReqPct=25, vatPct=14,
  //     quotationValidDays=3, cashbackActive, cashbackStartDate, companyLogoUrl, companyName ...) ...

  // ── جديد: سياسة الخصم الهرمي (P-04) — يملؤها عمرو ──
  managerApprovalCeilingPct   Decimal?  @db.Decimal(5, 2)   // سقف اعتماد SALES_MANAGER فوق الأساس؛ فوقه → CEO
  // القيد (app-layer): discountBasePct (18) ≤ managerApprovalCeilingPct ≤ discountMaxReqPct (25)

  // ── جديد: عتبة اعتماد CEO للرسومات (W-05 · Gate3) ──
  ceoDrawingApprovalThreshold Decimal?  @db.Decimal(14, 2)  // مبلغ التعاقد الموجب لاعتماد CEO؛ null = كل المشروعات

  // ── جديد: تأخير استطلاع الرضا (W-07) ──
  satisfactionSurveyDelayDays Int       @default(3)

  // ── جديد: موضع بوابة REVIEW في سلسلة الاعتماد (R-05) — معلّق التوضيح ──
  reviewGatePosition          Int?                          // null = غير مفعّل بعد
}
```

### 2.2 — `ExtraItem` · تأكيد المعاينة (W-04)

```prisma
model ExtraItem {
  // ... الحقول الحالية كما هي ...
  confirmedByInspection  Boolean  @default(false)   // W-04 · INS يؤكد المقاسات
}
```
> `ExtraItem` موجود بالفعل بـ `@@map("extra_items")` وأنواعه — **إضافة حقل واحد فقط**.

### 2.3 — `ManufacturingOrder` · أمر التصنيع البديل (W-06)

```prisma
enum FaultType {
  BREAKAGE
  FACTORY_ERROR
  MEASUREMENT_ERROR
  CUSTOMER_DELAY
}

model ManufacturingOrder {
  // ... الحقول الحالية كما هي ...
  parentOrderId  String?      // W-06 · ربط بالأمر الأصلي (Fast-track)
  faultType      FaultType?   // إلزامي عند أوامر البدل (يُفرض app-layer)
  parentOrder    ManufacturingOrder?  @relation("MfgReplacement", fields: [parentOrderId], references: [id], onDelete: SetNull)
  replacements   ManufacturingOrder[] @relation("MfgReplacement")
}
```
> علاقة ذاتية (self-relation) لربط أمر البدل بأصله. `onDelete: SetNull` (علاقة تتبّع، ليست مالية حرجة).

### 2.4 — `Drawing` · سلسلة اعتماد اختيارية (W-05 / R-01)

> **الأساس موجود:** `Drawing.approvedById` + `approvedAt` يكفيان لبوابة اعتماد واحدة.
> السلسلة متعددة البوابات (TEC → INS → CEO) تحتاج تتبّعًا منفصلًا **فقط إذا** قررنا فرض 3 بوابات في قاعدة البيانات.
> **التوصية:** أضِف `status` enum خفيف الآن، واترك حقول الاعتماد الموجودة كما هي.

```prisma
enum DrawingStatus {
  DRAFT
  TEC_APPROVED        // Gate1 · TEC_APPROVER
  INS_VERIFIED        // Gate2 · INSPECTION_MANAGER
  CEO_APPROVED        // Gate3 · مشروط بـ ceoDrawingApprovalThreshold
  RELEASED_TO_FACTORY
  REJECTED
}

model Drawing {
  // ... الحقول الحالية كما هي (approvedById, approvedAt موجودان) ...
  status  DrawingStatus  @default(DRAFT)   // W-05 · تتبّع البوابات
}
```
> قاعدة "المهندس لا يعتمد رسمته" تُفرض في **طبقة التطبيق** (مقارنة `uploadedById` بالمعتمِد)، لا في الschema.

---

## 3. الحوكمة (تُفرض في طبقة التطبيق بعد الهجرة)

| القاعدة | أين |
|---|---|
| `18 ≤ managerApprovalCeilingPct ≤ 25` | Zod في mutation الإعدادات |
| تعديل سياسة الخصم = `ADMIN` فقط | `requireRole(["ADMIN"])` |
| كل تعديل إعدادات → `ActivityLog` | mutation الإعدادات |
| المهندس لا يعتمد رسمته | حارس app-layer (uploadedById ≠ approver) |
| `faultType` إلزامي لأوامر البدل | Zod عند إنشاء أمر بديل |

---

## 4. قائمة التحقق قبل الكتابة (Phase 2.0 — Reconnaissance)

- [x] `QuotationStatus` موجود → **يبقى كما هو** (لا توسيع).
- [x] `ExtraItem` موجود → إضافة حقل واحد.
- [x] `ManufacturingOrder` موجود → إضافة حقلين + self-relation.
- [x] `Drawing` موجود بـ approvedById → إضافة `status` فقط.
- [x] لا نموذج `Team` → نستخدم `InstallationOrder.teamLeadId` الموجود (R-04 يصبح app-layer بالكامل، **بلا schema**).
- [ ] تأكّد أن `SystemSettings` سيقبل الأعمدة الأربعة الجديدة (typed — نعم عبر migration).

---

## 5. ملخص أثر الهجرة

| النموذج | التغيير | الحجم |
|---|---|---|
| `SystemSettings` | +4 أعمدة (3 nullable + 1 default) | صغير |
| `ExtraItem` | +1 حقل | صغير |
| `ManufacturingOrder` | +2 حقل + self-relation + enum `FaultType` | صغير |
| `Drawing` | +1 حقل + enum `DrawingStatus` | صغير |
| **الإجمالي** | **enumـان جديدان + 8 حقول** | **migration واحد صغير** |

---

## 6. ما لا تفعله هذه الهجرة

- ❌ لا تُنشئ `Team` (استخدم `teamLeadId` الموجود — R-04 app-layer).
- ❌ لا توسّع `QuotationStatus` (قرار: يبقى كما هو).
- ❌ لا تلمس `DiscountRequest` / `QuotationApproval` / `Referral` / `CashbackTier` / `PriceListItem` / `PricingFactor` (منفّذة).
- ❌ لا تُنشئ دور `QUALITY_REVIEW` (استخدم `REVIEW` الموجود).
- ❌ لا تحط قيم سياسة صلبة (nullable — يملؤها عمرو).
- ❌ لا تطبّقها من وكيل — يوسف فقط داخل Docker.