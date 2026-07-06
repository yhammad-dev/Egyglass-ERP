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

type EditItem = { key: number; description: string; quantity: number; unitPrice: number };

export function QuotationBuilder({
  customers,
  productTypes,
  pricingFactors,
  mode = "create",
  quotationId,
  initialCustomerId,
  initialTitle,
  initialItems,
}: {
  customers: CustomerOption[];
  productTypes: ProductTypeOption[];
  pricingFactors: PricingFactorOption[];
  mode?: "create" | "edit";
  quotationId?: string;
  initialCustomerId?: string;
  initialTitle?: string;
  initialItems?: { description: string; quantity: number; unitPrice: number }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = mode === "edit";

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [globalFactorId, setGlobalFactorId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [nextKey, setNextKey] = useState(0);
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
    setSections((prev) => [...prev, { key: nextKey, subtotal: 0 }]);
    setNextKey((k) => k + 1);
  }

  function removeSection(key: number) {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }

  function updateSubtotal(key: number, subtotal: number) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, subtotal } : s)));
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
      if (
        !customerId ||
        !title ||
        editItems.length === 0 ||
        editItems.some((i) => !i.description || i.quantity <= 0 || i.unitPrice < 0)
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
      )}

      <FieldError message={error ?? undefined} />

      <div className="fixed bottom-0 inset-x-0 border-t bg-background p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            {!isEdit &&
              sections.map((s, i) => (
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
