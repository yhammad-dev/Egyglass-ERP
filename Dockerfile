# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════════════════════
#  EgyGlass ERP — صورة الإنتاج (بناء مسبق · pre-built)
# ═══════════════════════════════════════════════════════════════════════════════
#
# 🔴 **هذا الملف لم يُستعمل قط قبل اليوم.** `docker-compose.prod.yml` القديم كان
#    يشغّل `node:20-alpine` ويبني **وقت الإقلاع** (`npm ci && build && start`)،
#    فبقي هذا الـDockerfile مكتوبًا وغير مُختبَر. ⇒ **يُبنى ويُشغَّل محليًّا قبل
#    الرفع** (م-4 في كتيّب النشر) — لا يُرفع على ثقة.
#
# لماذا البناء المسبق أصلًا: النسخة القائمة (908 ميجا) تستهلك swap **بلا حمل**،
# والبناء وقت الإقلاع يجعل كل إعادة تشغيل بطيئة ومعرَّضة لقتل OOM. الصورة المبنية
# مسبقًا **ثابتة**: ما اختُبر هو ما يعمل، والإقلاع صار ثوانيَ لا دقائق.
#
# ── ما أُصلح هنا مقابل النسخة السابقة (كلها أعطال حقيقية لا تجميل) ──
#  1. 🔴 `next.config.ts` **لم يكن يُنسخ** إلى مرحلة التشغيل ⇒ `serverActions.
#     bodySizeLimit: "14mb"` يسقط إلى الافتراضي (~1MB) ⇒ **كل رفع رسمة > 1 ميجا
#     ينكسر** برسالة نقل مبهمة. `next start` يقرأ الـconfig وقت التشغيل.
#  2. 🔴 `tzdata` غائبة من `node:20-alpine` ⇒ `TZ` تُتجاهل **بصمت** وتبقى UTC.
#     أثرها: 20 مُنسِّق وقت غير مثبَّت (`BL-184`) يرسمون بـUTC على الخادم و
#     بالقاهرة في المتصفح، و`document-number.ts:128` يشتقّ **شهر المستند** من
#     `getMonth()` المحلي ⇒ مستند يُصدر 01 سبتمبر 01:00 بالقاهرة يحمل شهر 8.
#  3. تشغيل بمستخدم غير جذر (`node`, uid 1000) — الحاوية خلف nginx على إنترنت.
#  4. وسم `GIT_SHA` داخل الصورة **وفي متغيّر بيئة** ⇒ التحقّق من جِدّة البناء صار
#     قابلًا للإثبات لا للتخمين (أوقعنا ثلاث مرات في «الحاوية تخدم بناءً قديمًا»).
#
# ── قرار مُعلَن: node_modules **كاملة** (بلا `--omit=dev`) ──
# الحجم المدفوع: ~848 ميجا بدل ~500. المشترى به:
#   • `prisma` CLI حاضر ⇒ `prisma migrate deploy` و`migrate status` يعملان من
#     نفس الحاوية (م-5 والتحقّق اليومي يعتمدان عليهما).
#   • `tsx` حاضر ⇒ `npx tsx prisma/seed-admin.ts` يعمل (م-7).
#   • `scripts/patch-next-html-context.js` يرقّع `node_modules/next/dist/compiled/
#     next-server/pages*.js` — ملف **وقت تشغيل**. نسخ node_modules المرقَّعة
#     كاملةً يضمن بقاء الرقعة؛ أي تقسيم يتطلب إعادة تشغيل الرقعة يدويًّا.
# البديل (`--omit=dev` + إعادة الرقعة + نسخ `.prisma`) يوفّر ~300 ميجا مقابل
# ثلاث نقاط فشل جديدة. **مؤجَّل بوعي، لا مُغفَل** — مسجَّل في «ما لم يُغطَّ».
# ═══════════════════════════════════════════════════════════════════════════════

ARG NODE_IMAGE=node:20-alpine

# ── deps: تثبيت الاعتماديات (postinstall يشغّل رقعة next تلقائيًّا) ──────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# scripts/ تُنسخ **قبل** npm ci لأن postinstall في package.json يستدعيها.
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
RUN npm ci

# ── build: توليد عميل Prisma ثم بناء Next ───────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ⚠️ `next.config.ts` فيه `typescript.ignoreBuildErrors: true` ⇒ البناء **لا يفشل
#    على أخطاء الأنواع** (خطّ الأساس المُتحقَّق: 31 خطأ `tsc`). لا تستنتج من نجاح
#    البناء أن الأنواع سليمة — الفحصان منفصلان تمامًا.
RUN npx prisma generate && npm run build

# ── runner: صورة التشغيل ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# tzdata إلزامية: بدونها `TZ` لا تفعل شيئًا وتبقى البيئة UTC بصمت.
# التحقّق: docker compose exec app date  ⇒ يجب أن ينتهي بـ EEST (صيفًا) أو EET (شتاءً)
RUN apk add --no-cache tzdata

ENV NODE_ENV=production
ENV TZ=Africa/Cairo
ENV PORT=3000

# وسم الإصدار — يُمرَّر من سطر البناء ويصير **دليل الجِدّة** بعد كل نشر.
ARG GIT_SHA=unknown
ARG BUILT_AT=unknown
ENV APP_GIT_SHA=${GIT_SHA}
ENV APP_BUILT_AT=${BUILT_AT}
LABEL org.opencontainers.image.title="EgyGlass ERP"
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.created="${BUILT_AT}"

COPY --from=build --chown=node:node /app/.next          ./.next
COPY --from=build --chown=node:node /app/node_modules   ./node_modules
COPY --from=build --chown=node:node /app/public         ./public
COPY --from=build --chown=node:node /app/prisma         ./prisma
COPY --from=build --chown=node:node /app/messages       ./messages
COPY --from=build --chown=node:node /app/scripts        ./scripts
COPY --from=build --chown=node:node /app/package.json   ./package.json
# 🔴 هذان السطران هما إصلاح العطل رقم 1 أعلاه — لا تحذفهما.
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/tsconfig.json  ./tsconfig.json

# جذر الملفات المرفوعة خارج public/ (TO-11) — الأقسام الأربعة.
# ⚠️ عند تركيب قرص EBS على هذا المسار **يختفي محتوى الصورة** ويظهر محتوى القرص.
#    وهذا مقبول: الكتّاب الأربعة كلهم ينادون `mkdir(..., {recursive:true})` قبل
#    الكتابة (مُتحقَّق: technical-office · inspections · lib/admin · lib/documents).
#    الشرط الوحيد الباقي: **ملكية نقطة التركيب لـuid 1000** — انظر م-2.
RUN mkdir -p /app/var/uploads/company    /app/var/uploads/drawings \
             /app/var/uploads/inspections /app/var/uploads/documents \
 && chown -R node:node /app/var /app/.next

USER node
EXPOSE 3000

# استدعاء next مباشرةً لا عبر `npm start`: npm لا يمرّر SIGTERM بثبات إلى الابن،
# فيموت التطبيق بـSIGKILL بعد المهلة بدل إغلاق نظيف للاتصالات.
CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
