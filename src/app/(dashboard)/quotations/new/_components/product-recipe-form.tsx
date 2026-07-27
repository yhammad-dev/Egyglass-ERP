"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  groupRecipeLines,
  selectRecipeLines,
  type ItemPricingInput,
} from "../../../../../../lib/pricing/recipe-selection";

export type { ItemPricingInput };
export type ConfigTypeOption = { id: string; nameAr: string };
export type PricingFactorOption = { id: string; label: string; value: number };
export type ApprovalInfo = { requiresApproval: true; factor: number };

// TO-21 — حمولة واحدة تمر كما هي من الفورم إلى الأكشن، بدل ثلاث وسائط موضعية.
// السبب: دالة بوسائط أقل **قابلة للإسناد** لدالة بوسائط أكثر، فإسقاط وسيط عند
// التمرير لا يراه TypeScript إطلاقًا — وهو بالضبط ما أسقط `pricing` صامتًا وأنتج
// costSnapshot = null مع بناء أخضر. الحقول هنا **إلزامية** (وقيمتها قد تكون
// undefined) لا اختيارية: نسيان حقل عند بناء الحمولة = خطأ نوع وقت البناء.
export type RecipeResult = {
  subtotal: number;
  approvalInfo: ApprovalInfo | undefined;
  pricing: ItemPricingInput | undefined;
};

type RecipeLine = {
  materialId: string;
  notes: string | null;
  nameAr: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  factorMode: string;
  // TO-40: مصدر الكمية — عرض فقط.
  qtyRule?: string;
  qtyMultiplier?: number;
};

type CalculationResult = {
  lines: RecipeLine[];
  subtotalBeforeFixed: number;
  fixedTotal: number;
  grandTotal: number;
};

const KNOWN_CATEGORY_LABEL_KEY: Record<string, string> = {
  GLASS: "quotations.shower.selectGlass",
  SECTION: "quotations.shower.selectSection",
  TENSION: "quotations.shower.selectTension",
  HANDLE: "quotations.shower.selectHandle",
  ELBOW: "quotations.shower.selectElbow",
};

/**
 * TO-40 — العرض التقريبي للوح الواجهة بالمتر، أساس **القيمة المقترحة** لعدد
 * الألواح. مكان واحد موثّق: القيمة اقتراح لا قاعدة عمل — التقسيم الفعلي قرار
 * تصميم يعدّله المهندس، ولذلك لا تعيش في `SystemSettings` ولا في القاعدة.
 */
const PANEL_WIDTH_M = 1.6;

/** TO-40: أقل عدد ألواح مقبول — واجهة بلا لوح واحد لا معنى لها. */
const MIN_PANEL_COUNT = 1;

function buildFormSchema(hasConfigTypes: boolean, usesPanelCount: boolean) {
  return z.object({
    height: z.coerce.number().positive("errors.invalidInput"),
    width: z.coerce.number().positive("errors.invalidInput"),
    configTypeId: hasConfigTypes
      ? z.string().min(1, "errors.invalidInput")
      : z.string().optional(),
    pricingFactorId: z.string().min(1, "errors.invalidInput"),
    // TO-40: إلزامي وموجب **فقط** للمنتجات التي تستعمل قواعد الألواح؛ غيرها لا يرسله.
    panelCount: usesPanelCount
      ? z.coerce.number().int().min(MIN_PANEL_COUNT, "errors.invalidInput")
      : z.coerce.number().int().optional(),
  });
}
type FormData = z.infer<ReturnType<typeof buildFormSchema>>;

export function ProductRecipeForm({
  productTypeCode,
  title,
  configTypes,
  pricingFactors,
  defaultPricingFactorId,
  onResult,
  initialPricing,
  usesPanelCount = false,
}: {
  productTypeCode: string;
  title: string;
  configTypes: ConfigTypeOption[];
  pricingFactors: PricingFactorOption[];
  defaultPricingFactorId?: string;
  // TO-05: `pricing` = مدخلات إعادة حساب تكلفة الكتالوج على السيرفر وقت الحفظ.
  // TO-21: حمولة واحدة (`RecipeResult`) لا وسائط موضعية — انظر تعليق النوع أعلاه.
  onResult?: (result: RecipeResult) => void;
  // TO-33: مدخلات بند قائم (`QuotationItem.pricingInput`) — تُملأ في الفورم ويُعاد
  // الحساب مرة واحدة عند التركيب، فيُفتح البند في المحرك بكل قيمه بدل حقول نصية.
  // ⚠️ إضافة بحتة: مسار البثّ (`onResult`) لم يُمس، والحساب يمرّ بنفس الدالة.
  initialPricing?: ItemPricingInput;
  // TO-40: مُشتق من وصفة المنتج server-side — يحكم ظهور حقل عدد الألواح وإلزاميته.
  usesPanelCount?: boolean;
}) {
  const t = useTranslations();
  const [result, setResult] = useState<CalculationResult | null>(null);
  // TO-05: مدخلات آخر حساب ناجح — السيرفر لا يعرفها وقت الحفظ إلا إذا أُرسلت معه.
  const [lastInput, setLastInput] = useState<FormData | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<ApprovalInfo | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const formSchema = useMemo(
    () => buildFormSchema(configTypes.length > 0, usesPanelCount),
    [configTypes.length, usesPanelCount]
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    // TO-33: قيم البند القائم تُملأ ابتداءً — المستخدم يرى مقاساته ومعامله لا فورمًا فارغًا.
    defaultValues: {
      pricingFactorId: initialPricing?.pricingFactorId ?? defaultPricingFactorId ?? "",
      ...(initialPricing
        ? {
            height: initialPricing.height,
            width: initialPricing.width,
            ...(initialPricing.configTypeId ? { configTypeId: initialPricing.configTypeId } : {}),
            // TO-40: عدد الألواح المحفوظ يُسترجع كما هو — لا يُعاد اقتراحه من العرض،
            // وإلا دهس الاقتراحُ تقسيمًا اختاره المهندس بنفسه.
            ...(initialPricing.panelCount ? { panelCount: initialPricing.panelCount } : {}),
          }
        : {}),
    },
  });

  /**
   * TO-33 — مسار الحساب **الوحيد**. `restoreSelections` هو الفارق الوحيد عن
   * السلوك القديم: الضغط على «احسب» يُصفّر الاختيارات (دورة جديدة)، بينما ترطيب
   * بند قائم يستعيد اختياراته المحفوظة. نسخة ثانية من هذا المسار كانت ستفتح باب
   * انحراف بين «حساب جديد» و«إعادة فتح» — وهو صنف العيب الذي عالجناه في TO-21.
   */
  async function runCalculation(data: FormData, restoreSelections?: Record<string, string>) {
    setSubmitting(true);
    setServerError(null);
    setResult(null);
    setLastInput(null);
    setApprovalInfo(null);
    setSelections({});

    const { calculateProductPricing } = await import(
      "../../../../../../lib/pricing/actions"
    );
    const response = await calculateProductPricing(productTypeCode, data);

    setSubmitting(false);

    if ("error" in response) {
      setServerError(t(response.error));
      return;
    }

    setResult(response.data);
    setLastInput(data);
    if (restoreSelections) setSelections(restoreSelections);

    if (response.requiresApproval && response.factor !== undefined) {
      setApprovalInfo({ requiresApproval: true, factor: response.factor });
    } else {
      setApprovalInfo(null);
    }
  }

  async function onSubmit(data: FormData) {
    await runCalculation(data);
  }

  // TO-33: ترطيب لمرة واحدة عند التركيب. الحارس `hydratedRef` لا الاعتماديات —
  // لأن `initialPricing` يبقى ثابتًا بينما `selections` تتغيّر بفعل المستخدم،
  // وإعادة الترطيب كانت ستدهس اختياراته الجديدة بالقديمة.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!initialPricing || hydratedRef.current) return;
    hydratedRef.current = true;
    void runCalculation(
      {
        height: initialPricing.height,
        width: initialPricing.width,
        configTypeId: initialPricing.configTypeId,
        pricingFactorId: initialPricing.pricingFactorId,
        panelCount: initialPricing.panelCount,
      } as FormData,
      initialPricing.selections
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPricing]);

  // TO-05: التجميع والاختيار انتقلا إلى `lib/pricing/recipe-selection` ليستخدم السيرفر
  // **نفس** القاعدة عند حساب تكلفة الكتالوج — نسخة ثانية منها = انحراف صامت بين السعر
  // والتكلفة. السلوك هنا مطابق حرفيًا لما كان مكتوبًا inline (تلقائي ثم مختار، بنفس الترتيب).
  const groupedLines = useMemo<Record<string, RecipeLine[]>>(
    () => (result ? groupRecipeLines(result.lines) : {}),
    [result]
  );

  // Groups with more than one option require the user to choose one.
  // Groups with exactly one option (e.g. silicone) are always included.
  const selectableCategories = useMemo(
    () => Object.keys(groupedLines).filter((category) => groupedLines[category].length > 1),
    [groupedLines]
  );

  const selectedLines = useMemo(
    () => selectRecipeLines(groupedLines, selections),
    [groupedLines, selections]
  );

  const subtotalBeforeFixed = selectedLines
    .filter((l) => l.factorMode === "STANDARD" || l.factorMode === "CUSTOM_FACTOR")
    .reduce((sum, l) => sum + l.lineTotal, 0);
  const fixedTotal = selectedLines
    .filter((l) => l.factorMode === "FIXED_AFTER")
    .reduce((sum, l) => sum + l.lineTotal, 0);
  const grandTotal = subtotalBeforeFixed + fixedTotal;

  // TO-05: يُبنى من مدخلات آخر حساب + الاختيارات الحالية. `selections` جزء من الاعتماديات
  // عمدًا: تبديل خامة بخامة بنفس السعر لا يغيّر grandTotal، فلولا هذا لبقيت الصورة قديمة.
  const pricing = useMemo<ItemPricingInput | undefined>(() => {
    if (!result || !lastInput) return undefined;
    return {
      productTypeCode,
      height: lastInput.height,
      width: lastInput.width,
      ...(lastInput.configTypeId ? { configTypeId: lastInput.configTypeId } : {}),
      pricingFactorId: lastInput.pricingFactorId,
      // TO-40: يُرسَل فقط للمنتجات التي تستعمل قواعد الألواح — بنفس نمط
      // `configTypeId` أعلاه (نشر شرطي)، فلا يظهر مفتاح فارغ في حمولة غيرها.
      ...(usesPanelCount && lastInput.panelCount
        ? { panelCount: lastInput.panelCount }
        : {}),
      // TO-21-FIX: الاختيار المُلغى يُخزَّن `""` (السطر الذي يقرأ `value ?? ""`).
      // إرساله كما هو يعني «اخترتُ لا شيء» فيُحسب اختيارًا لا يطابق أي خامة ⇒ تحذيرة
      // SELECTION_NOT_MATCHED كاذبة. حذف المفتاح **لا يغيّر أي سلوك** (قاعدة الاختيار
      // تتخطّى الفارغ والمفقود سواءً — recipe-selection.ts:60) لكنه يجعل الحمولة صادقة.
      selections: Object.fromEntries(
        Object.entries(selections).filter(([, materialId]) => materialId !== "")
      ),
    };
  }, [result, lastInput, productTypeCode, selections]);

  useEffect(() => {
    onResult?.({
      subtotal: result ? grandTotal : 0,
      approvalInfo: approvalInfo ?? undefined,
      pricing,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, grandTotal, approvalInfo, pricing]);

  /**
   * TO-40 — شرح موجز لمصدر كمية أسطر الألواح. يقرأ `panelCount` من **آخر حساب
   * ناجح** (`lastInput`) لا من الفورم الحيّ: الجدول يعرض نتيجة ذلك الحساب،
   * فقراءة قيمة غُيّرت بعده كانت ستشرح رقمًا غير معروض.
   */
  function panelQtySource(line: RecipeLine): string | null {
    const panels = lastInput?.panelCount ?? 0;
    if (!panels) return null;
    if (line.qtyRule === "BY_PANEL") {
      return t("quotations.shower.qtyFromPanels", {
        panels,
        multiplier: line.qtyMultiplier ?? 0,
      });
    }
    if (line.qtyRule === "BY_PANEL_JOINT") {
      return t("quotations.shower.qtyFromJoints", {
        joints: panels + 1,
        multiplier: line.qtyMultiplier ?? 0,
      });
    }
    return null;
  }

  function categoryLabel(category: string) {
    const knownKey = KNOWN_CATEGORY_LABEL_KEY[category];
    if (knownKey) return t(knownKey);
    return t("quotations.shower.selectGroup", { category });
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="height">{t("quotations.shower.height")}</Label>
          <Input
            id="height"
            type="number"
            step="0.01"
            dir="ltr"
            {...register("height")}
          />
          <FieldError message={errors.height?.message && t(errors.height.message)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="width">{t("quotations.shower.width")}</Label>
          <Input
            id="width"
            type="number"
            step="0.01"
            dir="ltr"
            {...register("width")}
            // TO-40: العرض يقترح عدد الألواح — والمستخدم يبقى صاحب القرار.
            // `onChange` مُمرَّر بعد النشر عمدًا كي **يُستدعى تسجيل RHF أولًا**
            // فلا تُفقد قيمة العرض نفسها.
            onChange={(e) => {
              register("width").onChange(e);
              if (!usesPanelCount) return;
              const w = Number(e.target.value);
              if (!Number.isFinite(w) || w <= 0) return;
              setValue("panelCount", Math.max(MIN_PANEL_COUNT, Math.ceil(w / PANEL_WIDTH_M)), {
                shouldValidate: false,
              });
            }}
          />
          <FieldError message={errors.width?.message && t(errors.width.message)} />
        </div>

        {/* 🔴 TO-40 — عدد الألواح: مدخل بشري لا مُشتق. القيمة المقترحة تُملأ من
            العرض عند تغييره، لكنها **قابلة للتعديل** لأن التقسيم الفعلي قرار
            تصميم. يظهر الحقل فقط لمنتج وصفته تستعمل قواعد الألواح. */}
        {usesPanelCount && (
          <div className="space-y-1">
            <Label htmlFor="panelCount">{t("quotations.shower.panelCount")}</Label>
            <Input
              id="panelCount"
              type="number"
              step="1"
              min={MIN_PANEL_COUNT}
              dir="ltr"
              {...register("panelCount")}
            />
            <p className="text-xs text-muted-foreground">
              {t("quotations.shower.panelCountHint", { panelWidth: PANEL_WIDTH_M })}
            </p>
            <FieldError
              message={errors.panelCount?.message && t(errors.panelCount.message)}
            />
          </div>
        )}

        {configTypes.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="configTypeId">{t("quotations.shower.showerType")}</Label>
            <Controller
              control={control}
              name="configTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="configTypeId" className="w-full">
                    <SelectValue>
                      {configTypes.find((c) => c.id === field.value)?.nameAr ??
                        t("quotations.shower.selectShowerType")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {configTypes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              message={errors.configTypeId?.message && t(errors.configTypeId.message)}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="pricingFactorId">{t("quotations.shower.globalFactor")}</Label>
          <Controller
            control={control}
            name="pricingFactorId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="pricingFactorId" className="w-full">
                  <SelectValue>
                    {pricingFactors.find((f) => f.id === field.value)?.label ??
                      t("quotations.shower.selectGlobalFactor")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {pricingFactors.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            message={errors.pricingFactorId?.message && t(errors.pricingFactorId.message)}
          />
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        {approvalInfo && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ {t("quotations.shower.lowFactorRequiresApproval")} ({approvalInfo.factor.toFixed(2)}) — {t("quotations.shower.willSaveAsPendingApproval")}
          </div>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? t("app.loading") : t("quotations.shower.calculate")}
        </Button>
      </form>

      {result && (
        <div className="space-y-4 max-w-md">
          {selectableCategories.map((category) => {
            const options = groupedLines[category] ?? [];

            return (
              <div className="space-y-1" key={category}>
                <Label htmlFor={`select-${category}`}>
                  {categoryLabel(category)}
                </Label>
                <Select
                  value={selections[category] ?? ""}
                  onValueChange={(value) =>
                    setSelections((prev) => ({ ...prev, [category]: value ?? "" }))
                  }
                >
                  <SelectTrigger id={`select-${category}`} className="w-full">
                    <SelectValue>
                      {options.find((o) => o.materialId === selections[category])
                        ?.nameAr ?? categoryLabel(category)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.materialId} value={o.materialId}>
                        {o.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}

      {result && selectedLines.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("quotations.shower.material")}</TableHead>
                <TableHead className="text-start">
                  <span dir="ltr">{t("quotations.shower.qty")}</span>
                </TableHead>
                <TableHead className="text-start">
                  <span dir="ltr">{t("quotations.shower.unitCost")}</span>
                </TableHead>
                <TableHead className="text-start">
                  <span dir="ltr">{t("quotations.shower.lineTotal")}</span>
                </TableHead>
                <TableHead>{t("quotations.shower.factorMode")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLines.map((line) => (
                <TableRow key={line.materialId}>
                  <TableCell>{line.nameAr}</TableCell>
                  <TableCell className="text-start">
                    <span dir="ltr">{line.qty.toFixed(2)}</span>
                    {/* TO-40: مصدر الكمية لأسطر الألواح — «6 ألواح × 4» أو
                        «7 خطوط × 2». يُعرض لهاتين القاعدتين فقط: بقية القواعد
                        مفهومة من المقاس ولا تحتاج شرحًا يزحم الجدول. */}
                    {panelQtySource(line) && (
                      <span className="block text-xs text-muted-foreground">
                        {panelQtySource(line)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-start">
                    <span dir="ltr">{line.unitCost.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-start">
                    <span dir="ltr">{line.lineTotal.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>{line.factorMode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t("quotations.shower.subtotalBeforeFixed")}</span>
              <span dir="ltr">{subtotalBeforeFixed.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("quotations.shower.fixedTotal")}</span>
              <span dir="ltr">{fixedTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t("quotations.shower.grandTotal")}</span>
              <span dir="ltr">{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
