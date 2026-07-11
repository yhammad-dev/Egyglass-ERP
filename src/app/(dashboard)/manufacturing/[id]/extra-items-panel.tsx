"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import {
  addExtraItemAction,
  confirmExtraItemAction,
  setExtraItemCostAction,
} from "./actions";

type ItemRow = {
  id: string;
  type: string;
  description: string | null;
  qty: number | null;
  unitCost: number | null;
  confirmedByInspection: boolean;
  createdByName: string;
};

const TYPES = ["CHAMFER", "WELDING", "EXTRA_ACCESSORY", "OUT_OF_CAIRO_TRANSPORT", "SANDING"];

export function ExtraItemsPanel({
  manufacturingOrderId,
  userRole,
  initialItems,
}: {
  manufacturingOrderId: string;
  userRole: string;
  initialItems: ItemRow[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const canAdd = ["TECHNICAL_OFFICE", "ADMIN"].includes(userRole);
  const canConfirm = ["INSPECTION_MANAGER", "INSPECTION_REP", "ADMIN"].includes(userRole);
  const canCost = ["PROCUREMENT", "ADMIN"].includes(userRole);

  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});

  const fmt = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 });

  async function handleAdd() {
    setFormError(null);
    if (!type) {
      setFormError(t("errors.invalidInput"));
      return;
    }
    setBusy("add");
    const result = await addExtraItemAction({
      manufacturingOrderId,
      type,
      description: description || undefined,
      qty: qty ? Number(qty) : undefined,
    });
    setBusy(null);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t("extraItems.added"));
    setType("");
    setDescription("");
    setQty("");
    router.refresh();
  }

  async function handleConfirm(id: string) {
    setBusy(id);
    const result = await confirmExtraItemAction({ id });
    setBusy(null);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(t("extraItems.confirmed"));
    router.refresh();
  }

  async function handleCost(id: string) {
    const value = Number(costInputs[id]);
    if (Number.isNaN(value) || value < 0) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setBusy(id);
    const result = await setExtraItemCostAction({ id, unitCost: value });
    setBusy(null);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(t("extraItems.costSaved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("extraItems.title")}</h2>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("extraItems.type")}</TableHead>
              <TableHead>{t("extraItems.description")}</TableHead>
              <TableHead>{t("extraItems.qty")}</TableHead>
              <TableHead>{t("extraItems.unitCost")}</TableHead>
              <TableHead>{t("extraItems.confirmation")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialItems.length ? (
              initialItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{t(`extraItems.type_${item.type}`)}</TableCell>
                  <TableCell>{item.description ?? "—"}</TableCell>
                  <TableCell>
                    <span dir="ltr">{item.qty ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {item.unitCost !== null ? fmt.format(item.unitCost) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.confirmedByInspection ? "default" : "secondary"}>
                      {t(
                        item.confirmedByInspection
                          ? "extraItems.confirmedBadge"
                          : "extraItems.pendingBadge"
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canConfirm && !item.confirmedByInspection && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy === item.id}
                          onClick={() => handleConfirm(item.id)}
                        >
                          {t("extraItems.confirm")}
                        </Button>
                      )}
                      {canCost && item.confirmedByInspection && (
                        <>
                          <Input
                            dir="ltr"
                            className="w-24 h-8"
                            placeholder={t("extraItems.unitCost")}
                            value={costInputs[item.id] ?? ""}
                            onChange={(e) =>
                              setCostInputs((p) => ({ ...p, [item.id]: e.target.value }))
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy === item.id}
                            onClick={() => handleCost(item.id)}
                          >
                            {t("app.save")}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("extraItems.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canAdd && (
        <div className="rounded-md border p-4 max-w-lg space-y-3">
          <p className="font-semibold">{t("extraItems.addTitle")}</p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <Label>{t("extraItems.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {type ? t(`extraItems.type_${type}`) : t("extraItems.selectType")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`extraItems.type_${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ei-desc">{t("extraItems.description")}</Label>
              <Input
                id="ei-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-52"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ei-qty">{t("extraItems.qty")}</Label>
              <Input
                id="ei-qty"
                dir="ltr"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-20"
              />
            </div>
            <Button type="button" onClick={handleAdd} disabled={busy === "add"}>
              {t("extraItems.add")}
            </Button>
          </div>
          <FieldError message={formError ?? undefined} />
        </div>
      )}
    </div>
  );
}
