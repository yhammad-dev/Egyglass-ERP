# كتيّب: قاعدة بيانات جديدة + المستخدمون الأساسيون

> **الحالة: تجهيز — لم يُنفَّذ أي أمر.** الوكيل جهّز، ويوسف ينفّذ (`L-02` · `L-03`).
> **الأساس:** `master` عند `b258167` · الشجرة نظيفة.

---

## 🔴 صفر — اقرأ هذا أولًا: ثلاثة تصحيحات على التكليف

### (١) الهجرات **43** لا 48
```
ls -1 prisma/migrations | grep -v migration_lock | wc -l   →   43
```
آخرها `20260801120000_c3_sla_settings_and_tec_receipt`. استعمل **43** معيارًا للفحص الأول.

### (٢) 🔴 **ثلاثة كيانات بلا شاشة إدارة ولا استيراد — لا اثنان**

التكليف افترض أن كل البيانات المرجعية «تُدخَل يدويًّا من شاشة». **الجرد ينقض ذلك:**

| الكيان | كاتب في المستودع | شاشة |
|---|---|---|
| `ProductType` | **صفر** | ❌ **لا توجد** |
| `ProductRecipe` | `prisma/seeds/shower-recipes.ts` فقط | ❌ **لا توجد** |
| 🆕 **`ConfigType`** | **صفر** | ❌ **لا توجد** |

`ConfigType` (14 صفًّا) لم يرد في التكليف ولا في جردي الأول — تقرؤه شاشة تسعير المنتج
([quotations/new/[productType]/page.tsx:44](src/app/(dashboard)/quotations/new/[productType]/page.tsx:44))
وتعرضه كقائمة اختيار. مسجَّل في `BL-204`.

**الأثر:** بلا هذه الجداول، شاشة إنشاء عرض السعر تعرض **قائمة منتجات فارغة** —
`getProductTypes()` تُرشِّح بـ`code IN (…) AND isActive` ([lib/pricing/actions.ts:188](lib/pricing/actions.ts:188))
ولا تجد شيئًا ⇒ **لا يمكن إنشاء أي عرض سعر**.

✅ **قرار يوسف: تُنقل من القاعدة الحالية** — منتجات الشركة الحقيقية. الطريقة في §١-ب.

### (٣) تناقض «تيم ليدر واحد» — التحليل صحيح ومُثبَت بالكود
`leadRoute` حقل **مفرد** (`TechnicalRoute?`, [schema:63](prisma/schema.prisma)) والقيم `PROJECTS` و`SOCIAL_MEDIA`.
والحارس يفرضه إلزاميًّا على `TEC_LEAD`
([users/actions.ts:45](src/app/(dashboard)/users/actions.ts:45)) — فتيم ليدر واحد
يترك المسار الآخر **بلا معتمِد مبدئي**، وبوابة `TO-24` تحجب طباعة عروضه للأبد.
⇒ **اعتُمد اثنان.** صحّحه قبل التنفيذ إن كان القصد غير ذلك.

---

## ١-أ · تصنيف البيانات المرجعية بمسارها الفعلي

> ثلاثة مسارات لا واحد. **مُتحقَّق من الكود لا مفترَض.**

| المسار | الكيان | المرجع |
|---|---|---|
| 📥 **استيراد `xlsx`** | `Material` · `PriceListItem` | `/admin/import` — `importMaterialsAction` · `importPriceListAction` |
| 🚚 **نقل من القاعدة** | `ProductType` · `ProductRecipe` · `ConfigType` | لا شاشة ولا استيراد (`BL-204`) |
| ✍️ **إدخال يدوي** | `SystemSettings` · `PricingFactor` · `Factory` | `/admin/pricing` · `/factories` |

**أعمدة ملف الاستيراد (من الكود حرفيًّا):**
- **الخامات:** `code`/`الكود` · `nameAr`/`الاسم` · `category`/`التصنيف` · `unit`/`الوحدة` · `cost`/`التكلفة`
- **قائمة الأسعار:** `spec`/`المواصفة` · `unit`/`الوحدة` · `price`/`السعر` — **والتصنيف يؤخذ من اسم ورقة الإكسل**
- صفٌّ ناقص أو بتصنيف/وحدة غير معروفة **يُتخطّى بصمت** (`continue`) — قارن العدد المُعاد بعدد صفوف الملف.

---

## ١-ب · 🔴 طريقة النقل — والفخّ الذي يجب تفاديه

### الفخّ: المعرّفات

```
Material.id      String @id   ← بلا @default(cuid())
ProductType.id   String @id   ← بلا @default(cuid())
ProductRecipe.materialId → Material.id      (مفتاح أجنبي بالمعرّف)
ProductRecipe.productTypeId → ProductType.id
```

و`importMaterialsAction` يكتب **`id: randomUUID()`** لكل خامة جديدة
([import/actions.ts:101](src/app/(dashboard)/admin/import/actions.ts:101)).

🔴 **النتيجة:** لو استوردتَ الخامات بالشاشة **ثم** نقلتَ `ProductRecipe`، فكل
`materialId` يشير إلى معرّف **لم يعد موجودًا** ⇒ **الاستيراد يفشل بخرق مفتاح أجنبي**.
الترتيب هنا ليس تفضيلًا — هو الفرق بين نجاح وفشل.

**الأرقام:** 45 سطر وصفة تشير إلى **32 خامة متمايزة** من أصل 263.

### القرار المطلوب: ماذا نفعل بالخامات؟

| # | الخيار | المقابل |
|---|---|---|
| **أ** | **انقل الخامات الـ263 بمعرّفاتها** مع الأنواع والوصفات | ✅ الأبسط · صفر إعادة ربط · الوصفات تعمل فورًا. ⚠️ ينقل خامات قد تكون قديمة — **راجع التكاليف بعده** |
| **ب** | انقل **الـ32 المستعمَلة فقط**، واستورد الباقي بالشاشة | أنظف. ⚠️ خطر تصادم: لو استوردتَ لاحقًا خامةً بنفس `code` فالـ`upsert` يُحدّثها ولا يكسر شيئًا ✅ |
| **ج** | استورد كل الخامات بالشاشة، ثم **أعد ربط** `materialId` بالمطابقة على `code` | يتطلّب خطوة `UPDATE … FROM` إضافية — كتابة مباشرة في القاعدة، أكثر عرضة للخطأ |

**توصيتي: (ب)** — تنقل ما تحتاجه الوصفات فقط بمعرّفاته، والباقي يدخل بالمسار
الرسمي (`xlsx`) فتبقى الشاشة هي الطريق الوحيد للخامات الجديدة. و`code` فريد
فالتصادم مستحيل.

### الطريقة المقترحة: `pg_dump` انتقائي — لا سكربت ولا نسخ يدوي

**لماذا لا سكربت TypeScript؟** يحتاج اتصالين بقاعدتين مختلفتين في عملية واحدة —
تعقيد بلا مقابل. و`pg_dump --data-only --table` ينقل الصفوف **بمعرّفاتها** حرفيًّا.

**أمر التصدير** (على القاعدة الحالية — قراءة فقط، لا تمسّها):
```bash
docker compose exec -T db pg_dump -U egyglass -d egyglass \
  --data-only --column-inserts \
  -t '"ProductType"' -t '"ProductRecipe"' -t '"ConfigType"' -t '"Material"' \
  > refdata-products.sql
```
**النجاح:** الملف يحوي `INSERT INTO "ProductType"` و`"ProductRecipe"` و`"ConfigType"`.
تحقّق: `grep -c "INSERT INTO" refdata-products.sql` — المتوقَّع ≈ **9+45+14+263 = 331**
(أو 9+45+14+32 = **100** لو اخترت (ب) — انظر أدناه).

**للخيار (ب)** — الخامات المستعمَلة فقط: صدّر الثلاثة أولًا بلا `Material`، ثم:
```bash
docker compose exec -T db psql -U egyglass -d egyglass -At -c \
"SELECT string_agg(DISTINCT '''' || m.id || '''', ',') FROM \"Material\" m JOIN \"ProductRecipe\" r ON r.\"materialId\"=m.id;"
```
واستعمل الناتج في `pg_dump ... --table '\"Material\"'` مع `WHERE` — أو أبسط: صدّر
كل الخامات (خيار أ) ثم احذف غير المستعمَلة لاحقًا من الشاشة. **القرار لك.**

**أمر الاستيراد** (على القاعدة الجديدة، **بعد** `migrate deploy` و**قبل** أي استيراد `xlsx`):
```bash
docker compose exec -T db psql -U egyglass -d <القاعدة_الجديدة> -v ON_ERROR_STOP=1 < refdata-products.sql
```
🔴 `ON_ERROR_STOP=1` **إلزامي** — بدونه يتخطّى `psql` الأخطاء ويكمل، فتحصل على
بيانات ناقصة تبدو ناجحة.

**ترتيب الاستيراد داخل الملف مضبوط تلقائيًّا؟ لا** — `pg_dump` يرتّب أبجديًّا لا
بالتبعية. إن فشل بخرق مفتاح أجنبي، أدرج الملف بمعاملة واحدة مع تأجيل الفحص:
```bash
docker compose exec -T db psql -U egyglass -d <القاعدة_الجديدة> -v ON_ERROR_STOP=1 \
  -c "BEGIN; SET CONSTRAINTS ALL DEFERRED;" -f /dev/stdin -c "COMMIT;" < refdata-products.sql
```

**التحقّق بعد النقل:**
```bash
docker compose exec -T db psql -U egyglass -d <القاعدة_الجديدة> -c "
SELECT 'ProductType' e,count(*) FROM \"ProductType\"
UNION ALL SELECT 'ProductRecipe',count(*) FROM \"ProductRecipe\"
UNION ALL SELECT 'ConfigType',count(*) FROM \"ConfigType\"
UNION ALL SELECT 'Material',count(*) FROM \"Material\"
UNION ALL SELECT 'وصفات بخامة مفقودة (يجب 0)',
  count(*) FROM \"ProductRecipe\" r LEFT JOIN \"Material\" m ON m.id=r.\"materialId\"
  WHERE r.\"materialId\" IS NOT NULL AND m.id IS NULL;"
```
🔴 **السطر الأخير هو الفحص الحاسم** — يكشف الفخّ أعلاه مباشرةً.

⚠️ **راجع البيانات المنقولة قبل اعتمادها:** تكاليف الخامات وأسماؤها قد تحمل قيم
تجربة. النقل يوفّر البنية، ولا يعفي من مراجعة الأرقام.

---

## ١ · جرد ما يجب إدخاله — مرتَّبًا بالتبعية

> 🔴 **لم أخترع رقمًا واحدًا.** الأعمدة أدناه تصف **ما يلزم**، والقيم أرقام عمل
> يُدخلها عمرو/يوسف. الأعداد في «الحالة اليوم» من القاعدة القائمة للاسترشاد فقط.

| # | الكيان | المسار | الشاشة/الأداة | الدور | الحدّ الأدنى | اليوم |
|---|---|---|---|---|---|---|
| 1 | **`SystemSettings`** | ✍️ يدوي | `/admin/pricing` | `ADMIN` | صفّ `singleton` واحد | 1 |
| 2 | **`Material`** | 🚚 نقل + 📥 استيراد | `/admin/import` · تعديل التكلفة من `/admin/pricing` | `ADMIN` | كل خامة تذكرها وصفة (**32**) | 263 |
| 3 | **`ProductType`** | 🚚 **نقل** | 🔴 لا شاشة | — | الأكواد التسعة | 9 |
| 4 | **`ProductRecipe`** | 🚚 **نقل** | 🔴 لا شاشة | — | سطر لكل منتج يُسعَّر | 45 |
| 4ب | **`ConfigType`** | 🚚 **نقل** | 🔴 لا شاشة | — | حسب المنتج | 14 |
| 5 | **`PricingFactor`** | ✍️ يدوي | `/admin/pricing` | `ADMIN` | واحد ≥ `factorMinimum` | 6 |
| 6 | **`Factory`** | ✍️ يدوي | `/factories` | `PROCUREMENT` · `ADMIN` | واحد قبل أول أمر تصنيع | 1 |
| 7 | `PriceListItem` | 📥 استيراد | `/admin/import` | `ADMIN` | **صفر — غير مستعمَل** | 0 |
| 8 | `CashbackTier` | ✍️ يدوي | `/admin/pricing` | `ADMIN` | **صفر — اختياري** | 0 |

🔴 **الترتيب المُلزِم:**
`migrate deploy` → **نقل (2·3·4·4ب) دفعةً واحدة** → `SystemSettings` → `PricingFactor`
→ `Factory` → استيراد بقية الخامات بـ`xlsx`.
السبب في §١-ب: `ProductRecipe` يشير إلى `ProductType` **و**`Material` **بالمعرّف**،
والاستيراد بالشاشة يولّد معرّفات جديدة ⇒ **النقل قبل الاستيراد، لا العكس.**

**البندان 7 و8 ليسا حاجزًا:** صفر صفّ في القاعدة العاملة اليوم والنظام يعمل —
مطابق لقرار `P-01` («لا حاجة لقوائم أسعار منفصلة»).

### ⚠️ `SystemSettings` — ما يجب إدخاله بيد الأدمن

| المفتاح | ملاحظة |
|---|---|
| `inspectionSlaInsideDays` = **2** · `inspectionSlaOutsideDays` = **4** | مهلة المعاينة (`SCR-INS-C`) |
| `discountBasePct` · `discountMaxReqPct` · `factorMinimum` · `vatPct` · `quotationValidDays` | سياسات — أرقام عمل |
| `warrantyTextProjects` | نصّ الضمان — سنة ميلادية |
| 🔴 **`warrantyTextSocialMedia`** | **رُصد أنه مطابق لنصّ المشروعات — خطأ.** الصحيح: صيانة مجانية 3 سنوات + ضمان صيانة مدى الحياة (§8 في `CLAUDE.md`). **أدخِل النصّ الصحيح ولا تنسخ.** |

---

## ٢ · جدول الحسابات — خمسة عشر

**النمط المقترح:** `<وظيفة><رقم>@egyglass.com` — قصير، بلا أسماء أشخاص (`L-10`)،
عدا الحسابين المرتبطين بشخص بعينه. **صحّح ما تشاء قبل الإنشاء.**

| # | الاسم المقترح | البريد المقترح | `role` | `department` | `leadRoute` | `teamLead` |
|---|---|---|---|---|---|---|
| 1 | يوسف حماد | `admin@egyglass.com` | `ADMIN` | `EXECUTIVE` | — | — |
| 2 | مدير المبيعات | `sales.manager@egyglass.com` | `SALES_MANAGER` | `SALES` | — | — |
| 3 | مندوب مبيعات ١ | `sales1@egyglass.com` | `SALES_REP` | `SALES` | — | — |
| 4 | مندوب مبيعات ٢ | `sales2@egyglass.com` | `SALES_REP` | `SALES` | — | — |
| 5 | مدير المعاينات | `insp.manager@egyglass.com` | `INSPECTION_MANAGER` | `INSPECTIONS` | — | — |
| 6 | مندوب معاينات ١ | `insp1@egyglass.com` | `INSPECTION_REP` | `INSPECTIONS` | — | — |
| 7 | مندوب معاينات ٢ | `insp2@egyglass.com` | `INSPECTION_REP` | `INSPECTIONS` | — | — |
| 8 | محمد فاروق | `m.farouk@egyglass.com` | `TEC_APPROVER` | `TECHNICAL_OFFICE` | — | — |
| 9 | تيم ليدر مشروعات | `tec.lead.projects@egyglass.com` | `TEC_LEAD` | `TECHNICAL_OFFICE` | **`PROJECTS`** | — |
| 10 | تيم ليدر سوشيال | `tec.lead.social@egyglass.com` | `TEC_LEAD` | `TECHNICAL_OFFICE` | **`SOCIAL_MEDIA`** | — |
| 11 | مهندس مشروعات ١ | `tec1@egyglass.com` | `TECHNICAL_OFFICE` | `TECHNICAL_OFFICE` | — | **#9** |
| 12 | مهندس مشروعات ٢ | `tec2@egyglass.com` | `TECHNICAL_OFFICE` | `TECHNICAL_OFFICE` | — | **#9** |
| 13 | المراجعة | `review@egyglass.com` | `REVIEW` | `TECHNICAL_OFFICE` | — | — |
| 14 | الحسابات | `accounting@egyglass.com` | `ACCOUNTING` | `ACCOUNTING` | — | — |
| 15 | الموارد البشرية | `hr@egyglass.com` | `HR` | `HR` | — | — |

🔴 **ترتيب الإنشاء مُلزِم:** الحسابان **9 و10 قبل 11 و12** — لأن قائمة اختيار
التيم ليدر لا تعرض إلا من هو `TEC_LEAD` بالفعل، والحارس يرفض معرّفًا غير صالح
([users/actions.ts:148](src/app/(dashboard)/users/actions.ts:148)).

✅ **الشاشة تدعم الحقلين** — مُتحقَّق: `leadRoute` **إلزامي** على `TEC_LEAD`
(`errors.leadRouteRequired`)، و`teamLeadId` **اختياري** على `TECHNICAL_OFFICE`.
⚠️ فالقيد الثاني (ربط المهندسين) **لا يفرضه النظام** — يُنفَّذ بانضباطك.

⚠️ **`admin@egyglass.com`:** الحساب القديم بهذا البريد **معطَّل** في القاعدة الحالية
لحماية الأثر التدقيقي. في قاعدة جديدة لا تعارض — لكن **كلمة مروره يجب أن تكون
مولَّدة جديدة**، ممنوع أي قيمة كانت يومًا في المستودع.

---

## ٣ · كتيّب الأوامر

> ✅ **قرار يوسف (س-2): انتظار AWS.** ⇒ **لا يُنشأ شيء محليًّا الآن.**
> البيئة المحلية تبقى كما هي، وهذا الكتيّب **خطة الرفع** تُنفَّذ على AWS.
>
> 🟢 **ما يُنفَّذ الآن (محليًّا، آمن ومستقلّ عن AWS):**
> **خ-1** (نسخة احتياطية) و**خ-1ب** (تصدير البيانات المرجعية) — كلاهما **قراءة فقط**
> ولا يمسّ شيئًا، ويُنتجان ملفّين يُرفعان لاحقًا. تنفيذهما الآن يحميك من ضياع
> البيانات إن تعطّلت البيئة قبل الرفع.
>
> ⏸️ **ما يُؤجَّل حتى AWS:** خ-2 إلى خ-6.
>
> **كل الأوامر من جذر المشروع.** ممنوع كتم المخرجات (`>/dev/null`) — الفشل الصامت
> أخطر من الظاهر. **لا تنتقل لخطوة قبل تحقّق معيار نجاح سابقتها.**

### 🟢 خ-1 · نسخة كاملة من القاعدة الحالية (نفّذها الآن)
```bash
docker compose exec -T db pg_dump -U egyglass -d egyglass -Fc > backup-egyglass-$(date +%Y%m%d-%H%M).dump
```
**النجاح:** ملف حجمه > 100 KB. تحقّق: `ls -lh backup-egyglass-*.dump`

### 🟢 خ-1ب · تصدير البيانات المرجعية للنقل (نفّذها الآن)
الأمر في **§١-ب** — يُنتج `refdata-products.sql`. **قراءة فقط، لا يمسّ القاعدة.**
⚠️ احتفظ بالملفّين (`backup-*.dump` و`refdata-products.sql`) خارج المستودع.

---
### ⏸️ ما يلي يُنفَّذ على AWS — لا محليًّا

### خ-2 · قاعدة جديدة فارغة
```bash
psql -h <AWS_HOST> -U <AWS_USER> -d postgres -c "CREATE DATABASE egyglass OWNER <AWS_USER>;"
```
**النجاح:** `CREATE DATABASE`.
⚠️ على RDS قد تكون القاعدة منشأة سلفًا — تخطَّ الخطوة حينها.

### خ-3 · بناء البنية (43 هجرة)
```bash
DATABASE_URL="postgresql://<USER>:<PASS>@<AWS_HOST>:5432/egyglass?schema=public" npx prisma migrate deploy
```
**النجاح:** `All migrations have been successfully applied`.

### خ-4 · 🚚 نقل البيانات المرجعية — **قبل أي استيراد `xlsx`**
```bash
psql -h <AWS_HOST> -U <AWS_USER> -d egyglass -v ON_ERROR_STOP=1 < refdata-products.sql
```
ثم **استعلام التحقّق في §١-ب** — وخاصةً سطر «وصفات بخامة مفقودة = 0».

### خ-5 · حساب الأدمن وحده
```bash
DATABASE_URL="postgresql://<USER>:<PASS>@<AWS_HOST>:5432/egyglass?schema=public" \
SEED_ADMIN_PASSWORD='<كلمة مرور قوية — لا تُحفظ في ملف>' npx tsx prisma/seed-admin.ts
```
⚠️ يرفض غياب المتغيّر **ويرفض القيمة النائبة والكلمات الضعيفة** — يتوقف قبل أي كتابة.
🔒 **قاعدة إلزامية:** كلمة مرور **مولَّدة جديدة وقت النشر** — ممنوع أي قيمة كانت
يومًا في المستودع أو في البيئة المحلية.

### خ-6 · توجيه التطبيق ثم إنشاء الأربعة عشر
اضبط `DATABASE_URL` في بيئة AWS، وأعد إقلاع التطبيق.
**النجاح — الشرط الإلزامي:** زمن الإقلاع **أحدث** من آخر بناء.
🔴 هذا الفحص أنقذنا **ثلاث مرات اليوم** من استنتاج «الإصلاح فشل» على خادم بائت.

ثم: ادخل بحساب الأدمن ⇒ `/users` ⇒ أنشئ بالترتيب **9 و10 أولًا**، ثم 11 و12
(اربطهما بـ#9)، ثم الباقي.

### 🔙 التراجع
البيئة المحلية **لم تُمس إطلاقًا** — تبقى عاملة على قاعدتها. والتراجع على AWS =
إعادة `migrate deploy` على قاعدة جديدة، فالنسخة الاحتياطية (خ-1) هي شبكة الأمان.

---

## ٤ · استعلامات التحقق الستة

> نفّذها على `egyglass_fresh`. بدّل `-d egyglass` إلى `-d egyglass_fresh`.

```bash
# 1) عدد الهجرات المطبَّقة = 43
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT count(*) AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL;"

# 2) كل جدول معاملات = صفر
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT 'Customer' e,count(*) FROM \"Customer\" UNION ALL SELECT 'Quotation',count(*) FROM \"Quotation\" UNION ALL SELECT 'InspectionRequest',count(*) FROM \"InspectionRequest\" UNION ALL SELECT 'QuotationRequest',count(*) FROM quotation_requests UNION ALL SELECT 'Contract',count(*) FROM contracts UNION ALL SELECT 'ManufacturingOrder',count(*) FROM \"ManufacturingOrder\" UNION ALL SELECT 'InstallationOrder',count(*) FROM \"InstallationOrder\" UNION ALL SELECT 'Document',count(*) FROM documents UNION ALL SELECT 'ActivityLog',count(*) FROM \"ActivityLog\";"

# 3) عدد المستخدمين = 15
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT count(*) AS users FROM \"User\";"

# 4) leadRoute للتيم ليدرين
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT email, \"leadRoute\" FROM \"User\" WHERE role='TEC_LEAD' ORDER BY email;"

# 5) ربط المهندسين بالتيم ليدر (يجب ألا يكون فارغًا)
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT u.email, l.email AS team_lead FROM \"User\" u LEFT JOIN \"User\" l ON l.id=u.\"teamLeadId\" WHERE u.role='TECHNICAL_OFFICE';"

# 5ب) توزيع الأدوار — يكشف نقصًا أو تكرارًا بنظرة
docker compose exec -T db psql -U egyglass -d egyglass_fresh -c "SELECT role, count(*) FROM \"User\" GROUP BY 1 ORDER BY 1;"
```

**الفحص السادس — الدخول بكل حساب.** بيد يوسف، ولكلٍّ يُتحقَّق:
- ترويسة الصفحة تعرض **الدور الصحيح**
- عناصر القائمة الجانبية المتوقَّعة لذلك الدور
- 🔴 **`TEC_LEAD`:** يرى طلبات مساره — **لو رأى صفرًا فـ`leadRoute` فارغ** (`BL-203`)
- 🔴 **`TECHNICAL_OFFICE`:** لو رأى طلبات **كل** المسارات فالربط بالتيم ليدر مفقود (`TO-30` يفشل مفتوحًا)

---

## ٥ · ما لم أغطِّه

| # | البند |
|---|---|
| 1 | **لم أنفّذ أي أمر** — لا نسخة ولا إنشاء ولا هجرة (`L-02`/`L-03`) |
| 2 | **لم أكتب كلمة مرور** في أي موضع — `<PLACEHOLDER>` فقط |
| 3 | **لم ألمس القاعدة الحالية** — صفر صفّ مُنشأ أو محذوف أو معدَّل |
| 4 | **لم أخترع بيانات مرجعية** — لا سعرًا ولا عاملًا ولا وصفة |
| 5 | **`Employee`** — سجلّ الموارد البشرية منفصل عن `User`. الحسابات الخمسة عشر **لا تُنشئ موظفين**، وHR خارج نطاق UAT بقرارك |
| 6 | **AWS/UAT** — لم أتناوله، البيئة محلية |
| 7 | 🔴 **`ProductType`/`ProductRecipe`** — لا حلّ لهما داخل المنتج (§6 س-1) |

---

## ٦ · القرارات — محسومة (يوسف، 2026-08-03)

| # | السؤال | القرار |
|---|---|---|
| **س-1** | `ProductType`/`ProductRecipe` | ✅ **تُنقل من القاعدة الحالية** — منتجات الشركة الحقيقية. الطريقة §١-ب · مسجَّل `BL-204` |
| **س-2** | موضع القاعدة | ✅ **انتظار AWS** — لا إنشاء محليًّا. خ-1 و خ-1ب فقط تُنفَّذان الآن |
| **س-3** | تيم ليدر | ✅ **اثنان** — `PROJECTS` و`SOCIAL_MEDIA` |
| **س-4** | البريد والأسماء | ✅ **المقترح معتمَد** |
| **س-5** | `Employee` | ✅ **يؤجَّل مع HR** |

| **س-6** | الخامات | ✅ **(أ) — الـ263 كلها.** «الكتالوج كامل أنفع من مقطوع، والتنظيف قرار منفصل» · المراجعة مسجَّلة `BL-205` |

### ✅ خ-1 و خ-1ب — نُفِّذتا (2026-08-03)

| الملف | الحجم | التحقّق |
|---|---|---|
| `backup-egyglass-20260804-1924.dump` | 242 KB | `pg_restore -l` ⇒ **330 كائنًا** · الجداول الستة الحرجة حاضرة |
| `refdata-products.sql` | 98 KB | **331 صفًّا** = `ProductType 9` + `ProductRecipe 45` + `ConfigType 14` + `Material 263` — مطابق للقاعدة صفًّا بصفّ |

**الموضع:** `E:/Projects/EgyGlass_ERP_Backups/` — **خارج المستودع** عمدًا.
✅ **القاعدة لم تُمسّ:** `users=50 · quotations=42 · materials=263` قبل وبعد.
⚠️ **الملفّان لقطة زمنية** — أي تغيير في القاعدة بعد اليوم لن يظهر فيهما. أعِد
التصدير قبل الرفع إن طال الوقت.

---

## ٧ · الأسئلة المفتوحة السابقة (للأرشيف)

### 🔴 س-1 · كيف تُدخَل `ProductType` و`ProductRecipe`؟ (حاجز — يمنع أول عرض سعر)

| الخيار | المقابل |
|---|---|
| **أ · نقلها من القاعدة الحالية** | أسرع وأدقّ — الوصفات مضبوطة ومختبَرة. ⚠️ يخالف قرارك «الإدخال يدويًّا»، لكنها **ليست بيانات اختبار** بل تعريف منتجات الشركة |
| **ب · سكربت بذور جديد** | نظيف ومُراجَع. يحتاج منك **جدول الوصفات كاملًا** (منتج × خامة × قاعدة كمية) — عمل بشري كبير |
| **ج · بناء شاشة إدارة** | الحلّ الصحيح طويل الأمد. **موجة تطوير مستقلة**، تؤخّر البيئة |

**توصيتي: (أ)** — بشرط جردها معك قبل النقل للتأكّد أنها لا تحمل قيم اختبار. وتُسجَّل
(ج) بندًا مستقلًّا في `BACKLOG`.

### س-2 · موضع القاعدة الجديدة
| الخيار | المقابل |
|---|---|
| **قاعدة ثانية في نفس الحاوية** (المقترح أعلاه) | لا تلمس القديمة · تراجع بسطر · نفس الـvolume ⇒ **حذف الـvolume يمحو الاثنتين** |
| **volume منفصل** | عزل تامّ · يستهلك قرصًا · وتعديل `docker-compose.yml` أوسع |
| **انتظار AWS** | البيئة النهائية · يؤخّر كل شيء |

**توصيتي: الأولى** — التراجع فيها أرخص، والنسخة الاحتياطية (خ-1) تغطّي خطر الـvolume.

### س-3 · تيم ليدر واحد أم اثنان؟ (§صفر-3)
### س-4 · هل تعتمد البريد والأسماء المقترحة كما هي؟
### س-5 · هل يُنشأ `Employee` مقابل لكل مستخدم أم يؤجَّل مع HR؟
