"use client";

import { useEffect, useState } from "react";
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
import {
  createInspectionAction,
  getSelectableRequests,
} from "@/app/(dashboard)/inspections/actions";

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
  // D-31 (BL-91): الطلب يُختار صراحةً من طلبات العميل المؤهَّلة
  const [requests, setRequests] = useState<
    { id: string; code: string; technicalRoute: string }[]
  >([]);
  const [quotationRequestId, setQuotationRequestId] = useState<string>("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [location, setLocation] = useState<string>("INSIDE_CAIRO");
  const [address, setAddress] = useState(customerAddress ?? "");
  const [phone, setPhone] = useState(customerPhone);
  const [type, setType] = useState<string>("PRICING");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D-31 (BL-91): عند فتح الحوار، اجلب طلبات العميل المؤهَّلة (غير مربوطة · غير DONE)
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingRequests(true);
    setQuotationRequestId("");
    getSelectableRequests(customerId)
      .then((res) => {
        if (!active) return;
        setRequests(res.success ? res.data : []);
        setLoadingRequests(false);
      })
      .catch(() => {
        // فشل RPC: لا تعلّق الحوار على "تحميل" — أفرغ القائمة وأوقف التحميل
        if (!active) return;
        setRequests([]);
        setLoadingRequests(false);
      });
    return () => {
      active = false;
    };
  }, [open, customerId]);

  async function handleSubmit() {
    if (!quotationRequestId) {
      setError(t("inspections.selectRequest"));
      return;
    }
    if (!address.trim() || !phone.trim()) {
      setError(t("errors.required"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await createInspectionAction({
        customerId,
        quotationRequestId,
        location,
        address: address.trim(),
        phone: phone.trim(),
        type,
        notes: notes.trim() || undefined,
      });

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
    } finally {
      // لا يعلّق الزر على "جارٍ الحفظ" لو رمى الأكشن (RPC)
      setSubmitting(false);
    }
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
          {/* D-31 (BL-91): اختيار الطلب صراحةً — لا معاينة بلا طلب */}
          <div className="space-y-2">
            <Label htmlFor="ri-request">{t("inspections.selectRequest")}</Label>
            {loadingRequests ? (
              <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-amber-600">
                {t("inspections.noSelectableRequests")}
              </p>
            ) : (
              <Select value={quotationRequestId} onValueChange={setQuotationRequestId}>
                <SelectTrigger id="ri-request">
                  <SelectValue placeholder={t("inspections.selectRequest")}>
                    {requests.find((r) => r.id === quotationRequestId)?.code ??
                      t("inspections.selectRequest")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {requests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.code} · {t(`quotationRequest.route_${r.technicalRoute}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting || loadingRequests || requests.length === 0 || !quotationRequestId
            }
          >
            {submitting ? t("app.loading") : t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
