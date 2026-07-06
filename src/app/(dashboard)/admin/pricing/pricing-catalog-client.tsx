"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import {
  updateMaterialCost,
  toggleMaterialActive,
  togglePricingFactorActive,
  updateFactorMinimum,
} from "../../../../../lib/admin/actions";

type MaterialRow = {
  id: string;
  code: string;
  nameAr: string;
  category: string;
  unit: string;
  cost: number;
  isActive: boolean;
};

type PricingFactorRow = {
  id: string;
  label: string;
  value: number;
  isActive: boolean;
};

export function PricingCatalogClient({
  initialMaterials,
  initialPricingFactors,
  initialFactorMinimum,
}: {
  initialMaterials: MaterialRow[];
  initialPricingFactors: PricingFactorRow[];
  initialFactorMinimum: number;
}) {
  const t = useTranslations();

  const [materials, setMaterials] = useState<MaterialRow[]>(initialMaterials);
  const [pricingFactors, setPricingFactors] = useState<PricingFactorRow[]>(
    initialPricingFactors
  );
  const [editingMaterial, setEditingMaterial] = useState<MaterialRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [costInput, setCostInput] = useState("");
  const [costError, setCostError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [factorMinimum, setFactorMinimum] = useState<number>(initialFactorMinimum);
  const [factorMinInput, setFactorMinInput] = useState(String(initialFactorMinimum));
  const [factorMinError, setFactorMinError] = useState<string | null>(null);
  const [savingFactorMin, setSavingFactorMin] = useState(false);

  async function handleSaveFactorMinimum() {
    setFactorMinError(null);
    const value = Number(factorMinInput);
    if (Number.isNaN(value) || value <= 0) {
      setFactorMinError(t("errors.invalidInput"));
      return;
    }

    setSavingFactorMin(true);
    const response = await updateFactorMinimum({ value });
    setSavingFactorMin(false);

    if ("error" in response) {
      setFactorMinError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setFactorMinimum(response.value);
    toast.success("تم تحديث الحد الأدنى لعامل التسعير");
  }

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const term = searchTerm.trim().toLowerCase();
  const filteredMaterials = term
    ? materials.filter(
        (m) =>
          m.code.toLowerCase().includes(term) ||
          m.nameAr.toLowerCase().includes(term)
      )
    : materials;

  function openEditCost(material: MaterialRow) {
    setEditingMaterial(material);
    setCostInput(String(material.cost));
    setCostError(null);
  }

  async function handleSaveCost() {
    if (!editingMaterial) return;
    setCostError(null);

    const cost = Number(costInput);
    if (Number.isNaN(cost) || cost < 0) {
      setCostError(t("errors.invalidInput"));
      return;
    }

    setSubmitting(true);
    const response = await updateMaterialCost({ id: editingMaterial.id, cost });
    setSubmitting(false);

    if ("error" in response) {
      setCostError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setMaterials((prev) =>
      prev.map((m) => (m.id === editingMaterial.id ? { ...m, cost } : m))
    );
    toast.success(t("admin.pricing.costUpdated"));
    setEditingMaterial(null);
  }

  async function handleToggleMaterialActive(material: MaterialRow) {
    setTogglingId(material.id);
    const response = await toggleMaterialActive({ id: material.id });
    setTogglingId(null);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setMaterials((prev) =>
      prev.map((m) =>
        m.id === material.id ? { ...m, isActive: response.isActive } : m
      )
    );
  }

  async function handleTogglePricingFactorActive(factor: PricingFactorRow) {
    setTogglingId(factor.id);
    const response = await togglePricingFactorActive({ id: factor.id });
    setTogglingId(null);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setPricingFactors((prev) =>
      prev.map((f) =>
        f.id === factor.id ? { ...f, isActive: response.isActive } : f
      )
    );
  }

  return (
    <div className="space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">إعدادات التسعير</h1>
        <div className="rounded-md border p-4 max-w-md space-y-2">
          <Label htmlFor="factorMinimum">الحد الأدنى لعامل التسعير</Label>
          <p className="text-sm text-muted-foreground">
            أي عرض سعر بعامل أقل من هذا الحد يتطلب موافقة المدير ولا يُحتسب تلقائياً.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="factorMinimum"
              dir="ltr"
              value={factorMinInput}
              onChange={(e) => setFactorMinInput(e.target.value)}
              className="w-32"
            />
            <Button onClick={handleSaveFactorMinimum} disabled={savingFactorMin}>
              {t("admin.pricing.save")}
            </Button>
          </div>
          <FieldError message={factorMinError ?? undefined} />
          <p className="text-xs text-muted-foreground">
            القيمة الحالية:{" "}
            <span dir="ltr">{numberFormat.format(factorMinimum)}</span>
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">{t("admin.pricing.materialsTitle")}</h1>
        <div className="mb-4 max-w-sm">
          <Input
            type="search"
            placeholder="بحث بالكود أو الاسم"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.pricing.code")}</TableHead>
                <TableHead>{t("admin.pricing.nameAr")}</TableHead>
                <TableHead>{t("admin.pricing.category")}</TableHead>
                <TableHead>{t("admin.pricing.unit")}</TableHead>
                <TableHead>{t("admin.pricing.cost")}</TableHead>
                <TableHead>{t("admin.pricing.isActive")}</TableHead>
                <TableHead>{t("admin.pricing.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length ? (
                filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <span dir="ltr">{material.code}</span>
                    </TableCell>
                    <TableCell>{material.nameAr}</TableCell>
                    <TableCell>{t(`admin.pricing.category_${material.category}`)}</TableCell>
                    <TableCell>{t(`admin.pricing.unit_${material.unit}`)}</TableCell>
                    <TableCell>
                      <span dir="ltr">{numberFormat.format(material.cost)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={material.isActive ? "default" : "secondary"}>
                        {material.isActive
                          ? t("admin.pricing.active")
                          : t("admin.pricing.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditCost(material)}
                        >
                          {t("admin.pricing.editCost")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={togglingId === material.id}
                          onClick={() => handleToggleMaterialActive(material)}
                        >
                          {material.isActive
                            ? t("admin.pricing.deactivate")
                            : t("admin.pricing.activate")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t("app.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">{t("admin.pricing.pricingFactorsTitle")}</h1>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.pricing.label")}</TableHead>
                <TableHead>{t("admin.pricing.value")}</TableHead>
                <TableHead>{t("admin.pricing.isActive")}</TableHead>
                <TableHead>{t("admin.pricing.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingFactors.length ? (
                pricingFactors.map((factor) => (
                  <TableRow key={factor.id}>
                    <TableCell>{factor.label}</TableCell>
                    <TableCell>
                      <span dir="ltr">{numberFormat.format(factor.value)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={factor.isActive ? "default" : "secondary"}>
                        {factor.isActive
                          ? t("admin.pricing.active")
                          : t("admin.pricing.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={togglingId === factor.id}
                        onClick={() => handleTogglePricingFactorActive(factor)}
                      >
                        {factor.isActive
                          ? t("admin.pricing.deactivate")
                          : t("admin.pricing.activate")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {t("app.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!editingMaterial}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingMaterial(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.pricing.editCost")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="cost">{t("admin.pricing.cost")}</Label>
            <Input
              id="cost"
              dir="ltr"
              type="number"
              step="0.01"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
            />
            <FieldError message={costError ?? undefined} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMaterial(null)}
            >
              {t("admin.pricing.cancel")}
            </Button>
            <Button type="button" onClick={handleSaveCost} disabled={submitting}>
              {submitting ? t("app.loading") : t("admin.pricing.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
