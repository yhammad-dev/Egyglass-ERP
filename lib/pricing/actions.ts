"use server";

import { z } from "zod";
import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { QUOTATION_PRICING_ROLES, QUOTATION_STATUS_ROLES } from "@/lib/quotation-roles";
// TO-31: حارس المسار في وحدة مشتركة — يستعمله هذا الملف و`lib/review/actions.ts`.
import { checkEngineerRoute } from "@/lib/services/engineer-route";
// TO-39: صيغة الإجماليات وقرار «هل الخصم نافذ» في مصدر واحد يتشاركه هذا الملف
// و`src/lib/actions/discount.ts` — كانت الصيغة مكتوبة ثلاث مرات.
import { recomputeQuotationTotals, effectiveDiscountPct } from "@/lib/quotation-totals";
import { auth } from "@/lib/auth";
import { getSystemSettings } from "@/lib/config";
import { calculateRecipe } from "./calculateRecipe";
import {
  groupRecipeLines,
  selectRecipeLines,
  type ItemPricingInput,
} from "./recipe-selection";
import { notifyRole, sendNotification } from "@/lib/notifications/send";
import {
  recomputeQuotationRequestStatus,
  recomputeCustomerStage,
} from "@/lib/services/status-derivation";

// دفعة هـ (W-01): التسعير للمكتب الفني حصرًا. المندوب يطلب لا يسعّر.
// SALES_MANAGER يبقى (إشراف/حالات مباشرة) — SALES_REP سُحب.
// TO-26: التيم ليدر يسعّر بنفسه (قرار المالك) ⇒ TEC_LEAD داخل قائمة التسعير.
// TO-29: `SALES_MANAGER` **أُزيل** — «مدير المبيعات يرسل طلب تسعير فقط ولا يعمل
// عروض أسعار» (قرار المالك). كان بقية من قبل W-01 الذي سحب `SALES_REP` ونسيه،
// والتناقض كان ظاهرًا: المندوب خارج القائمة ومديره داخلها.
// مساره المشروع سليم ومفتوح: `createQuotationRequestAction` محروس بـ
// `ALLOWED_ROLES` (`customers/actions.ts:39`) وهو يضمّه.
// TO-32: القائمة انتقلت إلى `@/lib/quotation-roles` (نفس نمط TO-31) لتستهلكها
// الواجهة من المصدر نفسه — زر «تعديل» كان على قائمة ثانية منحرفة في الاتجاهين.
// النشر هنا مرة واحدة ⇒ مواضع `requireRole(PRICING_ROLES)` التسعة بلا أي تغيير.
const PRICING_ROLES = [...QUOTATION_PRICING_ROLES];

// 🔴 TO-26 — قائمة منفصلة عمدًا عن PRICING_ROLES: `updateQuotationStatus` ليس
// تسعيرًا، إنه المسار الذي يكتب `approvedById` عند الانتقال إلى APPROVED — أي
// **اعتماد فعلي** بلا مرور بـQUOTATION_APPROVAL_ROLES.
// TO-31 — انتقلت إلى `@/lib/quotation-roles` لتكون **مصدرًا واحدًا** يتشاركه
// السيرفر والواجهة. ملف `"use server"` لا يُصدِّر إلا دوالّ async، فبقاؤها هنا
// كان يفرض نسخة ثانية في الواجهة — وهو مصدر الانحراف الذي تصلحه TO-31.

// BL-127 (يوسف، 2026-07-17): قرّاء التسعير كانوا بلا حارس — أرقام التكلفة التجارية
// (PricingFactor.value) تصل أي مستدعٍ مُصادَق (AUTHZ-002). الحارس الآن = PRICING_ROLES نفسها.
// شكل الرفض = [] (لا خطأ صريح): نفس شكل فشل الـDB القائم في هذه القرّاء ⇒ لا يكسر .map
// في المستدعين، ومتسق مع D-39 (بالع + سجّل).
//
// التسجيل **للمُصادَق فقط**: أكشن "use server" قابل للاستدعاء بـPOST من مجهول يملك
// action ID، فكتابة صف عند كل رفض تفتح إغراق ActivityLog (DoS/تلويث الأثر). المجهول
// يُسجَّل console فقط، بلا صف DB.
//
// auth() تُستدعى هنا لأن requireRole لا يُرجع هوية عند الرفض (rbac.ts:17 = {authorized:false}).
// التسجيل نفسه محوَّط: فشله لا يمنع الإرجاع أبدًا.
async function logPricingReadDenied(reader: string): Promise<void> {
  try {
    const session = await auth();
    const actorId = session?.user?.id as string | undefined;
    const actorRole = (session?.user?.role as string | undefined) ?? "ANONYMOUS";

    if (!actorId) {
      console.error(`[pricing] PRICING_READ_DENIED ${reader} — مجهول (بلا جلسة)`);
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId: actorId,
        action: "PRICING_READ_DENIED",
        entity: "Pricing",
        entityId: reader,
        details: `[تحذير آلي] رفض قراءة تسعير (${reader}) — الدور: ${actorRole}`,
      },
    });
  } catch {
    // آخر خط دفاع — التسجيل لا يجوز أن يرمي (وإلا حوّل رفضًا صامتًا إلى انهيار)
  }
}
// RR-2: the low-factor floor is no longer hardcoded. It is read from
// SystemSettings.factorMinimum (SCR-008) and enforced server-side below.
const FACTOR_MINIMUM_FALLBACK = 1.5;

// Pricing-audit fix: all money math below runs in Prisma.Decimal (decimal.js) —
// never JS floats. Client-supplied numbers cross into Decimal via String() so
// no binary float representation ever leaks into the pipeline.
const D = Prisma.Decimal;
const toDec = (n: number) => new D(String(n));

export async function getProductRecipes(productTypeId: string) {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) {
      await logPricingReadDenied("getProductRecipes");
      return [];
    }

    return await prisma.productRecipe.findMany({
      where: { productTypeId },
      include: { Material: true },
    });
  } catch (error) {
    console.error("[getProductRecipes]", error);
    return [];
  }
}

export async function getPricingFactors() {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) {
      await logPricingReadDenied("getPricingFactors");
      return [];
    }

    return await prisma.pricingFactor.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
    });
  } catch (error) {
    console.error("[getPricingFactors]", error);
    return [];
  }
}

export async function getConfigTypes(productTypeId: string) {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) {
      await logPricingReadDenied("getConfigTypes");
      return [];
    }

    return await prisma.configType.findMany({
      where: { productTypeId },
      orderBy: { nameAr: "asc" },
    });
  } catch (error) {
    console.error("[getConfigTypes]", error);
    return [];
  }
}

export async function getConfigTypeOptions(productTypeId: string) {
  try {
    // نقطة الدخول من الكلاينت (product-section.tsx:52) — الحارس هنا هو النافذ.
    // getConfigTypes الداخلية محروسة أيضًا (دفاع بالعمق)؛ الرفض يخرج من هنا قبلها.
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) {
      await logPricingReadDenied("getConfigTypeOptions");
      return [];
    }

    const configTypes = await getConfigTypes(productTypeId);
    return configTypes.map((c) => ({ id: c.id, nameAr: c.nameAr }));
  } catch (error) {
    console.error("[getConfigTypeOptions]", error);
    return [];
  }
}

const QUOTATION_PRODUCT_TYPE_CODES = [
  "SHOWER",
  "HANDR_STRAIGHT",
  "HANDR_INCLINED",
  "CLADDING",
  "LAMINATED",
  "GLASS_CEILING",
  "GLASS_FLOOR",
  "FACADE_MODULAR",
  "FACADE_SPIDER",
];

export async function getProductTypes() {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) {
      await logPricingReadDenied("getProductTypes");
      return [];
    }

    // 🔴 TO-40 — `usesPanelCount` **مُشتق من الوصفة لا من كود المنتج**: أي منتج
    // تحتوي وصفته سطرًا واحدًا بقاعدة ألواح يُظهر الحقل تلقائيًا، بلا قائمة أكواد
    // تُصان يدويًا وتُنسى عند إضافة منتج جديد.
    const types = await prisma.productType.findMany({
      where: { code: { in: QUOTATION_PRODUCT_TYPE_CODES }, isActive: true },
      select: {
        id: true,
        code: true,
        nameAr: true,
        ProductRecipe: {
          where: { qtyRule: { in: ["BY_PANEL", "BY_PANEL_JOINT"] } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { nameAr: "asc" },
    });

    return types.map((t) => ({
      id: t.id,
      code: t.code,
      nameAr: t.nameAr,
      usesPanelCount: t.ProductRecipe.length > 0,
    }));
  } catch (error) {
    console.error("[getProductTypes]", error);
    return [];
  }
}

const calculateProductPricingSchema = z.object({
  height: z.coerce.number().positive("errors.invalidInput"),
  width: z.coerce.number().positive("errors.invalidInput"),
  configTypeId: z.string().optional(),
  pricingFactorId: z.string().min(1, "errors.invalidInput"),
  // TO-40: عدد الألواح — اختياري وصحيح غير سالب. المنتج بلا قواعد ألواح لا يرسله.
  panelCount: z.coerce.number().int().nonnegative().optional(),
});

export async function calculateProductPricing(
  productTypeCode: string,
  input: unknown
): Promise<
  | {
      success: true;
      data: {
        lines: {
          materialId: string;
          notes: string | null;
          nameAr: string;
          qty: number;
          unitCost: number;
          lineTotal: number;
          factorMode: string;
          // TO-40: مصدر الكمية — عرض فقط، لا يدخل أي حساب.
          qtyRule: string;
          qtyMultiplier: number;
        }[];
        subtotalBeforeFixed: number;
        fixedTotal: number;
        grandTotal: number;
      };
      // Retained for backward-compatible typing of the quotation-builder consumer.
      // RR-2: the server no longer returns these — a below-minimum factor is now
      // rejected with { error: "errors.factorRequiresApproval" } instead.
      requiresApproval?: true;
      factor?: number;
    }
  | { error: string }
> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = calculateProductPricingSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { height, width, configTypeId, pricingFactorId, panelCount } = parsed.data;

    const productType = await prisma.productType.findUnique({
      where: { code: productTypeCode },
    });
    if (!productType) return { error: "errors.notFound" };

    const [configType, pricingFactor, recipes] = await Promise.all([
      configTypeId
        ? prisma.configType.findUnique({ where: { id: configTypeId } })
        : Promise.resolve(null),
      prisma.pricingFactor.findUnique({ where: { id: pricingFactorId } }),
      getProductRecipes(productType.id),
    ]);

    if (configTypeId && !configType) return { error: "errors.notFound" };
    if (!pricingFactor) return { error: "errors.notFound" };

    const factorValue = pricingFactor.value.toNumber();

    // RR-2: enforce the pricing-factor floor server-side (never client-trusted).
    // Threshold comes from SystemSettings.factorMinimum, not a hardcoded constant.
    const settings = await getSystemSettings();
    const factorMinimum = settings?.factorMinimum.toNumber() ?? FACTOR_MINIMUM_FALLBACK;

    if (factorValue < factorMinimum) {
      // Do NOT return a calculation or a client-controllable approval flag.
      // Notify ADMINs that a below-floor factor was attempted, then block.
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      await Promise.all(
        adminUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.lowFactorApprovalTitle",
            body: `محاولة تسعير بعامل منخفض (${factorValue.toFixed(2)}) أقل من الحد الأدنى (${factorMinimum.toFixed(2)})`,
            type: "LOW_FACTOR_APPROVAL_REQUESTED",
          })
        )
      );
      return { error: "errors.factorRequiresApproval" };
    }

    const dimensions = {
      area: height * width,
      length: height + width + width,
      // TO-44: المحيط الكامل — مُشتق من نفس المقاسين، بلا مدخل جديد.
      perimeter: 2 * (height + width),
      configCount: configType?.anglesCount ?? 0,
      // TO-40: غير مُرسَل ⇒ 0 ⇒ قاعدتا الألواح تُرجعان 0. لا تخمين من العرض هنا:
      // الاقتراح (العرض ÷ 1.6) شأن الواجهة، والسيرفر يحسب بما وصله فقط.
      panelCount: panelCount ?? 0,
    };

    const result = calculateRecipe(recipes, dimensions, factorValue);

    return { success: true, data: result };
  } catch (error) {
    console.error("[calculateProductPricing]", error);
    return { error: "errors.serverError" };
  }
}

// TO-05: مدخلات إعادة حساب تكلفة الكتالوج على السيرفر. **اختيارية** — بند بلا وصفة
// (يدوي) يُحفظ كما كان بلا صورة تكلفة، فلا يكسر أي مسار قائم.
const quotationItemPricingSchema = z.object({
  productTypeCode: z.string().min(1, "errors.invalidInput"),
  height: z.coerce.number().positive("errors.invalidInput"),
  width: z.coerce.number().positive("errors.invalidInput"),
  configTypeId: z.string().optional(),
  pricingFactorId: z.string().min(1, "errors.invalidInput"),
  // TO-40: يُحفظ ضمن `pricingInput` (TO-33) فيُسترجع عند التعديل.
  panelCount: z.coerce.number().int().nonnegative().optional(),
  selections: z.record(z.string(), z.string()),
});

const createQuotationItemSchema = z.object({
  description: z.string().min(1, "errors.invalidInput"),
  quantity: z.coerce.number().positive("errors.invalidInput"),
  unitPrice: z.coerce.number().nonnegative("errors.invalidInput"),
  // TO-05: تُقرأ للتسجيل فقط — لا تدخل في unitPrice ولا في أي إجمالي.
  //
  // 🔴 TO-21-FIX — **متعمّد أن يكون `unknown` هنا، ولا يُعاد إلى المخطط الصارم.**
  // كان `quotationItemPricingSchema.optional()`، فصار فشل شكل `pricing` يُفشل
  // safeParse للطلب **كله** ⇒ رفض حفظ العرض بـerrors.invalidInput. قبل TO-21 لم
  // يظهر العطل لأن `pricing` كان يُسقَط في الواجهة فلا يُفحص أصلًا.
  // القاعدة: `pricing` بيانات مساعدة لحساب التكلفة — **حفظ العرض أهم من صورة
  // التكلفة**، فلا يجوز لفشلها إسقاط مستند تجاري سليم. الفحص الصارم يتم على حدة
  // لكل بند في `parseItemPricing` أدناه: فشله ⇒ تجاهل + تحذيرة + costSnapshot=null.
  // باقي حقول البند تبقى صارمة كما هي.
  pricing: z.unknown().optional(),
});

/**
 * TO-21-FIX — الفحص الصارم لـ`pricing` **معزولًا** عن قبول الطلب.
 * يُرجع المدخلات الصالحة أو `null`، ولا يرمي ولا يُفشل شيئًا أبدًا.
 * ⚠️ التحذيرة تحمل مسار الحقل ونوع الخطأ فقط — بلا قيم (قد تحمل بيانات عمل).
 */
function parseItemPricing(raw: unknown, itemIndex: number): ItemPricingInput | null {
  if (raw === undefined || raw === null) return null;

  const parsed = quotationItemPricingSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`)
    .join(" | ");
  console.warn(
    `[pricing] COST_SNAPSHOT_NULL item#${itemIndex} PRICING_INPUT_INVALID — ${issues} (العرض يُحفظ رغم ذلك)`
  );
  return null;
}

// TO-21-FIX — مسار حقل zod ⇒ مفتاح ترجمة اسم الحقل، ليرى المستخدم **أي حقل** فشل
// بدل "بيانات غير صالحة" المجرّدة. المفاتيح قائمة بالفعل عدا `quantity`.
const FIELD_LABEL_KEYS: Record<string, string> = {
  customerId: "quotations.customer",
  title: "quotations.new.quotationTitle",
  items: "quotations.detail.product",
  description: "quotations.detail.product",
  quantity: "quotations.new.quantity",
  unitPrice: "quotations.detail.itemSubtotal",
  discountPct: "quotations.new.discountPct",
};

/**
 * يحوّل أول خطأ zod إلى `{fieldKey, itemIndex}` للعرض في الواجهة.
 * مسار البند يأخذ الشكل ["items", i, "field"] ⇒ نلتقط الرقم واسم الحقل.
 */
function describeFirstIssue(error: z.ZodError): { fieldKey?: string; itemIndex?: number } {
  const issue = error.issues[0];
  if (!issue) return {};

  const path = issue.path;
  if (path[0] === "items" && typeof path[1] === "number") {
    const field = typeof path[2] === "string" ? path[2] : "items";
    return { fieldKey: FIELD_LABEL_KEYS[field], itemIndex: path[1] };
  }

  const root = typeof path[0] === "string" ? path[0] : undefined;
  return { fieldKey: root ? FIELD_LABEL_KEYS[root] : undefined };
}

// TO-05 — تكلفة الكتالوج للوحدة الواحدة وقت التسعير، محسوبة **server-side** من نفس
// مسار `calculateRecipe` الذي أنتج السعر: نفس الوصفات، نفس الأبعاد، نفس قاعدة الاختيار.
// الفرق الوحيد: بلا معامل ربح — نجمع (كمية × Material.cost) للأسطر المختارة فقط.
//
// الطبقة المالية: الكمية تأتي من `calculateRecipe` (مشتقة من الأبعاد، ليست مبلغًا)،
// أما **التكلفة فتُقرأ Decimal من الصف مباشرة** (`Material.cost`) لا من `line.unitCost`
// المحوَّل إلى number — فلا يمر أي مبلغ عبر float (L-07).
//
// null تعني «غير معروفة» ولا تُلفَّق أبدًا: نوع منتج/عامل مفقود، أو صفر سطر مختار،
// أو خامة اختفت بين لحظة الحساب ولحظة الحفظ ⇒ null، لا صفر.
//
// TO-21: كل فرع null كان **صامتًا** — الأثر الوحيد رقم مجمّع في ActivityLog لا يميّز
// السبب. الآن كل فرع يطبع سببه ومعرّفه الفني. `itemIndex` **إلزامي** لا اختياري:
// وسيط ناقص عند الاستدعاء = خطأ بناء، لا سجل بلا هوية.
// ⚠️ السجل يحمل معرّفات فنية فقط — بلا اسم عميل وبلا أي مبلغ.
async function computeCatalogCostSnapshot(
  pricing: ItemPricingInput,
  itemIndex: number
): Promise<Prisma.Decimal | null> {
  const tag = `[pricing] COST_SNAPSHOT_NULL item#${itemIndex}`;

  const productType = await prisma.productType.findUnique({
    where: { code: pricing.productTypeCode },
  });
  if (!productType) {
    console.warn(`${tag} PRODUCT_TYPE_NOT_FOUND — code=${pricing.productTypeCode}`);
    return null;
  }

  const [configType, pricingFactor, recipes] = await Promise.all([
    pricing.configTypeId
      ? prisma.configType.findUnique({ where: { id: pricing.configTypeId } })
      : Promise.resolve(null),
    prisma.pricingFactor.findUnique({ where: { id: pricing.pricingFactorId } }),
    getProductRecipes(productType.id),
  ]);

  if (pricing.configTypeId && !configType) {
    console.warn(`${tag} CONFIG_TYPE_NOT_FOUND — configTypeId=${pricing.configTypeId}`);
    return null;
  }
  if (!pricingFactor) {
    console.warn(`${tag} PRICING_FACTOR_NOT_FOUND — pricingFactorId=${pricing.pricingFactorId}`);
    return null;
  }

  const dimensions = {
    area: pricing.height * pricing.width,
    length: pricing.height + pricing.width + pricing.width,
    // TO-44: نفس اشتقاق مسار الحساب الحيّ — لا صيغة ثانية.
    perimeter: 2 * (pricing.height + pricing.width),
    configCount: configType?.anglesCount ?? 0,
    // TO-40: من المدخلات المحفوظة (TO-33). بند سابق لـTO-40 بلا الحقل ⇒ 0 ⇒
    // قاعدتا الألواح تُرجعان 0، فتكلفته تبقى كما حُسبت وقتها بلا انحراف.
    panelCount: pricing.panelCount ?? 0,
  };

  // المعامل لا يؤثر على التكلفة (نتجاهل lineTotal)؛ يُمرَّر كما هو للحفاظ على نفس المسار.
  const { lines } = calculateRecipe(recipes, dimensions, pricingFactor.value.toNumber());
  const grouped = groupRecipeLines(lines);
  const selected = selectRecipeLines(grouped, pricing.selections);
  if (selected.length === 0) {
    // عدد الأسطر/الاختيارات فقط — لا محتواها (أسماء خامات ليست بيانات عميل لكنها لا تلزم هنا).
    console.warn(
      `${tag} NO_SELECTED_LINES — productTypeCode=${pricing.productTypeCode} lines=${lines.length} selections=${Object.keys(pricing.selections).length}`
    );
    return null;
  }

  // TO-21 — فرع صامت **سابع** اكتُشف أثناء تحقق runtime، وهو أخطر من null:
  // اختيار يشير لخامة لم تعد ضمن أسطر الوصفة (تغيّرت بين لحظة الحساب ولحظة الحفظ)
  // يسقط بصمت داخل `selectRecipeLines` — فلا null ولا استثناء، بل **تكلفة أقل**
  // من التكلفة المقابلة للسعر المحفوظ ⇒ هامش مبالغ فيه يبدو سليمًا.
  // لا نغيّر السلوك هنا عمدًا (قاعدة الاختيار مشتركة مع الواجهة — تغييرها قرار منفصل):
  // نُبلِّغ فقط. مسجَّل للمراجعة في BACKLOG.
  const unmatchedSelections = Object.keys(pricing.selections).filter((category) => {
    const options = grouped[category];
    if (!options) return true; // الفئة اختفت من الوصفة كليًا
    if (options.length <= 1) return false; // تُضم تلقائيًا — الاختيار لا أثر له أصلاً
    return !selected.some((line) => line.materialId === pricing.selections[category]);
  });
  if (unmatchedSelections.length > 0) {
    console.warn(
      `[pricing] COST_SNAPSHOT_PARTIAL item#${itemIndex} SELECTION_NOT_MATCHED — categories=${unmatchedSelections.join(",")} productTypeCode=${pricing.productTypeCode}`
    );
  }

  const costByMaterialId = new Map(
    recipes.filter((r) => r.Material).map((r) => [r.Material!.id, r.Material!.cost])
  );

  let cost = new D(0);
  for (const line of selected) {
    const unitCost = costByMaterialId.get(line.materialId);
    // `undefined` صراحةً لا `!unitCost` — تكلفة صفر قيمة مشروعة (خامة مجانية/مضمَّنة).
    if (unitCost === undefined) {
      console.warn(
        `${tag} MATERIAL_COST_MISSING — materialId=${line.materialId} productTypeCode=${pricing.productTypeCode}`
      );
      return null;
    }
    cost = cost.add(toDec(line.qty).mul(unitCost));
  }

  return cost;
}

/**
 * TO-33 — يحسب لكل بند: صورة التكلفة + مدخلات التسعير المُتحقَّقة التي تُحفظ معه.
 *
 * 🔴 مصدر واحد يستعمله الإنشاء **والتعديل**. كان المنطق داخل `createQuotation`
 * وحدها، فمسار التعديل يعيد بناء البنود من أرقام يدوية بلا تكلفة ولا مدخلات
 * ⇒ `costSnapshot` يُمسح إلى null عند كل تعديل (BL-151). نسخة ثانية منه كانت
 * ستُبقي المسارين قابلين للانحراف — وهو نمط تكرّر في هذه السلسلة أكثر من مرة.
 *
 * السلوك كما هو حرفيًا (TO-21-FIX): فشل مدخلات بند **لا يُسقط العرض** — يُسجَّل
 * ويُكمَل بـnull. البند بلا مدخلات (يدوي) يبقى بلا تكلفة ولا مدخلات محفوظة.
 */
async function resolveItemPricing(
  items: { pricing?: unknown }[]
): Promise<{
  costSnapshots: (Prisma.Decimal | null)[];
  pricingInputs: (ItemPricingInput | null)[];
}> {
  const costSnapshots: (Prisma.Decimal | null)[] = [];
  const pricingInputs: (ItemPricingInput | null)[] = [];

  for (const [i, item] of items.entries()) {
    const itemPricing = parseItemPricing(item.pricing, i);
    // TO-33: يُحفظ **المُتحقَّق منه** لا الخام — لا نكتب في القاعدة شكلًا لم يُفحص.
    pricingInputs.push(itemPricing);

    if (!itemPricing) {
      if (item.pricing === undefined || item.pricing === null) {
        // TO-21: بند يدوي مشروع، أو إسقاط في طريق الواجهة. التمييز يبدأ من هذا السطر.
        // (الشكل غير الصالح سُجِّل بالفعل داخل parseItemPricing بسببه التفصيلي.)
        console.warn(`[pricing] COST_SNAPSHOT_NULL item#${i} NO_PRICING_INPUT — البند وصل بلا مدخلات تسعير`);
      }
      costSnapshots.push(null);
      continue;
    }

    try {
      costSnapshots.push(await computeCatalogCostSnapshot(itemPricing, i));
    } catch (error) {
      console.error(`[pricing] COST_SNAPSHOT_ERROR item#${i}`, error);
      costSnapshots.push(null);
    }
  }

  return { costSnapshots, pricingInputs };
}

const createQuotationSchema = z.object({
  customerId: z.string().min(1, "errors.invalidInput"),
  title: z.string().min(1, "errors.invalidInput"),
  items: z.array(createQuotationItemSchema).min(1, "errors.invalidInput"),
  needsApproval: z.boolean().optional(),
  pricingFactor: z.coerce.number().positive().optional(),
  discountPct: z.coerce.number().min(0, "errors.invalidInput").max(100, "errors.invalidInput").optional(),
  // دفعة هـ (W-01): ربط العرض بطلب التسعير الذي أنشأه المندوب — يرث المسار
  quotationRequestId: z.string().optional(),
});

export async function createQuotation(
  input: unknown
): Promise<
  | { success: true; data: { id: string } }
  // TO-21-FIX: `fieldKey` مفتاح ترجمة اسم الحقل و`itemIndex` رقم البند (0-based) —
  // كلاهما اختياري، فالمستدعي القديم الذي يقرأ `error` فقط يظل يعمل.
  | { error: string; fieldKey?: string; itemIndex?: number }
> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = createQuotationSchema.safeParse(input);
    if (!parsed.success) {
      // TO-21-FIX: كان الرفض صامتًا تمامًا — لا الواجهة تعرف الحقل ولا السجل يذكره،
      // فيصير التشخيص الميداني مستحيلًا. المسارات والأكواد فقط، بلا قيم.
      console.warn(
        `[pricing] CREATE_QUOTATION_INVALID_INPUT — ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`)
          .join(" | ")}`
      );
      return { error: "errors.invalidInput", ...describeFirstIssue(parsed.error) };
    }

    const { customerId, title, items, needsApproval, pricingFactor, quotationRequestId } =
      parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    // دفعة هـ (W-01+W-02): لو العرض ناشئ عن طلب تسعير —
    // طلب بلا عرض = عرض أولي (INITIAL) · طلب له عرض = إعادة تسعير (FINAL) بسلسلة محفوظة
    let previousQuotationId: string | null = null;
    if (quotationRequestId) {
      const req = await prisma.quotationRequest.findUnique({
        where: { id: quotationRequestId },
        select: { id: true, quotationId: true, technicalRoute: true },
      });
      if (!req) return { error: "errors.notFound" };

      // 🔴 TO-30 — الإنفاذ النافذ. إخفاء الطلب من القائمة (`buildWhere`) لا يكفي:
      // من يعرف الرابط `/quotations/new?requestId=…` يصل الشاشة مباشرة.
      const routeError = await checkEngineerRoute(
        roleCheck.role,
        roleCheck.userId,
        req.technicalRoute,
        "createQuotation"
      );
      if (routeError) return { error: routeError };

      previousQuotationId = req.quotationId; // null للأولي، العرض السابق لإعادة التسعير
    }

    const settings = await getSystemSettings();
    const validDays = settings?.quotationValidDays ?? 3;
    const vatPct = settings?.vatPct ?? new D(14);
    const discountBasePct = settings?.discountBasePct ?? new D(18);
    const discountMaxReqPct = settings?.discountMaxReqPct ?? new D(25);

    // RR-1/STEP-4: totals are ALWAYS re-derived server-side from the line items,
    // the negotiated discount, and the VAT rate in SystemSettings. No client-supplied
    // subtotal/total is accepted (the input schema does not expose those fields).
    // Pricing-audit fix: computed in Decimal end-to-end (zero float).
    const lineTotals = items.map((item) => toDec(item.quantity).mul(toDec(item.unitPrice)));
    const subtotal = lineTotals.reduce((sum, lt) => sum.add(lt), new D(0));
    const discountPct = toDec(parsed.data.discountPct ?? 0);

    // RR-1 STEP-1.4: hard cap — a discount above the configured maximum is rejected outright.
    if (discountPct.gt(discountMaxReqPct)) {
      return { error: "errors.discountExceedsMax" };
    }

    // D-19 (قرار يوسف): **أي خصم > 0 = طلب** — لا تطبيق مباشر أيًا كانت النسبة.
    const discountNeedsApproval = discountPct.gt(0);

    // 🔴 TO-39 — التنفيذ صار مطابقًا للنيّة المكتوبة أعلاه. كان الخصم يُطبَّق
    // على الإجماليات **فورًا** ثم تُوضع الحالة `PENDING_APPROVAL`، فيخرج مستند
    // مطبوع عليه «بانتظار الموافقة» وخصم مُطبَّق فعلًا (رآه المالك بعينه).
    // الآن: `discountPct` يُحفظ كسجلّ للطلب، والإجماليات تُحسب **بلا خصم**
    // والضريبة على الإجمالي الكامل. التطبيق يقع عند الاعتماد وحده
    // (`decideDiscountAction`) بنفس هذه الصيغة المشتركة.
    // RR-1 STEP-1.2/1.3 محفوظة كما هي: خصم ⇒ صافي ⇒ ضريبة على الصافي.
    const { discountAmount, taxAmount, total } = recomputeQuotationTotals(
      subtotal,
      effectiveDiscountPct(discountPct, /* isApproved */ false),
      vatPct
    );
    const requiresApproval = (needsApproval ?? false) || discountNeedsApproval;

    // RR-1 STEP-1.5 (cashback): referral cashback is a SEPARATE post-execution
    // disbursement (see docs/quotation-math.md) and cannot be computed correctly at
    // quote time — the Customer model has no referrer linkage to populate
    // Referral.referrerId. cashbackPct is persisted as 0 here; the referral/cashback
    // engine remains a follow-up requiring a schema change (out of this task's scope).
    const cashbackPct = 0;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const count = await prisma.quotation.count();
    const number = `Q-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    // TO-05: صورة تكلفة الكتالوج لكل بند — **تسجيل فقط**. لا تدخل في أي مبلغ أعلاه
    // (subtotal/discount/tax/total كلها مُشتقّة قبل هذا السطر ولا تُقرأ منه).
    // فشل بند لا يُسقط العرض: يُسجَّل ويُكمَل بـnull (D-39: بالع + سجّل) — العرض
    // مستند تجاري، وضياع رقم إحصائي لا يبرر منع حفظه.
    // TO-21-FIX: الفحص الصارم لـ`pricing` يقع **هنا** لا في مخطط الطلب — بعد أن صار
    // العرض مضمون الحفظ. أي فشل يُسجَّل ويتحوّل إلى null، ولا يُرجع خطأ للمستخدم.
    const { costSnapshots, pricingInputs } = await resolveItemPricing(items);
    const snapshotCount = costSnapshots.filter((c) => c !== null).length;

    const quotation = await prisma.quotation.create({
      data: {
        number,
        customerId,
        createdById: roleCheck.userId,
        // W-02: إعادة التسعير = FINAL بسلسلة previousQuotationId (التاريخ محفوظ)
        ...(previousQuotationId
          ? { quotationType: "FINAL" as const, previousQuotationId }
          : {}),
        subtotal,
        discountPct,
        discountAmount,
        cashbackPct,
        taxPct: vatPct,
        taxAmount,
        total,
        validUntil,
        needsApproval: requiresApproval,
        ...(requiresApproval ? { status: "PENDING_APPROVAL" as const } : {}),
        items: {
          create: items.map((item, i) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: lineTotals[i],
            // TO-05: null = «غير معروفة» لا صفر (انظر التعليق على العمود في schema).
            costSnapshot: costSnapshots[i],
            // TO-33: المدخلات تُحفظ مع البند ليصير فتحه في المحرك لاحقًا ممكنًا.
            // `?? Prisma.DbNull` — البند اليدوي يُكتب NULL في القاعدة لا JSON `null`.
            pricingInput: pricingInputs[i] ?? Prisma.DbNull,
          })),
        },
      },
    });

    // دفعة هـ (W-01): الطلب يشير دائمًا للعرض النافذ (الأحدث) — العروض القديمة تبقى بالسلسلة.
    // الحالة تُشتق لا تُكتب يدويًا (Phase 4): نربط العرض فقط ثم نعيد الاشتقاق المركزي.
    if (quotationRequestId) {
      await prisma.quotationRequest.update({
        where: { id: quotationRequestId },
        data: { quotationId: quotation.id },
      });
      await recomputeQuotationRequestStatus(quotationRequestId, roleCheck.userId);
    }
    // مرحلة العميل تُشتق (طلب مسعّر الآن → PRICED)
    await recomputeCustomerStage(customerId, roleCheck.userId);

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "CREATE",
        entity: "Quotation",
        entityId: quotation.id,
        // TO-05: عدد البنود التي حُفظت لها صورة تكلفة — أثر صريح يميّز «لا تكلفة» عن «تكلفة صفر».
        details: `تم إنشاء عرض سعر "${title}" للعميل ${customer.name} برقم ${number}${quotationRequestId ? ` (من طلب ${quotationRequestId})` : ""} — صورة تكلفة الكتالوج محفوظة لـ${snapshotCount} من ${items.length} بند`,
      },
    });

    if (needsApproval && pricingFactor) {
      await prisma.quotationApproval.create({
        data: {
          quotationId: quotation.id,
          requestedById: roleCheck.userId,
          factor: pricingFactor,
          reason: `فاكتور منخفض (${pricingFactor.toFixed(2)}) يتطلب موافقة المدير`,
        },
      });

      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        adminUsers.map((user) =>
          sendNotification({
            userId: user.id,
            title: "notifications.lowFactorApprovalTitle",
            body: `طلب موافقة على فاكتور منخفض (${pricingFactor.toFixed(2)}) لعرض السعر ${number}`,
            type: "LOW_FACTOR_APPROVAL_REQUESTED",
            entityId: quotation.id,
            entityType: "Quotation",
          })
        )
      );
    }

    // D-19: أي خصم > 0 يفتح DiscountRequest (PENDING) و**يُشعر مدير المبيعات**
    // (بداية السلسلة: يعتمد ويمرّر → الإدارة العليا تقرر). الوسم: فوق حد التفاوض
    // (discountBasePct) = "استثنائي"، تحته = "عادي". (السقف الصلب مفروض أعلاه — سطر 261.)
    if (discountNeedsApproval) {
      const isExceptional = discountPct.gt(discountBasePct);
      const label = isExceptional ? "طلب خصم استثنائي" : "طلب خصم";
      await prisma.discountRequest.create({
        data: {
          quotationId: quotation.id,
          requestedById: roleCheck.userId,
          requestedPct: discountPct,
          reason: isExceptional
            ? `${label} ${discountPct}% (فوق حد التفاوض ${discountBasePct}%)`
            : `${label} ${discountPct}%`,
        },
      });

      await notifyRole("SALES_MANAGER", {
        title: "discount.approvalRequestedTitle",
        body: `${label} ${discountPct}% على عرض السعر ${number}`,
        type: "DISCOUNT_APPROVAL_REQUESTED",
        entityId: quotation.id,
        entityType: "Quotation",
      });
    }

    return { success: true, data: { id: quotation.id } };
  } catch (error) {
    console.error("[createQuotation]", error);
    return { error: "errors.serverError" };
  }
}

const updateQuotationSchema = z.object({
  id: z.string().min(1, "errors.invalidInput"),
  customerId: z.string().min(1, "errors.invalidInput"),
  title: z.string().min(1, "errors.invalidInput"),
  items: z.array(createQuotationItemSchema).min(1, "errors.invalidInput"),
});

export async function updateQuotation(
  input: unknown
): Promise<{ success: true; data: { id: string } } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = updateQuotationSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { id, customerId, title, items } = parsed.data;

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true } },
        // TO-30: مسار العرض مشتقّ من طلبه — لازم لحارس المسار أدناه.
        quotationRequest: { select: { technicalRoute: true } },
      },
    });
    if (!existing) return { error: "errors.notFound" };

    // 🔴 TO-30 — نفس حارس الإنشاء حرفيًا (`checkEngineerRoute`). منع الإنشاء دون
    // منع التعديل = نصف بوابة: المهندس يفتح `/quotations/<id>/edit` لعرض خارج
    // مساره ويعيد كتابة بنوده وأسعاره بالكامل. قبل حارس العقد أم بعده لا يهم —
    // كلاهما يسبق أي كتابة.
    const routeError = await checkEngineerRoute(
      roleCheck.role,
      roleCheck.userId,
      existing.quotationRequest?.technicalRoute,
      "updateQuotation"
    );
    if (routeError) return { error: routeError };

    // Immutability guard (Amr's rule): a signed contract is a source document —
    // its quotation can never be edited. Any change goes through a contract
    // annex / a new quotation (separate feature). Enforced server-side, before
    // any write; hiding the edit UI alone would not be a boundary.
    if (existing.contract) {
      return { error: "errors.quotationHasContract" };
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "errors.notFound" };

    // Pricing-audit fix: Decimal end-to-end (zero float).
    const vatPct = existing.taxPct;
    // Pricing-audit fix (discount drop): re-apply the quotation's EXISTING
    // discount when items change. The old code computed total = subtotal + VAT
    // with no discount — silently inflating the total (+23.46% on a 19% quote)
    // while leaving discountPct/discountAmount stale on the row.
    const discountPct = existing.discountPct;
    const lineTotals = items.map((item) => toDec(item.quantity).mul(toDec(item.unitPrice)));
    const subtotal = lineTotals.reduce((sum, lt) => sum.add(lt), new D(0));

    // 🔴 TO-39 — التعديل **يحافظ على حالة الخصم كما هي، لا يغيّرها**:
    //  · خصم كان مُعتمَدًا (`discountAmount > 0` على الصف) ⇒ يُعاد تطبيقه على
    //    الإجمالي الجديد — وإلا ضاع خصم وافق عليه صاحب صلاحية لمجرد تعديل بند.
    //  · خصم ما زال **طلبًا** (`discountAmount = 0`) ⇒ يبقى طلبًا، والإجماليات
    //    بلا خصم. التعديل ليس اعتمادًا، ولا يجوز أن يصير بابًا خلفيًا له.
    // ⚠️ `discountAmount` هو الإشارة لا `status`: الحالة تُغيَّر يدويًا من مسارات
    // أخرى (`updateQuotationStatus`)، أما المبلغ فلا يكتبه إلا الاعتماد نفسه.
    const discountWasApproved = existing.discountAmount.gt(0);
    const { discountAmount, taxAmount, total } = recomputeQuotationTotals(
      subtotal,
      effectiveDiscountPct(discountPct, discountWasApproved),
      vatPct
    );

    // 🔴 TO-33 — إصلاح BL-151. كان التعديل يعيد بناء البنود من `{وصف · كمية · سعر}`
    // وحدها، فتُمسح `costSnapshot` إلى null عند **كل** حفظ ⇒ العرض المعدَّل يخرج من
    // حساب الهامش. الآن نفس دالة الإنشاء (`resolveItemPricing`) تعمل هنا حرفيًا:
    // بند وصل بمدخلات ⇒ تكلفة مُعاد حسابها من القاعدة + مدخلاته محفوظة؛ بند يدوي
    // ⇒ null صادقة كما كان. **لا تلفيق ولا ترحيل — التكلفة تُحسب أو تبقى مجهولة.**
    // ⚠️ صفر تغيير على أي مبلغ: كل الإجماليات أعلاه مشتقّة قبل هذا السطر ولا تقرأ منه.
    const { costSnapshots, pricingInputs } = await resolveItemPricing(items);

    const quotation = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          customerId,
          // TO-23: آخر مُعدِّل — إضافة فقط، بلا مساس بأي مبلغ (كلها مُشتقّة أعلاه).
          updatedById: roleCheck.userId,
          subtotal,
          discountAmount, // kept in lockstep with total (was left stale before)
          taxAmount,
          total,
          items: {
            create: items.map((item, i) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: lineTotals[i],
              // TO-33: نفس دلالة الإنشاء بالضبط — null = «غير معروفة» لا صفر.
              costSnapshot: costSnapshots[i],
              pricingInput: pricingInputs[i] ?? Prisma.DbNull,
            })),
          },
        },
      });
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE",
        entity: "Quotation",
        entityId: quotation.id,
        details: `تم تحديث عرض السعر "${title}" رقم ${quotation.number}`,
      },
    });

    return { success: true, data: { id: quotation.id } };
  } catch (error) {
    console.error("[updateQuotation]", error);
    return { error: "errors.serverError" };
  }
}

const updateQuotationStatusSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  status: z.nativeEnum(QuotationStatus),
});

export async function updateQuotationStatus(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    // TO-26: ليس PRICING_ROLES — انظر تعليق QUOTATION_STATUS_ROLES أعلاه.
    // TO-31: نشر المصفوفة — نفس نمط `requireRole([...TEC_ROLES])` القائم
    // (`technical-office/actions.ts:21`)، فالقائمة `as const` للقراءة فقط.
    const roleCheck = await requireRole([...QUOTATION_STATUS_ROLES]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = updateQuotationStatusSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { quotationId, status } = parsed.data;

    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return { error: "errors.notFound" };

    await prisma.quotation.update({
      where: { id: quotationId },
      // approvedById يُكتب فقط عند الانتقال إلى APPROVED؛ مغادرة APPROVED لا تمحوه (أثر تاريخي)
      data: {
        status,
        // TO-23: يُكتب في **كل** انتقال حالة، بعكس approvedById المشروط أعلاه.
        updatedById: roleCheck.userId,
        ...(status === "APPROVED" ? { approvedById: roleCheck.userId } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "UPDATE_STATUS",
        entity: "Quotation",
        entityId: quotationId,
        details: `تم تغيير حالة عرض السعر ${quotation.number} من ${quotation.status} إلى ${status}${status === "APPROVED" ? ` — اعتماد بواسطة ${roleCheck.userId}` : ""}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[updateQuotationStatus]", error);
    return { error: "errors.serverError" };
  }
}

const requestFactorApprovalSchema = z.object({
  quotationId: z.string().min(1, "errors.invalidInput"),
  factor: z.coerce.number().positive("errors.invalidInput"),
});

export async function requestFactorApproval(
  input: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const roleCheck = await requireRole(PRICING_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" };

    const parsed = requestFactorApprovalSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" };

    const { quotationId, factor } = parsed.data;

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      // TO-31: المنشئ + مسار الطلب — مدخلا حارسَي الملكية والمسار أدناه.
      include: { quotationRequest: { select: { technicalRoute: true } } },
    });
    if (!quotation) return { error: "errors.notFound" };

    // 🔴 TO-31 — كان الدور وحده يكفي: أي مهندس يضع `needsApproval` على **أي**
    // عرض في الشركة بمعرفة معرّفه. المهندس يطلب اعتماد فاكتور **لعرضه هو
    // داخل مساره** فقط. الأدوار الأخرى (ADMIN/TEC_APPROVER/TEC_LEAD) بلا تغيير.
    if (roleCheck.role === "TECHNICAL_OFFICE") {
      if (quotation.createdById !== roleCheck.userId) {
        console.warn(
          `[pricing] FACTOR_APPROVAL_NOT_OWNER engineer=${roleCheck.userId} quotation=${quotationId}`
        );
        return { error: "errors.notAuthorized" };
      }
      // نفس دالة TO-30 — لا نسخة ثانية من قاعدة المسار.
      const routeError = await checkEngineerRoute(
        roleCheck.role,
        roleCheck.userId,
        quotation.quotationRequest?.technicalRoute,
        "requestFactorApproval"
      );
      if (routeError) return { error: routeError };
    }

    await prisma.quotation.update({
      where: { id: quotationId },
      // TO-23: آخر مُعدِّل — إضافة فقط.
      data: { needsApproval: true, updatedById: roleCheck.userId },
    });

    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "REQUEST_FACTOR_APPROVAL",
        entity: "Quotation",
        entityId: quotationId,
        details: `طلب موافقة على فاكتور منخفض (${factor}) لعرض السعر ${quotation.number}`,
      },
    });

    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    await Promise.all(
      adminUsers.map((user) =>
        sendNotification({
          userId: user.id,
          title: "notifications.lowFactorApprovalTitle",
          body: `طلب موافقة على فاكتور منخفض (${factor}) لعرض السعر ${quotation.number}`,
          type: "LOW_FACTOR_APPROVAL_REQUESTED",
          entityId: quotationId,
          entityType: "Quotation",
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error("[requestFactorApproval]", error);
    return { error: "errors.serverError" };
  }
}
