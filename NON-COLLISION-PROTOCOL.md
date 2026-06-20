# NON-COLLISION PROTOCOL — قانون عدم تضارب الوكلاء (المرحلة الأولى)

> **الغرض:** منع أكبر سبب لانهيار البناء المتوازي — وكيلان يلمسان نفس الملف أو نفس الـ schema في نفس الوقت (الدرس 1، 10).
> **القاعدة الذهبية:** كل stream يملك مجاله حصريًا. لا أحد يلمس ملكية غيره. الـ schema مجمّد للجميع.

---

## المبدأ الأول — ملكية حصرية للملفات (File Ownership)

كل stream يملك مجلدات/ملفات محددة. **يكتب في ملكيته فقط، ويقرأ من غيرها عند الحاجة — ولا يكتب أبدًا خارج ملكيته.**

| Stream | المجال | يملك (يكتب فيه) | يقرأ فقط (لا يكتب) |
|---|---|---|---|
| **A — العملاء** | Customer, Interaction, تفويض الزميل | app/customers/**, app/api/customers/**, lib/customers/** | schema, lib/auth, lib/rbac |
| **B — التسعير** | Quotation, QuotationItem, DiscountRequest, PriceList | app/quotations/**, app/api/quotations/**, lib/pricing/** | schema, lib/auth, customers (للربط) |
| **C — المعاينات** | InspectionRequest, نوع المعاينة | app/inspections/**, app/api/inspections/**, lib/inspections/** | schema, lib/auth, customers |
| **D — المراجعة + الأدمن** | REVIEW role, SystemSettings, اللوجو, الصلاحيات | app/admin/**, app/review/**, app/api/admin/**, lib/settings/** | schema, lib/auth, lib/rbac |

**الـ Dashboard:** يُبنى **بعد** استقرار A–D (يقرأ من الكل، لا يملك كيانات). لا يبدأ كـ stream متوازٍ.

---

## المبدأ الثاني — الـ Schema مجمّد للجميع (الدرس 10)

- **ممنوع** على أي stream تعديل prisma/schema.prisma.
- كل تغييرات الـ schema للمرحلة 1 طُبّقت **مسبقًا** بواسطة يوسف على main (راجع SCHEMA-CHANGE-REQUESTS.md).
- لو stream اكتشف حاجة لتغيير schema أثناء العمل: **يقف فورًا**، يكتب الطلب في SCHEMA-CHANGE-REQUESTS.md، وينتظر يوسف يطبّقه على main ويعيد البثّ. **لا يعدّل بنفسه.**

---

## المبدأ الثالث — العزل الفيزيائي (Git Worktrees)

كل stream يعمل في **git worktree منفصل** على فرع خاص:
```
git worktree add ../egyglass-stream-A stream-A
git worktree add ../egyglass-stream-B stream-B
git worktree add ../egyglass-stream-C stream-C
git worktree add ../egyglass-stream-D stream-D
```
- كل وكيل في worktree بتاعه — لا يرى تعديلات غير المدموجة من الآخرين.
- الـ main يبقى نظيفًا ومستقرًا (نقطة الحقيقة).

---

## المبدأ الرابع — الملفات المشتركة للقراءة فقط (Shared Read-Only)

هذه الملفات أساس مشترك — **يقرأها الجميع، ولا يكتبها أحد** أثناء الـ streams:
- prisma/schema.prisma (مجمّد)
- lib/auth/**, lib/rbac/** (المصادقة والصلاحيات — أساس)
- AGENTS.md, SCHEMA-CHANGE-REQUESTS.md (الحقيقة)
- components/ui/** (مكوّنات shadcn المشتركة)
- ملفات الإعداد الجذرية (next.config, tailwind.config, docker-compose)

**لو احتاج stream تعديل ملف مشترك:** يقف، يكتب الطلب، ينتظر يوسف. (نفس بروتوكول الـ schema).

---

## المبدأ الخامس — نقاط الدمج المحكومة (Controlled Merge)

- الدمج إلى main يحصل **بواسطة يوسف فقط**، بترتيب، **بعد** اكتمال كل stream والتحقّق منه (الدرس 4).
- **ترتيب الدمج المقترح:** A (العملاء — الأساس) → C (المعاينات) → B (التسعير) → D (المراجعة/الأدمن) → ثم Dashboard.
- بعد كل دمج: تشغيل build + تحقّق GREEN قبل الدمج التالي.
- أي تعارض دمج (merge conflict) = إشارة إن قانون الملكية اتكسر — يُحقّق فيه فورًا.

---

## المبدأ السادس — قاعدة i18n والـ namespaces (تفادي تصادم النصوص)

كل stream يكتب نصوصه في **namespace خاص به** في ملفات الرسائل:
- A → customers.*  |  B → quotations.*  |  C → inspections.*  |  D → admin.*, review.*
- النصوص المشتركة (أخطاء عامة) → errors.* (يُنسّقها يوسف، لا stream).

---

## المبدأ السابع — حدود المحاولات (الدرس 5)

- أقصى **محاولتين** لإصلاح أي عرض (symptom) قبل التوقف والتبليغ.
- لو نفس نوع الخطأ تكرر → وقف، ابحث عن الجذر، بلّغ يوسف. لا تطارد الأعراض.

---

## ميثاق كل stream (يُوضع في رأس كل برومبت)

```
GROUND TRUTH: الكود الحقيقي + schema (مطبّق على main) هو الحقيقة. تجاهل أي افتراض قديم.
OWNERSHIP: تكتب في ملكيتك فقط (انظر جدول الملكية). تقرأ من غيرها — لا تكتب.
SCHEMA: مجمّد. لا تعدّله. عند الحاجة لتغيير → قف واكتب طلبًا وانتظر.
SHARED FILES: للقراءة فقط. عند الحاجة لتعديل → قف واكتب طلبًا.
CHECKPOINTS: قف عند كل نقطة، بلّغ بالدليل، انتظر إذن يوسف.
FIX LIMIT: محاولتان كحد أقصى على أي عرض قبل التوقف والتبليغ.
REPORTING: ماذا عملت + الدليل (build/diff/runtime) + المفاجآت + الخطوة التالية + "في انتظار موافقتك".
```

---

*هذا القانون يُفرض على كل stream عبر برومبته. كسر أي مبدأ = خطر انهيار البناء المتوازي. يوسف هو المنسّق الوحيد لنقاط الدمج وتغييرات الـ schema والملفات المشتركة.*
