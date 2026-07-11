# SCR-015 — المستخلصات + الفاتورة الكاملة (تصميم معتمد — جاهز للتطبيق)

> **الحالة:** معتمد. القرارات محسومة. يوسف يطبّق الـ migration (القسم أ)، ثم الوكيل ينفّذ الكود (القسم ب).
> **المبدأ الحاكم:** المستند المالي الرسمي = **سند مجمّد** (snapshot وقت الإصدار، لا يتغير بتغير البيانات) — نفس منطق قاعدة العقد (§8). داخلي بالكامل، **لا تكامل ETA**.

---

## القرارات المحسومة (مرجع سريع)

| القرار | الحسم |
|---|---|
| المستخلص | **كيان جديد** (رقم تسلسلي + تاريخ + نسبة إنجاز + حالة + snapshot مجمّد) — لا مستند لحظي |
| الفاتورة | **كيان جديد** (رقم تسلسلي + تاريخ + snapshot + حالة) — داخلي بلا ETA |
| العلاقة | **منفصلان، ربط اختياري (الخيار ب):** مشاريع = مستخلص→فاتورة · سوشيال = فاتورة مباشرة بلا مستخلص |
| نسبة الإنجاز | **إدخال يدوي** (راندا/كريم) — لا ربط تلقائي بالتركيبات (مؤجّل لو ثبت مطلوبًا) |
| علاقة المستخلص بـ PaymentMilestone | مستقلان مفاهيميًا (milestone=تخطيط، statement=توثيق إنجاز). ربط اختياري، ليس 1:1 |
| أنواع الدفعات | **label حر (بلا تغيير)** — لا enum (يحفظ مرونة راندا 60/20/20) |
| شيت العميل | تجميع قراءة per-customer (app-layer، لا schema) |
| تنظيف مرصود | `getAccountingDashboard` يجمع بـ float — يُصحّح لـ Decimal ضمن هذا الـ SCR (يلمس نفس الدالة) |

---

## أ. Schema-layer (يوسف يطبّق الـ migration)

### كيان 1 — `ProgressStatement` (المستخلص)
| الحقل | النوع | Nullable | ملاحظة |
|---|---|---|---|
| `id` | String @id @default(cuid()) | لا | |
| `statementNumber` | Int | لا | تسلسلي per-contract (مستخلص 1، 2، 3...) — يُولّد عند الإصدار |
| `contractId` | String | لا | FK → Contract (onDelete Restrict — سند مالي) |
| `progressPct` | Decimal(5,2) | لا | نسبة الإنجاز التنفيذي (إدخال يدوي) |
| `statementValue` | Decimal(14,2) | لا | **snapshot مجمّد** = قيمة المستخلص وقت الإصدار |
| `status` | StatementStatus enum | لا | DRAFT / ISSUED / PAID |
| `issuedAt` | DateTime? | نعم | تاريخ الإصدار (يُملأ عند ISSUED) |
| `issuedById` | String? | نعم | من أصدر (SetNull) |
| `milestoneId` | String? | نعم | ربط اختياري بـ PaymentMilestone (SetNull) |
| `notes` | String? | نعم | بيان حر |
| `createdAt`/`updatedAt` | DateTime | | |

**enum جديد:** `StatementStatus { DRAFT, ISSUED, PAID }`

### كيان 2 — `Invoice` (الفاتورة)
| الحقل | النوع | Nullable | ملاحظة |
|---|---|---|---|
| `id` | String @id @default(cuid()) | لا | |
| `invoiceNumber` | Int | لا | تسلسلي عام (رقم فاتورة رسمي) — يُولّد عند الإصدار |
| `customerId` | String | لا | FK → Customer (Restrict) |
| `contractId` | String? | نعم | مشاريع: مرتبطة بعقد · سوشيال: NULL (Restrict/SetNull حسب قرار) |
| `statementId` | String? | نعم | ربط اختياري بمستخلص (مشاريع). سوشيال = NULL (SetNull) |
| `quotationId` | String? | نعم | مصدر البنود (للـ snapshot) |
| `subtotal` | Decimal(14,2) | لا | **snapshot** |
| `discountAmount` | Decimal(14,2) | لا | **snapshot** |
| `vatAmount` | Decimal(14,2) | لا | **snapshot** (14% على الصافي بعد الخصم — §5) |
| `totalAmount` | Decimal(14,2) | لا | **snapshot** الصافي النهائي |
| `status` | InvoiceStatus enum | لا | DRAFT / ISSUED / PAID / CANCELLED |
| `issuedAt` | DateTime? | نعم | |
| `issuedById` | String? | نعم | SetNull |
| `notes` | String? | نعم | |
| `createdAt`/`updatedAt` | DateTime | | |

**enum جديد:** `InvoiceStatus { DRAFT, ISSUED, PAID, CANCELLED }`

### قواعد التصميم
- **snapshot مجمّد:** القيم المالية (`statementValue`, `subtotal`, `discountAmount`, `vatAmount`, `totalAmount`) تُحفظ وقت الإصدار ولا تُقرأ لايف — نفس مبدأ `Contract.totalValue`. تغيير عرض السعر لاحقًا لا يغيّر فاتورة صادرة.
- **الترقيم التسلسلي:** يُولّد عند الانتقال لـ ISSUED (لا في DRAFT) — يمنع فجوات في الأرقام الرسمية.
- **الحذف:** Restrict على العلاقات المالية (سند لا يُحذف). deactivate/cancel لا delete.
- **الربط الاختياري (الخيار ب):** `Invoice.statementId` و`Invoice.contractId` كلاهما nullable → سوشيال ياخد فاتورة مباشرة (بلا عقد/مستخلص)، مشاريع تربط.
- Migration واحدة: كيانان + enumان + علاقات. صفر backfill (كيانات جديدة فارغة).

---

## ب. App-layer (الوكيل ينفّذ بعد الـ migration)

### 1. منطق المستخلص
- `createStatement` (requireRole ACCOUNTING/ADMIN): DRAFT، نسبة يدوية، قيمة محسوبة.
- `issueStatement`: DRAFT→ISSUED، يولّد `statementNumber` تسلسلي per-contract، يجمّد `statementValue`، يكتب `issuedAt`+`issuedById`، ActivityLog.
- كل الحسابات **Decimal** (لا float).

### 2. منطق الفاتورة
- `createInvoice` (requireRole ACCOUNTING/ADMIN): DRAFT، snapshot من Quotation (subtotal/discount/vat/total).
- `issueInvoice`: DRAFT→ISSUED، يولّد `invoiceNumber` تسلسلي عام، يجمّد الـ snapshot، ActivityLog.
- `cancelInvoice`: ISSUED→CANCELLED (لا حذف — سند)، ActivityLog بالسبب.
- مسار سوشيال: فاتورة مباشرة (contractId/statementId = NULL).

### 3. شيت العميل (تجميع قراءة، لا schema)
- استعلام per-customer بأعمدة راندا: رقم عرض السعر · تاريخ · بيان · إجمالي التعاقد · مدفوع · المستحق.
- في شاشة العميل (`customers/[id]`) أو تقرير الحسابات.
- **يصحّح تجميع getAccountingDashboard لـ Decimal** (البند المرصود).

### 4. قوالب الطباعة (src/app/(print)/)
- قالب المستخلص: رقم + تاريخ + نسبة إنجاز + قيمة + بيان + سجل مستند.
- قالب الفاتورة: رقم + تاريخ + بنود snapshot + خصم + ضريبة 14% + صافي + مدفوع/مستحق + لوجو (config).
- كلاهما يقرأ snapshot المجمّد، لا بيانات لايف.

### 5. مفاتيح الترجمة (ar+en معًا)
`statements.*` (العنوان، الحالات، الأزرار) · `invoices.*` · `errors.*` ذات الصلة (رقم مكرر، حالة غير صالحة).

---

## ج. الملفات المتأثرة (عند التنفيذ)
| الملف | التغيير |
|---|---|
| `prisma/schema.prisma` | كيانان + enumان + علاقات (**يوسف يطبّق**) |
| `lib/finance/statements.ts` (جديد) | منطق المستخلص |
| `lib/finance/invoices.ts` (جديد) | منطق الفاتورة |
| `lib/finance/actions.ts` | شيت العميل + إصلاح Decimal في getAccountingDashboard |
| `src/app/(print)/statements/[id]/` (جديد) | قالب المستخلص |
| `src/app/(print)/invoices/[id]/` (جديد) | قالب الفاتورة |
| شاشات الحسابات + شاشة العميل | أزرار الإصدار + شيت العميل |
| `messages/ar.json` + `en.json` | المفاتيح |

---

## د. بروتوكول التنفيذ (بعد اعتماد يوسف)
1. **يوسف:** يطبّق migration الكيانين داخل Docker → build GREEN + DB up to date → tag `schema-scr015-done` (بعد commit الدفعة).
2. **الوكيل:** ينفّذ app-layer بـ checkpoints — منطق المستخلص → الفاتورة → شيت العميل → الطباعة — كل مرحلة باختبار فعلي.
3. **التحقق:** إصدار مستخلص (رقم تسلسلي + snapshot مجمّد) · إصدار فاتورة (مشاريع مربوطة + سوشيال مباشرة) · شيت العميل بأعمدة راندا · طباعة الاثنين.

---

## هـ. نقاط تُطرح على راندا/عمرو قبل أو أثناء UAT (ليست بلوكر schema)
- تنسيق رقم الفاتورة الرسمي (تسلسل بسيط أم بصيغة سنة/رقم مثل 2026-001؟).
- هل المستخلص يحتاج اعتماد (موافقة) قبل الإصدار، أم راندا تصدره مباشرة؟
- صيغة "البيان" في شيت العميل (حر أم قوالب جاهزة).