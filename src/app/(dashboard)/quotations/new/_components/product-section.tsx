"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ProductRecipeForm,
  type ConfigTypeOption,
  type PricingFactorOption,
  type RecipeResult,
} from "./product-recipe-form";

export type ProductTypeOption = { id: string; code: string; nameAr: string };

export function ProductSection({
  index,
  productTypes,
  pricingFactors,
  defaultPricingFactorId,
  onRemove,
  onSubtotalChange,
  onProductTypeChange,
}: {
  index: number;
  productTypes: ProductTypeOption[];
  pricingFactors: PricingFactorOption[];
  defaultPricingFactorId?: string;
  onRemove: () => void;
  // TO-05: `pricing` يمر كما هو حتى `createQuotation` — تسجيل تكلفة فقط، بلا أثر على السعر.
  // TO-21: نفس حمولة `RecipeResult` تُمرَّر كما هي — لا إعادة بناء ولا وسائط موضعية.
  onSubtotalChange: (result: RecipeResult) => void;
  // TO-27: إشارة **منفصلة تمامًا** عن حمولة `RecipeResult` — عمدًا لا حقلًا فيها،
  // كي تبقى سلسلة `pricing` (TO-21) كما هي حرفًا بحرف. الباني يحتاجها ليميّز
  // «قسم فارغ لم يُختر نوعه» (يُتجاهَل صامتًا) من «قسم اختير نوعه ولم يُحسب سعره»
  // (خطأ مسمّى يبقى كما هو).
  onProductTypeChange?: (hasProductType: boolean) => void;
}) {
  const t = useTranslations();
  const [productTypeId, setProductTypeId] = useState<string>("");
  const [configTypes, setConfigTypes] = useState<ConfigTypeOption[]>([]);
  const [loadingConfigTypes, setLoadingConfigTypes] = useState(false);

  const selectedProductType = productTypes.find((p) => p.id === productTypeId);

  useEffect(() => {
    if (!productTypeId) {
      setConfigTypes([]);
      return;
    }
    let cancelled = false;
    setLoadingConfigTypes(true);
    import("../../../../../../lib/pricing/actions").then(async ({ getConfigTypeOptions }) => {
      const result = await getConfigTypeOptions(productTypeId);
      if (!cancelled) {
        setConfigTypes(result);
        setLoadingConfigTypes(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productTypeId]);

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`product-type-${index}`}>{t("quotations.new.productType")}</Label>
          <Select
            value={productTypeId}
            onValueChange={(value) => {
              setProductTypeId(value ?? "");
              // تبديل نوع المنتج يُصفّر القسم بالكامل: لا سعر ولا اعتماد ولا مدخلات تكلفة.
              onSubtotalChange({ subtotal: 0, approvalInfo: undefined, pricing: undefined });
              // TO-27: إشارة مستقلة — لا تمسّ الحمولة أعلاه ولا ترتيبها.
              onProductTypeChange?.(Boolean(value));
            }}
          >
            <SelectTrigger id={`product-type-${index}`} className="w-full max-w-sm">
              <SelectValue>
                {selectedProductType?.nameAr ?? t("quotations.new.selectProductType")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="destructive" onClick={onRemove}>
          {t("quotations.new.removeProduct")}
        </Button>
      </div>

      {productTypeId && selectedProductType && !loadingConfigTypes && (
        <ProductRecipeForm
          productTypeCode={selectedProductType.code}
          title={selectedProductType.nameAr}
          configTypes={configTypes}
          pricingFactors={pricingFactors}
          defaultPricingFactorId={defaultPricingFactorId}
          onResult={onSubtotalChange}
        />
      )}
    </div>
  );
}
