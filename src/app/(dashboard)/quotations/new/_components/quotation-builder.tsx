"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ProductSection, type ProductTypeOption } from "./product-section";
import type { PricingFactorOption, RecipeResult } from "./product-recipe-form";

type CustomerOption = { id: string; name: string; phone: string };

// TO-05: `pricing` مرافق للبند حتى الحفظ فقط — لا يدخل في أي حساب هنا.
// TO-21: القسم = مفتاح + حمولة الفورم كما هي. أي حقل يُضاف لـ`RecipeResult` مستقبلًا
// يصل إلى هنا تلقائيًا، ولا يمكن إسقاطه صامتًا في الطريق.
// TO-27: `hasProductType` حقل **محلي للواجهة** خارج `RecipeResult` عمدًا — سلسلة
// `pricing` لم تُمس. يميّز «قسم فارغ لم يُختر نوعه» (يُتجاهَل صامتًا عند الحفظ)
// من «قسم اختير نوعه ولم يُحسب سعره» (خطأ مسمّى — رسالة TO-21-FIX كما هي).
// إلزامي لا اختياري: نسيانه عند تحديث القسم = خطأ بناء لا إسقاط صامت.
type Section = { key: number; hasProductType: boolean } & RecipeResult;

/** TO-27: القسم المكتمل = له سعر محسوب. هو وحده يُحفظ ويظهر في الملخص. */
function isCompleted(s: Section): boolean {
  return s.subtotal > 0;
}

type EditItem = { key: number; description: string; quantity: number; unitPrice: number };

export function QuotationBuilder({
  customers,
  productTypes,
  pricingFactors,
  mode = "create",
  quotationId,
  initialCustomerId,
  quotationRequestId,
  initialTitle,
  initialItems,
  discountBasePct = 18,
}: {
  customers: CustomerOption[];
  productTypes: ProductTypeOption[];
  pricingFactors: PricingFactorOption[];
  mode?: "create" | "edit";
  quotationId?: string;
  initialCustomerId?: string;
  quotationRequestId?: string;
  initialTitle?: string;
  initialItems?: { description: string; quantity: number; unitPrice: number }[];
  discountBasePct?: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = mode === "edit";

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [globalFactorId, setGlobalFactorId] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  // TO-27: قسم **واحد** جاهز عند الفتح. كانت الشاشة تفتح بصفر أقسام فيبدأ
  // المستخدم أمام فراغ لا يدلّه على البداية، ثم كل ضغطة «أضف منتج» تُنشئ قسمًا
  // فارغًا يظهر فورًا صفًا بصفر في الملخص ويُفشِل الحفظ.
  const [sections, setSections] = useState<Section[]>([
    { key: 0, hasProductType: false, subtotal: 0, approvalInfo: undefined, pricing: undefined },
  ]);
  const [nextKey, setNextKey] = useState(1);
  // TO-27: الطيّ حالة عرض محلية بحتة — مفتاح القسم ⇒ مطويّ. **يدوي لا تلقائي:**
  // الطيّ التلقائي عند اكتمال السعر كان سيُخفي مُنتقيات الخامات في اللحظة التي
  // يحتاجها المستخدم (السعر يكتمل بعد «احسب» وقبل اختيار الخامات).
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [editItems, setEditItems] = useState<EditItem[]>(
    (initialItems ?? []).map((item, i) => ({ key: i, ...item }))
  );
  const [nextEditKey, setNextEditKey] = useState((initialItems ?? []).length);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grandTotal = isEdit
    ? editItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    : sections.reduce((sum, s) => sum + s.subtotal, 0);

  function addSection() {
    setSections((prev) => [
      ...prev,
      { key: nextKey, hasProductType: false, subtotal: 0, approvalInfo: undefined, pricing: undefined },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeSection(key: number) {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }

  // TO-21: الحمولة تُنسخ كاملة (`...result`) بلا تفكيك — لا مكان يسقط منه حقل.
  // TO-27: `hasProductType` يُنقل صراحةً لأنه **ليس** من `RecipeResult` — ولو نُسي
  // لكسر البناء (الحقل إلزامي في `Section`)، فحارس TO-21 ما زال يعضّ.
  function updateSubtotal(key: number, result: RecipeResult) {
    setSections((prev) =>
      prev.map((s) =>
        s.key === key ? { key: s.key, hasProductType: s.hasProductType, ...result } : s
      )
    );
  }

  // TO-27: إشارة اختيار النوع — مستقلة عن حمولة التسعير.
  function updateHasProductType(key: number, hasProductType: boolean) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, hasProductType } : s)));
  }

  function addEditItem() {
    setEditItems((prev) => [...prev, { key: nextEditKey, description: "", quantity: 1, unitPrice: 0 }]);
    setNextEditKey((k) => k + 1);
  }

  function removeEditItem(key: number) {
    setEditItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateEditItem(key: number, patch: Partial<EditItem>) {
    setEditItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function handleSave() {
    setError(null);

    if (isEdit) {
      // SF-13: توحيد حارس الإجمالي مع مسار create (sections.some(s=>s.subtotal<=0)).
      // كان `unitPrice < 0` يسمح ببند بسعر صفر (منها البند اليدوي المُضاف حديثًا الذي
      // يبدأ unitPrice:0) فيُحفظ عرض بإجمالي مُلوَّث — الآن `<= 0` يمنعه بنفس رسالة create.
      if (
        !customerId ||
        !title ||
        editItems.length === 0 ||
        editItems.some((i) => !i.description || i.quantity <= 0 || i.unitPrice <= 0)
      ) {
        setError(t("errors.invalidInput"));
        return;
      }

      setSubmitting(true);
      const { updateQuotation } = await import("../../../../../../lib/pricing/actions");
      const response = await updateQuotation({
        id: quotationId,
        customerId,
        title,
        items: editItems.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      setSubmitting(false);

      if ("error" in response) {
        setError(t(response.error));
        return;
      }

      toast.success(t("quotations.new.saved"));
      router.push(`/quotations/${response.data.id}`);
      return;
    }

    // TO-21-FIX: كان حارسًا واحدًا يعطي "بيانات غير صالحة" لأربعة أسباب مختلفة —
    // ونفس النص يخرج من السيرفر أيضًا، فيستحيل ميدانيًا معرفة أيهما فشل ولا لماذا.
    // كل سبب الآن يسمّي حقله.
    if (!customerId) {
      setError(t("errors.invalidInputIn", { field: t("quotations.customer") }));
      return;
    }
    if (!title) {
      setError(t("errors.invalidInputIn", { field: t("quotations.new.quotationTitle") }));
      return;
    }
    // 🔴 TO-27 — القسم الفارغ لم يعد يُفشِل الحفظ. كان `findIndex(s => s.subtotal <= 0)`
    // يرفض الطلب كله لأي قسم بلا سعر، بما فيه قسم أُضيف ولم يُلمس ⇒ المستخدم يختار
    // منتجًا واحدًا ويُرفض حفظه. التمييز الآن:
    //  · لم يُختر نوعه  ⇒ **تجاهل صامت** (نيّة واضحة: قسم لم يُستعمل).
    //  · اختير نوعه ولم يُحسب سعره ⇒ **خطأ مسمّى** — عمل ناقص لا يصح ابتلاعه.
    //    الرسالة نفسها من TO-21-FIX بلا تغيير، والرقم رقم القسم كما يراه المستخدم.
    const incompleteIndex = sections.findIndex((s) => s.hasProductType && !isCompleted(s));
    if (incompleteIndex !== -1) {
      setError(t("quotations.new.errorSectionNoPrice", { index: incompleteIndex + 1 }));
      return;
    }

    const completedSections = sections.filter(isCompleted);
    if (completedSections.length === 0) {
      setError(t("quotations.new.errorNoSections"));
      return;
    }

    const anyNeedsApproval = completedSections.some((s) => s.approvalInfo?.requiresApproval);
    const lowestFactor = anyNeedsApproval
      ? Math.min(
          ...completedSections.filter((s) => s.approvalInfo).map((s) => s.approvalInfo!.factor)
        )
      : undefined;

    const discountValue = Number(discountPct);
    if (Number.isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      setError(t("errors.invalidInputIn", { field: t("quotations.new.discountPct") }));
      return;
    }

    if (discountValue > discountBasePct && !discountReason.trim()) {
      setError(t("discount.reasonRequired"));
      return;
    }

    setSubmitting(true);
    const { createQuotation } = await import("../../../../../../lib/pricing/actions");
    const response = await createQuotation({
      customerId,
      title,
      // TO-27: المكتملة وحدها تُرسَل — الأقسام الفارغة تُسقَط قبل البناء لا بعده،
      // فلا يصل الأكشن بند بسعر صفر. ترقيم البنود يتبع المكتملة (1، 2، …).
      items: completedSections.map((s, i) => ({
        description: `${title} - ${i + 1}`,
        quantity: 1,
        unitPrice: s.subtotal,
        // TO-05: مدخلات إعادة حساب التكلفة — السيرفر يعيد الحساب بنفسه ولا يثق برقم من هنا.
        // ⚠️ TO-27 لم يمسّ هذا السطر ولا مصدره — سلسلة `pricing` كما هي.
        ...(s.pricing ? { pricing: s.pricing } : {}),
      })),
      needsApproval: anyNeedsApproval,
      pricingFactor: lowestFactor,
      discountPct: discountValue,
      // دفعة هـ (W-01): ربط العرض بطلب التسعير الذي أنشأه المندوب (يرث المسار)
      ...(quotationRequestId ? { quotationRequestId } : {}),
    });
    setSubmitting(false);

    if ("error" in response) {
      // TO-21-FIX: السيرفر صار يُرجع اسم الحقل الفاشل (مفتاح ترجمة) ورقم البند إن وُجدا.
      // نعرضهما للمستخدم بلغته؛ ما زال النص العام هو البديل إن لم يُحدَّد حقل.
      const fieldLabel = response.fieldKey ? t(response.fieldKey) : null;
      if (fieldLabel && response.itemIndex !== undefined) {
        setError(
          t("errors.invalidInputInItem", { item: response.itemIndex + 1, field: fieldLabel })
        );
      } else if (fieldLabel) {
        setError(t("errors.invalidInputIn", { field: fieldLabel }));
      } else {
        setError(t(response.error));
      }
      return;
    }

    toast.success(t("quotations.new.saved"));
    router.push(`/quotations/${response.data.id}`);
  }

  return (
    <div className="space-y-6 p-6 pb-32">
      <h1 className="text-xl font-semibold">
        {isEdit ? t("quotations.detail.edit") : t("quotations.newQuotation")}
      </h1>

      <div className="grid gap-4 max-w-2xl sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="customerId">{t("quotations.customer")}</Label>
          <Select value={customerId} onValueChange={(value) => setCustomerId(value ?? "")}>
            <SelectTrigger id="customerId" className="w-full">
              <SelectValue>
                {customers.find((c) => c.id === customerId)?.name ??
                  t("quotations.new.selectCustomer")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — <span dir="ltr">{c.phone}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="title">{t("quotations.new.quotationTitle")}</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {!isEdit && (
          <div className="space-y-1">
            <Label htmlFor="globalFactorId">{t("quotations.shower.globalFactor")}</Label>
            <Select value={globalFactorId} onValueChange={(value) => setGlobalFactorId(value ?? "")}>
              <SelectTrigger id="globalFactorId" className="w-full">
                <SelectValue>
                  {pricingFactors.find((f) => f.id === globalFactorId)?.label ??
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
          </div>
        )}

        {!isEdit && (
          <div className="space-y-1">
            <Label htmlFor="discountPct">{t("quotations.new.discountPct")}</Label>
            <Input
              id="discountPct"
              type="number"
              dir="ltr"
              min={0}
              max={100}
              step="0.01"
              value={discountPct}
              onChange={(e) => { setDiscountPct(e.target.value); setDiscountReason(""); }}
            />
          </div>
        )}

        {!isEdit && Number(discountPct) > discountBasePct && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="discountReason">
              {t("discount.reasonLabel")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="discountReason"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder={t("discount.reasonPlaceholder")}
            />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("discount.aboveBaseHint", { base: discountBasePct })}
            </p>
          </div>
        )}
      </div>

      {isEdit ? (
        <div className="space-y-4 max-w-2xl">
          {editItems.map((item) => (
            <div key={item.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>{t("quotations.detail.product")}</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateEditItem(item.key, { description: e.target.value })}
                />
              </div>
              <div className="space-y-1 w-20">
                <Label>{t("quotations.new.addProduct")}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={item.quantity}
                  onChange={(e) => updateEditItem(item.key, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1 w-28">
                <Label>{t("quotations.detail.itemSubtotal")}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateEditItem(item.key, { unitPrice: Number(e.target.value) })}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => removeEditItem(item.key)}
              >
                {t("quotations.new.removeProduct")}
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addEditItem}>
            {t("quotations.new.addProduct")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((s, i) => {
            // TO-27: الطيّ متاح للمكتمل فقط — طيّ قسم بلا سعر يُخفي عملًا ناقصًا.
            const isFolded = Boolean(collapsed[s.key]) && isCompleted(s);
            return (
              <div key={s.key} className="space-y-2">
                {isFolded && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <span className="min-w-0 truncate">
                      {productTypes.find((p) => p.code === s.pricing?.productTypeCode)?.nameAr ??
                        t("quotations.detail.product")}
                      {s.pricing && (
                        <>
                          {" · "}
                          <span dir="ltr">
                            {s.pricing.width} × {s.pricing.height}
                          </span>
                        </>
                      )}
                      {" · "}
                      <span dir="ltr">{s.subtotal.toFixed(2)}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCollapsed((p) => ({ ...p, [s.key]: false }))}
                    >
                      {t("quotations.new.expandProduct")}
                    </Button>
                  </div>
                )}

                {/* 🔴 TO-27: الطيّ إخفاء بصري لا إزالة من الشجرة. لو أُزيل المكوّن
                    لفقد كل حالته الداخلية (النوع · المقاسات · نتيجة الحساب ·
                    اختيارات الخامات) وعاد فارغًا عند الفتح، بينما الباني ما زال
                    يحمل سعره ⇒ انحراف صامت وفقدان مدخلات. */}
                <div className={isFolded ? "hidden" : undefined}>
                  {/* TO-27-FIX: كان زرًا `ghost` صغيرًا خارج البطاقة وبمحاذاة اليسار
                      في RTL ⇒ يُصيَّر فعلًا ولا يُرى (بلغة الحقل: «الزر لا يظهر»).
                      صار شريط رأس مُحدَّد بحدّ فوق البطاقة مباشرة، يحمل الملخص وزرًا
                      بحدّ ظاهر — بنفس بروز «إزالة». **شرط الظهور لم يتغيّر إطلاقًا.** */}
                  {isCompleted(s) && !isFolded && (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {productTypes.find((p) => p.code === s.pricing?.productTypeCode)?.nameAr ??
                          t("quotations.detail.product")}
                        {" · "}
                        <span dir="ltr">{s.subtotal.toFixed(2)}</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCollapsed((p) => ({ ...p, [s.key]: true }))}
                      >
                        {t("quotations.new.collapseProduct")}
                      </Button>
                    </div>
                  )}
                  <ProductSection
                    index={i}
                    productTypes={productTypes}
                    pricingFactors={pricingFactors}
                    defaultPricingFactorId={globalFactorId || undefined}
                    onRemove={() => removeSection(s.key)}
                    onSubtotalChange={(result) => updateSubtotal(s.key, result)}
                    onProductTypeChange={(has) => updateHasProductType(s.key, has)}
                  />
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={addSection}>
            {t("quotations.new.addProduct")}
          </Button>
        </div>
      )}

      <FieldError message={error ?? undefined} />

      <div className="fixed bottom-0 inset-x-0 border-t bg-background p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            {/* TO-27: المكتملة وحدها. كان الملخص يعرض صفًا بصفر لكل قسم مضاف ولو
                لم يُلمس، فيبدو العرض وكأن فيه بنودًا بلا قيمة. الترقيم يتبع
                المكتملة كي يطابق ترقيم البنود المُرسَلة فعلًا. */}
            {!isEdit &&
              sections.filter(isCompleted).map((s, i) => (
                <div key={s.key} className="flex justify-between gap-6">
                  <span>
                    {title || t("quotations.new.quotationTitle")} {i + 1}
                  </span>
                  <span dir="ltr">{s.subtotal.toFixed(2)}</span>
                </div>
              ))}
            {!isEdit && Number(discountPct) > 0 && (
              <>
                <div className="flex justify-between gap-6">
                  <span>{t("quotations.subtotal")}</span>
                  <span dir="ltr">{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>
                    {t("quotations.new.discountPct")} ({Number(discountPct) || 0}%)
                  </span>
                  <span dir="ltr">
                    -{((grandTotal * (Number(discountPct) || 0)) / 100).toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between gap-6 font-semibold">
              <span>{isEdit ? t("quotations.total") : t("quotations.new.netBeforeVat")}</span>
              <span dir="ltr">
                {(grandTotal - (grandTotal * (isEdit ? 0 : Number(discountPct) || 0)) / 100).toFixed(2)}
              </span>
            </div>
          </div>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? t("app.loading") : t("quotations.new.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
