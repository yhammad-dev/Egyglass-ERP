"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { addInstallationItemAction, addInstallationPhotoAction } from "./actions";

type ItemRow = {
  id: string;
  type: string;
  description: string | null;
  quantity: number | null;
  cost: number | null;
  createdByName: string;
  createdAt: string;
};

type PhotoRow = { id: string; url: string; caption: string | null };

const TYPES = [
  "BREAKAGE_REPLACEMENT",
  "MFG_ERROR",
  "TEC_ERROR",
  "MEASUREMENT_ERROR",
  "CLIENT_DELAY",
  "OTHER",
];

export function InstallationExtrasPanel({
  installationOrderId,
  isTeamLead,
  initialItems,
  initialPhotos,
}: {
  installationOrderId: string;
  isTeamLead: boolean;
  initialItems: ItemRow[];
  initialPhotos: PhotoRow[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fmt = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 });

  async function handleAddItem() {
    setFormError(null);
    if (!type) {
      setFormError(t("errors.invalidInput"));
      return;
    }
    setBusy(true);
    const result = await addInstallationItemAction({
      installationOrderId,
      type,
      description: description || undefined,
      quantity: quantity ? Number(quantity) : undefined,
      cost: cost ? Number(cost) : undefined,
    });
    setBusy(false);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t("installations.itemAdded"));
    setType("");
    setDescription("");
    setQuantity("");
    setCost("");
    router.refresh();
  }

  async function handleAddPhoto() {
    setFormError(null);
    if (!photoUrl.trim()) {
      setFormError(t("errors.invalidInput"));
      return;
    }
    setBusy(true);
    const result = await addInstallationPhotoAction({
      installationOrderId,
      url: photoUrl.trim(),
      caption: photoCaption || undefined,
    });
    setBusy(false);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t("installations.photoAdded"));
    setPhotoUrl("");
    setPhotoCaption("");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* ── البنود الإضافية (IMT-R05) ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("installations.itemsTitle")}</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("installations.itemType")}</TableHead>
                <TableHead>{t("installations.itemDescription")}</TableHead>
                <TableHead>{t("installations.itemQty")}</TableHead>
                <TableHead>{t("installations.itemCost")}</TableHead>
                <TableHead>{t("installations.itemBy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialItems.length ? (
                initialItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{t(`installations.itype_${item.type}`)}</TableCell>
                    <TableCell>{item.description ?? "—"}</TableCell>
                    <TableCell>
                      <span dir="ltr">{item.quantity ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {item.cost !== null ? fmt.format(item.cost) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>{item.createdByName}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("installations.noItems")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {isTeamLead && (
          <div className="rounded-md border p-4 space-y-3 max-w-2xl">
            <p className="font-semibold">{t("installations.addItem")}</p>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1">
                <Label>{t("installations.itemType")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      {type ? t(`installations.itype_${type}`) : t("installations.selectType")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {t(`installations.itype_${tp}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ii-desc">{t("installations.itemDescription")}</Label>
                <Input
                  id="ii-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-56"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ii-qty">{t("installations.itemQty")}</Label>
                <Input
                  id="ii-qty"
                  dir="ltr"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ii-cost">{t("installations.itemCost")}</Label>
                <Input
                  id="ii-cost"
                  dir="ltr"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button type="button" onClick={handleAddItem} disabled={busy}>
                {t("installations.addItemBtn")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── صور التركيب (IMT-R06 — اختيارية) ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("installations.photosTitle")}</h2>
        {initialPhotos.length ? (
          <div className="flex gap-3 flex-wrap">
            {initialPhotos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" className="block border rounded-md p-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="h-28 w-40 object-cover rounded" />
                {p.caption && <p className="mt-1 text-xs text-muted-foreground">{p.caption}</p>}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("installations.noPhotos")}</p>
        )}

        {isTeamLead && (
          <div className="rounded-md border p-4 space-y-3 max-w-2xl">
            <p className="font-semibold">{t("installations.addPhoto")}</p>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1">
                <Label htmlFor="ph-url">{t("installations.photoUrl")}</Label>
                <Input
                  id="ph-url"
                  dir="ltr"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-72"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ph-cap">{t("installations.photoCaption")}</Label>
                <Input
                  id="ph-cap"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  className="w-56"
                />
              </div>
              <Button type="button" onClick={handleAddPhoto} disabled={busy}>
                {t("installations.addPhotoBtn")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <FieldError message={formError ?? undefined} />
    </div>
  );
}
