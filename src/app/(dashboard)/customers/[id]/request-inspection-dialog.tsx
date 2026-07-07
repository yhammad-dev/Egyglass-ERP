"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LOCATIONS = ["INSIDE_CAIRO", "OUTSIDE_CAIRO"] as const;
const TYPES = ["PRICING", "EXECUTION"] as const;

export function RequestInspectionDialog({
  customerId,
  customerPhone,
  customerAddress,
  onCreated,
}: {
  customerId: string;
  customerPhone: string;
  customerAddress: string | null;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<string>("INSIDE_CAIRO");
  const [address, setAddress] = useState(customerAddress ?? "");
  const [phone, setPhone] = useState(customerPhone);
  const [type, setType] = useState<string>("PRICING");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!address.trim() || !phone.trim()) {
      setError(t("errors.required"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const { createInspectionAction } = await import(
      "@/app/(dashboard)/inspections/actions"
    );

    const result = await createInspectionAction({
      customerId,
      location,
      address: address.trim(),
      phone: phone.trim(),
      type,
      notes: notes.trim() || undefined,
    });

    setSubmitting(false);

    if (!result.success) {
      const msg =
        typeof result.error === "string"
          ? t(result.error)
          : t("errors.createFailed");
      setError(msg);
      return;
    }

    setOpen(false);
    onCreated();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        {t("customers.requestInspection")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inspections.newInspection")}</DialogTitle>
          <DialogDescription>
            {t("customers.requestInspectionDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ri-location">{t("inspections.location")}</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="ri-location">
                  <SelectValue>
                    {t(`inspections.${location === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {t(`inspections.${loc === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ri-type">{t("inspections.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="ri-type">
                  <SelectValue>
                    {t(`inspections.type_${type}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`inspections.type_${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ri-address">{t("inspections.address")}</Label>
            <Input
              id="ri-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ri-phone">{t("inspections.phone")}</Label>
            <Input
              id="ri-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ri-notes">{t("inspections.notes")}</Label>
            <Textarea
              id="ri-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("inspections.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("customers.cancel")}
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("app.loading") : t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
