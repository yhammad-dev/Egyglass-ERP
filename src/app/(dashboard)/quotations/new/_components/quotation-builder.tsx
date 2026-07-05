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
import type { PricingFactorOption } from "./product-recipe-form";

type CustomerOption = { id: string; name: string; phone: string };

type Section = { key: number; subtotal: number };

export function QuotationBuilder({
  customers,
  productTypes,
  pricingFactors,
}: {
  customers: CustomerOption[];
  productTypes: ProductTypeOption[];
  pricingFactors: PricingFactorOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [globalFactorId, setGlobalFactorId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);

  function addSection() {
    setSections((prev) => [...prev, { key: nextKey, subtotal: 0 }]);
    setNextKey((k) => k + 1);
  }

  function removeSection(key: number) {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }

  function updateSubtotal(key: number, subtotal: number) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, subtotal } : s)));
  }

  async function handleSave() {
    setError(null);

    if (!customerId || !title || sections.length === 0 || sections.some((s) => s.subtotal <= 0)) {
      setError(t("errors.invalidInput"));
      return;
    }

    setSubmitting(true);
    const { createQuotation } = await import("../../../../../../lib/pricing/actions");
    const response = await createQuotation({
      customerId,
      title,
      items: sections.map((s, i) => ({
        description: `${title} - ${i + 1}`,
        quantity: 1,
        unitPrice: s.subtotal,
      })),
    });
    setSubmitting(false);

    if ("error" in response) {
      setError(t(response.error));
      return;
    }

    toast.success(t("quotations.new.saved"));
    router.push(`/quotations/${response.data.id}`);
  }

  return (
    <div className="space-y-6 p-6 pb-32">
      <h1 className="text-xl font-semibold">{t("quotations.newQuotation")}</h1>

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
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <ProductSection
            key={s.key}
            index={i}
            productTypes={productTypes}
            pricingFactors={pricingFactors}
            defaultPricingFactorId={globalFactorId || undefined}
            onRemove={() => removeSection(s.key)}
            onSubtotalChange={(subtotal) => updateSubtotal(s.key, subtotal)}
          />
        ))}

        <Button type="button" variant="outline" onClick={addSection}>
          {t("quotations.new.addProduct")}
        </Button>
      </div>

      <FieldError message={error ?? undefined} />

      <div className="fixed bottom-0 inset-x-0 border-t bg-background p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            {sections.map((s, i) => (
              <div key={s.key} className="flex justify-between gap-6">
                <span>
                  {title || t("quotations.new.quotationTitle")} {i + 1}
                </span>
                <span dir="ltr">{s.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-6 font-semibold">
              <span>{t("quotations.total")}</span>
              <span dir="ltr">{grandTotal.toFixed(2)}</span>
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
