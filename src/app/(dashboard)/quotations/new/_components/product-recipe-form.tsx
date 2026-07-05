"use client";

import { useEffect, useMemo, useState } from "react";
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

export type ConfigTypeOption = { id: string; nameAr: string };
export type PricingFactorOption = { id: string; label: string; value: number };

type RecipeLine = {
  materialId: string;
  notes: string | null;
  nameAr: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  factorMode: string;
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

function buildFormSchema(hasConfigTypes: boolean) {
  return z.object({
    height: z.coerce.number().positive("errors.invalidInput"),
    width: z.coerce.number().positive("errors.invalidInput"),
    configTypeId: hasConfigTypes
      ? z.string().min(1, "errors.invalidInput")
      : z.string().optional(),
    pricingFactorId: z.string().min(1, "errors.invalidInput"),
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
}: {
  productTypeCode: string;
  title: string;
  configTypes: ConfigTypeOption[];
  pricingFactors: PricingFactorOption[];
  defaultPricingFactorId?: string;
  onResult?: (grandTotal: number) => void;
}) {
  const t = useTranslations();
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const formSchema = useMemo(
    () => buildFormSchema(configTypes.length > 0),
    [configTypes.length]
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { pricingFactorId: defaultPricingFactorId ?? "" },
  });

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setServerError(null);
    setResult(null);
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
  }

  const groupedLines = useMemo(() => {
    const groups: Record<string, RecipeLine[]> = {};
    if (!result) return groups;
    for (const line of result.lines) {
      const key = line.notes ?? "OTHER";
      if (!groups[key]) groups[key] = [];
      groups[key].push(line);
    }
    return groups;
  }, [result]);

  // Groups with more than one option require the user to choose one.
  // Groups with exactly one option (e.g. silicone) are always included.
  const selectableCategories = Object.keys(groupedLines).filter(
    (category) => groupedLines[category].length > 1
  );
  const autoIncludedLines = Object.keys(groupedLines)
    .filter((category) => groupedLines[category].length <= 1)
    .flatMap((category) => groupedLines[category]);

  const selectedLines = useMemo(() => {
    const lines: RecipeLine[] = [...autoIncludedLines];
    for (const category of selectableCategories) {
      const materialId = selections[category];
      if (!materialId) continue;
      const line = groupedLines[category]?.find(
        (l) => l.materialId === materialId
      );
      if (line) lines.push(line);
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedLines, selections]);

  const subtotalBeforeFixed = selectedLines
    .filter((l) => l.factorMode === "STANDARD" || l.factorMode === "CUSTOM_FACTOR")
    .reduce((sum, l) => sum + l.lineTotal, 0);
  const fixedTotal = selectedLines
    .filter((l) => l.factorMode === "FIXED_AFTER")
    .reduce((sum, l) => sum + l.lineTotal, 0);
  const grandTotal = subtotalBeforeFixed + fixedTotal;

  useEffect(() => {
    onResult?.(result ? grandTotal : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, grandTotal]);

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
          />
          <FieldError message={errors.width?.message && t(errors.width.message)} />
        </div>

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
                <TableHead className="text-right">
                  <span dir="ltr">{t("quotations.shower.qty")}</span>
                </TableHead>
                <TableHead className="text-right">
                  <span dir="ltr">{t("quotations.shower.unitCost")}</span>
                </TableHead>
                <TableHead className="text-right">
                  <span dir="ltr">{t("quotations.shower.lineTotal")}</span>
                </TableHead>
                <TableHead>{t("quotations.shower.factorMode")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLines.map((line) => (
                <TableRow key={line.materialId}>
                  <TableCell>{line.nameAr}</TableCell>
                  <TableCell className="text-right">
                    <span dir="ltr">{line.qty.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span dir="ltr">{line.unitCost.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right">
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
