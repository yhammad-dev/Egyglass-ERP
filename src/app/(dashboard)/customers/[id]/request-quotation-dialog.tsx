"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { createQuotationRequestAction } from "../actions";

// دفعة هـ (W-01): المندوب يطلب التسعير — المسار إلزامي (لا افتراضي)
export function RequestQuotationDialog({
  customerId,
  onCreated,
}: {
  customerId: string;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<"" | "PROJECTS" | "SOCIAL_MEDIA">("");
  // SCR-019 (D-45): نوع الطلب (تصنيف تقريري) + تاج التوصية — مستقلان عن المسار الفني
  const [salesType, setSalesType] = useState<
    "" | "INDIVIDUAL" | "SOCIAL_MEDIA" | "PROJECTS"
  >("");
  const [referralTag, setReferralTag] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!route) {
      setError(t("errors.routeRequired"));
      return;
    }
    if (!salesType) {
      setError(t("errors.salesTypeRequired"));
      return;
    }
    if (!summary.trim()) {
      setError(t("errors.required"));
      return;
    }
    setSubmitting(true);
    const result = await createQuotationRequestAction({
      customerId,
      technicalRoute: route,
      salesRequestType: salesType,
      isReferralTag: referralTag,
      summary,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(t(result.error));
      return;
    }
    toast.success(`${t("quotationRequest.created")}: ${result.code}`);
    setOpen(false);
    setRoute("");
    setSalesType("");
    setReferralTag(false);
    setSummary("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t("quotationRequest.request")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quotationRequest.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("quotationRequest.route")} *</Label>
            <div className="flex gap-3">
              {(["PROJECTS", "SOCIAL_MEDIA"] as const).map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
                    route === r ? "border-blue-600 bg-blue-50" : "border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="route"
                    checked={route === r}
                    onChange={() => setRoute(r)}
                  />
                  {t(`quotationRequest.route_${r}`)}
                </label>
              ))}
            </div>
          </div>
          {/* SCR-019 (D-45): نوع الطلب — تصنيف تقريري إلزامي، مستقل تمامًا عن المسار الفني أعلاه */}
          <div className="space-y-2">
            <Label>{t("quotationRequest.salesType")} *</Label>
            <div className="flex flex-wrap gap-3">
              {(["INDIVIDUAL", "SOCIAL_MEDIA", "PROJECTS"] as const).map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
                    salesType === s ? "border-blue-600 bg-blue-50" : "border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="rq-salesType"
                    checked={salesType === s}
                    onChange={() => setSalesType(s)}
                  />
                  {t(`quotationRequest.salesType_${s}`)}
                </label>
              ))}
            </div>
          </div>
          {/* تاج التوصية — اختياري، افتراضي غير مفعّل، بلا أثر على المسار/التسعير/الموافقات */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={referralTag}
              onChange={(e) => setReferralTag(e.target.checked)}
            />
            {t("quotationRequest.referralTag")}
          </label>
          <div className="space-y-1">
            <Label htmlFor="rq-summary">{t("quotationRequest.summary")} *</Label>
            <Textarea
              id="rq-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("quotationRequest.summaryPlaceholder")}
            />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="button" onClick={submit} disabled={submitting}>
            {t("quotationRequest.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
