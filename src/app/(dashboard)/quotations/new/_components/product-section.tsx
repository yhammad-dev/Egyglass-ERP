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
  type ApprovalInfo,
} from "./product-recipe-form";

export type ProductTypeOption = { id: string; code: string; nameAr: string };

export function ProductSection({
  index,
  productTypes,
  pricingFactors,
  defaultPricingFactorId,
  onRemove,
  onSubtotalChange,
}: {
  index: number;
  productTypes: ProductTypeOption[];
  pricingFactors: PricingFactorOption[];
  defaultPricingFactorId?: string;
  onRemove: () => void;
  onSubtotalChange: (subtotal: number, approvalInfo?: ApprovalInfo) => void;
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
              onSubtotalChange(0);
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
          onResult={(subtotal, approvalInfo) => onSubtotalChange(subtotal, approvalInfo)}
        />
      )}
    </div>
  );
}
