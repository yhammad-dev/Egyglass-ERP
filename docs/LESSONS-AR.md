# دليل بناء المشاريع بالوكلاء الذكيين — الأخطاء الجوهرية وكيف تتفاداها

> مرجع عملي مكتوب من تجربة حقيقية أثناء بناء نظام EgyGlass ERP بالوكلاء (OpenCode).
> كل درس هنا **مُثبَت بموقف فعلي حصل** — مش نظرية. الهدف: أي حد يبني مشروع بالوكلاء
> يقرأ ده الأول، فيتفادى الحُفَر اللي وقعنا فيها بدل ما يكتشفها بنفسه.

---

## كيف تستخدم هذا الدليل

كل درس مكتوب بنفس الشكل:
- **القاعدة** — المبدأ في جملة واحدة.
- **الخطأ اللي بتمنعه** — الموقف الحقيقي اللي اتعلمنا منه.
- **في البرومبت** — إزاي تكتب الكلام ده فعليًا في برومبت الوكيل عشان تفرضه.

---

## الدرس 1 — الأساس أولًا، بوكيل واحد لوحده

**القاعدة:** الأساس المشترك (قاعدة البيانات، المصادقة، الصلاحيات، هيكل التطبيق)
يُبنى بوكيل واحد، تسلسليًا، ويُقفل (commit + tag) قبل أي عمل متوازي.

**الخطأ اللي بتمنعه:** لو شغّلت 4 وكلاء من البداية، كلهم محتاجين الأساس يكون
خلص. هيعدّلوا في نفس الملفات وفي نفس الـ schema في نفس الوقت → تصادم migrations،
تصادم ملفات، فوضى لا تُحل. زي 4 عمال بيبنوا بيت والأساس لسه ماتصبّش.

**في البرومبت:**
```
You are the SINGLE foundation agent. No parallel work exists yet.
Build the foundation sequentially. Do NOT spawn or assume other agents.
The foundation must be committed and tagged before any parallel stream starts.
```

---

## الدرس 2 — احفظ قبل ما توسّع (Git قبل أي بناء)

**القاعدة:** ماتبنيش طبقة جديدة فوق شغل غير محفوظ في git. كل مرحلة = commit منفصل.

**الخطأ اللي بتمنعه:** اكتشفنا بعد ساعات شغل إن المشروع **مفيهوش git أصلًا** —
ولا commit واحد. أي غلطة كانت هتمسح كل التعب بلا رجعة. الـ commits الصغيرة المتكررة
مش بتمنع الأخطاء — بتخلّي الأخطاء **قابلة للتراجع** بدل ما تكون كارثة.

**في البرومبت:**
```
Before building anything new, ensure git is initialized and the current
state is committed. After EVERY phase, commit with a clear message.
Small, frequent commits — each is a rollback point.
```

---

## الدرس 3 — الأسرار ماتدخلش git أبدًا

**القاعدة:** ملف `.env` وأي مفاتيح/أسرار لازم يكونوا في `.gitignore` **قبل** أول commit.
وتتحقق بنفسك إنهم مش متسجّلين قبل ما تأكّد.

**الخطأ اللي بتمنعه:** لو `.env` دخل git، الـ DB password والـ AUTH_SECRET
بيفضلوا في تاريخ المشروع **للأبد** — حتى لو مسحتهم بعدين. في بيئة مالية (fintech)
ده حادث أمني حقيقي. الوكيل عندنا تحقّق قبل الـ commit إن `.env` مستبعد — وده الصح.

**في البرومبت:**
```
NEVER commit secrets. Ensure .gitignore excludes .env and .env*.local.
BEFORE committing, run git status and CONFIRM .env and node_modules are
NOT staged. Do not commit until verified clean.
```

---

## الدرس 4 — "تمّ" ليست دليلًا. تحقّق بنفسك قبل القرارات التي لا رجعة فيها

**القاعدة:** ادعاء الوكيل ("اتعمل"، "complete"، "resolved") مش دليل. القرارات
اللي مالهاش رجعة (زي تجميد الـ schema) لازم تتسند بمخرجات حقيقية قابلة للمراجعة.

**الخطأ اللي بتمنعه:** الوكيل قال "stable release resolved" — وطلع لسه فيه نسخة
خاطئة. قال "Build green / ready" — وكان لسه فيه عوائق. قال "Schema complete" —
ولما طلبنا الدليل، طلب خريطة حقل-بحقل مربوطة بالمواصفات. لو كنا صدّقنا الكلمة
وجمّدنا، وكان في حقل ناقص، كان 4 وكلاء هيكتشفوه بعد التجميد (كارثة موزّعة) بدل
ما نكتشفه دلوقتي (رخيص).

**التمييز المهم:** فرّق بين 3 حالات بيخلطها الوكيل:
- **Compiles** (الـ build أخضر) ≠
- **Runs** (شغّال فعليًا في المتصفح) ≠
- **Complete** (الميزة اتبنت بالكامل بالمتطلبات).

**في البرومبت:**
```
A claim of "done" or "complete" is NOT evidence. For any irreversible
decision (e.g. freezing the schema), show the actual artifact: full file
output, field-to-spec mapping, command output. Distinguish explicitly
between "compiles", "runs", and "feature-complete" — never conflate them.
```

---

## الدرس 5 — دوّر على الجذر، لا على العَرَض

**القاعدة:** لما نفس نوع الخطأ يرجع بأشكال مختلفة، السبب غالبًا واحد وأعمق من
كل عَرَض. دوّر على الجذر بدل ما تعالج كل عَرَض لوحده.

**الخطأ اللي بتمنعه:** ظهرت عندنا 3 أخطاء بأسماء مختلفة على مدار جلسات: خطأ
`<Html>`، وخطأ `useContext null`، وكراش `/_global-error`. الوكيل فضل يطارد كل
واحد لوحده — عمل patch للـ runtime، أضاف ملف `global-error.tsx`. وكلها كانت
**عَرَض واحد لسبب واحد:** إعداد `NODE_ENV=development` غلط وقت الـ build. لما
اتصلح الجذر، الأعراض الثلاثة اختفت، والملف اللي اتعمل كـ "حل" اتشال لأنه ماكانش
محتاج أصلًا.

**في البرومبت:**
```
If the same class of error recurs in different forms, STOP patching
symptoms. Find the single root cause. Do not exceed 2 fix attempts on a
symptom before stepping back to diagnose the root.
```

---

## الدرس 6 — البرومبت المحكوم بنقاط وقوف (Checkpoints)

**القاعدة:** البرومبت الجيد لا يقول "اعمل كل ده". يقول: "اعمل المرحلة دي، قف،
بلّغ بالدليل، استنى إذني، بعدين كمّل".

**الخطأ اللي بتمنعه:** لو الوكيل انطلق من الأول للآخر بلا وقوف، أي غلطة في
مرحلة مبكرة بتتراكم وتتضخّم للآخر، وتكتشفها بعد فوات الأوان. الـ checkpoints
بتحصر الأخطاء في مرحلتها، وبتخليك "تفهم أول بأول" بدل ما تتفاجأ في النهاية.

**في البرومبت:**
```
Work sequentially. STOP at every checkpoint and wait for my explicit
"continue" before the next phase. After each phase, run the build, confirm
GREEN, and report with evidence. Do not run ahead.
```

---

## الدرس 7 — افصل مسار التوثيق عن مسار التنفيذ

**القاعدة:** لا تحمّل الوكيل المنفّذ عبء كتابة التوثيق الـ meta (الدروس،
المرجع). والأهم: الكيان الذي يرتكب الأخطاء ليس الكيان الموثوق لتصنيفها بصدق.

**الخطأ اللي بتمنعه:** فكّرنا نخلّي الوكيل يكتب مرجع الدروس وهو بينفّذ. ده غلط
لسببين: (1) **تضارب** — الدروس اتولدت من أخطاء الوكيل نفسه، فهو طرف مش محايد،
وممكن يقع في نفس الخطأ وهو بيوثّقه. (2) **تشتيت** — يكسر مبدأ "وكيل واحد، مهمة
واحدة"، يكبّر الـ context، ويزوّد أخطاء الشغل الأساسي.

**الصح:** التوثيق يكتبه طرف محايد (الإنسان أو مساعد منفصل عن التنفيذ)، في مسار
موازٍ، من تجربة متحقّقة.

**في البرومبت:** (لا تضع التوثيق في برومبت التنفيذ أصلًا — هذا هو الدرس)

---

## الدرس 8 — وثّق الحقيقة المبنية، لا الحقيقة المفترضة

**القاعدة:** لما الوثيقة والكود يختلفوا، **الكود هو الحقيقة**. حدّث الوثيقة لتطابق
الكود — مش العكس. والاختلاف نفسه خطر لازم يتقفل قبل التوازي.

**الخطأ اللي بتمنعه:** وثيقة `AGENTS.md` كانت بتقول Next.js 15 + shadcn جاهز +
next-intl كامل. الواقع المبني كان Next.js **16** + shadcn **مش متركّب** + إعداد
i18n مختلف. لو وزّعنا الـ 4 وكلاء، كل واحد كان هياخد تعليماته من الوثيقة الغلط
ويصطدم بنفس المفاجآت ويحلّها بطريقته → فوضى. عملنا "مرحلة مطابقة" (Reconciliation)
بوكيل واحد تخلّي الوثائق تطابق الواقع **قبل** التوازي.

**في البرومبت:**
```
Documentation must describe what the code ACTUALLY does, never aspirational.
Before spawning parallel agents, run a reconciliation pass: align all shared
docs (stack version, installed libraries, conventions) with verified reality.
```

---

## الدرس 9 — لما أداة متوقّعة تغيب، ثبّت نمطًا موحّدًا بديلًا

**القاعدة:** لو مكوّن/أداة كان متوقّع وجوده وطلع مش موجود، البديل بيشتغل — بس
لازم توثّق **نمطًا واحدًا موحّدًا** يمشي عليه كل الوكلاء، وإلا كل واحد هيخترع نمطه.

**الخطأ اللي بتمنعه:** مكوّن `form` بتاع shadcn طلع مش موجود في نسخة v4. البديل
(`react-hook-form + zod` مباشرة) شغّال، لكن من غير نمط موحّد كان كل stream من
الـ 4 هيكتب الـ forms وعرض أخطاء الـ validation بشكل مختلف → واجهات غير متّسقة
وكود مكرر. وثّقنا نمطًا واحدًا (`FieldError` helper) في `AGENTS.md` للجميع.

**في البرومبت:**
```
If an expected library/component is unavailable, document ONE canonical
pattern all streams must follow for that concern, with a reference snippet,
so every agent builds it identically — not each in its own style.
```

---

## الدرس 10 — احمِ "مصدر الحقيقة الأوحد" بقفل

**القاعدة:** الـ schema بتاع قاعدة البيانات هو مصدر الحقيقة الأوحد للبيانات.
بعد التأسيس يتجمّد، وممنوع أي وكيل يعدّله لوحده. لو احتاج تغيير → يقف ويطلب.

**الخطأ اللي بتمنعه:** لو وكيلين عملوا migrations متعارضة على نفس الـ schema في
نفس الوقت، ده **السبب الأول** لانهيار البناء المتوازي على قاعدة بيانات. بروتوكول
التجميد (اطلب التغيير، ماتعملوش بنفسك) بيمنع ده تمامًا.

**في البرومبت:**
```
The Prisma schema is FROZEN after foundation. Do NOT edit it. If a change
is genuinely needed, STOP, write the request to a change-requests file, and
wait for the human to apply it on main and re-broadcast to all streams.
```

---

## الدرس 11 — احمِ البيانات من الـ rebuild (named volume)

**القاعدة:** قاعدة البيانات في Docker لازم تكون على **named volume**، مش anonymous،
عشان الداتا تعيش عبر `docker compose down` وإعادة البناء.

**الخطأ اللي بتمنعه:** في جلسة مبكرة، الداتا اختفت بعد rebuild واضطرّينا نعيد
الـ seed. مع 4 وكلاء بيعملوا rebuilds متوازية، فقدان بيانات صامت بيتكرر ويلخبط
الكل. في fintech، فقدان بيانات صامت مرفوض تمامًا. كمان: `prisma migrate dev`
ممكن يعمل reset — استخدمه بحذر.

**في البرومبت:**
```
Ensure the DB uses a NAMED Docker volume (not anonymous) so data survives
rebuilds. Warn streams that `prisma migrate dev` can reset data — use with care.
```

---

## الدرس 12 — ميّز القرارات القابلة للرجوع عن غير القابلة

**القاعدة:** القرارات اللي ليها رجعة (تركيب مكتبة) امشِ فيها بثقة معقولة وبسرعة.
القرارات اللي مالهاش رجعة (تجميد schema، حذف بيانات، توزيع وكلاء فوق أساس) لازم
تتسند بدليل مرئي وتأنّي.

**الخطأ اللي بتمنعه:** التعامل مع كل القرارات بنفس مستوى الحذر بيبطّئك بلا داعي،
والتعامل معها كلها بنفس السرعة بيوقعك في كوارث. الميزان: **مستوى التحقق يتناسب
مع تكلفة التراجع.**

**في البرومبت:**
```
Match verification effort to reversibility. Reversible steps: proceed with
reasonable confidence. Irreversible steps (schema freeze, data deletion,
spawning agents on a foundation): require visible evidence before acting.
```

---

## الدرس 13 — الـ build الأخضر مش دليل أمان؛ صفحات الصلاحيات تستاهل فحصًا منفصلًا

**القاعدة:** "بيتجمّع" (build أخضر) ≠ "آمن". أخطر الثغرات بتعدّي الـ build بصمت.
صفحات المصادقة والصلاحيات تستاهل فحصًا أمنيًا صريحًا منفصلًا عن الـ build.

**الخطأ اللي بتمنعه:** صفحة `/users` بنت build أخضر، بس لما فحصناها أمنيًا طلع:
ثغرة قفل النظام (آخر أدمن يحذف نفسه = lockout دائم). دي ثغرة منطق أعمال
(business logic) — مفيش scanner كان هيمسكها. الفحص اليدوي بأسئلة محددة (RBAC على
الـ action؟ الـ hash بيتسرّب؟ تصعيد صلاحية؟ قفل النظام؟) هو اللي كشفها.

**في البرومبت:**
```
For any auth/permission page, run an explicit security review separate from
the build: confirm RBAC is enforced in each server action (not just the
page), no secret/hash leaks to the client, role constrained to a strict enum,
and no business-logic lockout (e.g. removing the last admin). Build green is
not evidence of any of these.
```

---

## الدرس 14 — ميزة الأمان ممكن تغلط في الاتجاهين (ثغرة أو over-block)

**القاعدة:** الـ guard لازم يُختبر في الاتجاهين: "بيمنع الخطر فعلًا؟" و"بيسمح
بالسليم فعلًا؟". المنع الزائد (over-block) عطل تشغيلي زي الثغرة بالظبط.

**الخطأ اللي بتمنعه:** guard آخر أدمن لو اتكتب بزيادة حماس كان هيمنع حذف **أي**
مستخدم بينما في أدمن واحد. الصح: يمنع بس لما الـ target نفسه هو آخر أدمن نشط.
كشفناها بجدول مقارنة: 1 أدمن مقابل 2+، والـ target أدمن مقابل non-admin.

**في البرومبت:**
```
Test any guard in BOTH directions: it must BLOCK the dangerous case AND ALLOW
the safe case. Provide a truth table of scenarios. Over-blocking (rejecting
legitimate operations) is as much a bug as under-blocking.
```

---

## الدرس 15 — جرس إنذار التخمين: "غالبًا/ربما" يوقفك ويطلب الدليل الحي

**القاعدة:** لما الوكيل يقول "likely / possibly / appears correct from reading"،
ده خروج من الدليل لتخمين. أوقفه واطلب **القيمة الحقيقية وقت التشغيل** (log حي).
وقارن دايمًا الحالة الشغّالة بالفاشلة — الفرق بينهم هو السبب.

**الخطأ اللي بتمنعه:** الوكيل خمّن إن `/users` 404 سببها "JWT decode mismatch
أثناء SSR" — نظرية معقّدة. أصرّينا "اطبع الـ role الحقيقي". الطباعة كشفت إن الـ
role تمام والـ auth تمام؛ السبب كان Turbopack مش بيلقط الملف الجديد. لو صدّقنا
النظرية كنا هنعدّل كود auth سليم ونبوّظه. ولاحظ: الـ dashboard (شغّالة) كانت بتنادي
نفس `auth()` — يبقى النظرية اللي بتطبّق على الاتنين غلط، لأن واحدة شغّالة.

**في البرومبت:**
```
When code "appears correct" but behaviour is wrong, reading is exhausted —
do NOT theorize. Print the actual runtime values (a temporary log) and show
them. Compare the working case vs the failing case; the difference between
them is the cause, not a general theory that would apply to both.
```

---

## الدرس 16 — لا تصدّق تقرير الوكيل عن أفعاله؛ تحقّق بالـ git diff

**القاعدة:** الوكيل ممكن **يهلوس تقريرًا** عن أفعاله — يدّعي تغييرات ماعملهاش
(أو ينسى تغييرات عملها). تقريره عن نفسه مش دليل. تحقّق بـ `git diff` / `git status`.

**الخطأ اللي بتمنعه:** الوكيل بلّغ إنه عدّل 5 ملفات (auth, **schema المجمّد**,
middleware) — وادّعى إنه لمس مورد محمي. الـ `git diff` أثبت إنه **ماعملش** أي منهم؛
الـ schema سليم، والـ middleware مش موجود أصلًا. التقرير كان هلوسة، مش الفعل.
لو صدّقناه كنا هندوّر على ضرر مش موجود أو نرجّع ملفات سليمة.

**في البرومبت:**
```
Your final report must be based on `git diff` / `git status` output, not
memory. If you cannot show it in a diff, do not claim you did it. Never say
"build passed so it works." I verify your actions by the diff, not your words.
```

---

## الدرس 17 — انضباط النطاق: الوكيل ممكن "يتحمّس" ويلمس المحمي وهو بيساعد

**القاعدة:** اقفل النطاق صراحة في كل برومبت. الوكيل ممكن يخرج عن المهمة ويلمس
موارد محمية (schema, auth) أو يشتغل على حاجة تانية وهو "بيساعد" — حتى لو إصلاحه
صح. النطاق المحكوم مش عن صحة الإصلاح، هو عن عدم التصرّف في المحمي بلا إذن.

**الخطأ اللي بتمنعه:** أثناء مهمة i18n، الوكيل (في تقريره) خرج لإصلاحات
auth/schema/middleware محناش طلبناها — ونسي المهمة الأصلية. في بناء بـ 4 streams
متوازية، stream بيلمس schema مجمّد بلا إذن بيكسر التوازي للكل.

**في البرومبت:**
```
SCOPE LOCK: edit ONLY the files this task lists. If you believe another file
MUST change, STOP and ask first. Protected resources (frozen schema, auth,
rbac, middleware) require explicit approval in a SEPARATE request — never
bundle them into another task.
```

---

## الدرس 18 — البيئة جزء من الأساس (Turbopack + OneDrive)

**القاعدة:** بيئة التطوير نفسها جزء من الأساس، ولازم تتقفل قبل التوازي. مشروع
على مزامنة سحابية (OneDrive) أو مسار فيه مسافات بيسمّم الـ builds. و Turbopack
داخل Docker مابيلقطش الملفات الجديدة تلقائيًا.

**الخطأ اللي بتمنعه:** قضّينا وقت طويل نطارد "أعراض" (صفحة 404، تغييرات مش
بتظهر، bugs مش بتتحل رغم إن الكود صح) — وكلها كانت عَرَضًا لسببين بيئيين:
(1) **OneDrive** بيتعارض مع الـ file watcher، فكنا نشوف نسخة قديمة. نقل المشروع
لمسار محلي بسيط (`E:\Projects\...` بلا مسافات) حلّ نص المشاكل دفعة واحدة.
(2) **Turbopack-on-Docker** مابيلقطش ملف جديد (route/action) إلا بعد restart —
عضّنا 3 مرات (404 الـ users، تسجيل الخروج، شيل الـ toast).

**في البرومبت:**
```
Project must live on a simple LOCAL path (no spaces, NOT inside OneDrive/cloud
sync) — cloud sync breaks file watchers and serves stale files. With Turbopack
in Docker, RESTART the dev server (docker compose restart app) after adding
any new route or server action before testing — never assume it was picked up.
```

---

## ملحق — قالب البرومبت المحكوم (هيكل جاهز)

```
ROLE: (مين الوكيل، ومهمته الوحيدة)
GROUND TRUTH: (الحقائق المتحقّقة — تغلب أي وثيقة قديمة)
ABSOLUTE RULES: (الممنوعات: ماتعدّلش الـ schema، ماتكتبش أسرار، RBAC سيرفر-سايد...)
PHASES: (مراحل مرقّمة، كل واحدة بهدف + متطلبات + CHECKPOINT يقف ويستنى)
FIX LIMIT: (سقف محاولات الإصلاح قبل ما يسأل — مثلًا 2)
REPORTING FORMAT: (إيه عمل + الدليل + المفاجآت + الخطوة الجاية + "في انتظار موافقتك")
```

---

*هذا الدليل حيّ — يُحدّث بدرس جديد كل ما نتعلمه من موقف متحقّق.*
