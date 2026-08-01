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

const STAGES = [
  "NEW",
  "PRICED",
  "FOLLOW_UP",
  "INSPECTION",
  "EXECUTION",
  "RE_INSPECTION_FOLLOWUP",
  "REJECTED",
] as const;

/**
 * D-IN-21: المراحل المتاحة لغير-ADMIN. **الرفض وحده** — تقييد لا توسيع، ومطابق
 * حرفيًا لما يقبله الخادم (SF-03). أي توسيع هنا يجب أن يسبقه توسيع الحارس هناك.
 */
const REJECT_ONLY_STAGES = ["REJECTED"] as const;

const REJECT_REASONS = [
  "PRICE_HIGH",
  "LONG_DURATION",
  "FOUND_ALTERNATIVE",
  "NO_NEED",
  "POSTPONED",
  "OTHER",
] as const;

type RejectReason = (typeof REJECT_REASONS)[number];

export function StageChangeDialog({
  customerId,
  currentStage,
  onStageChanged,
  canOverrideStage,
}: {
  customerId: string;
  currentStage: string;
  onStageChanged: () => void;
  /**
   * D-IN-21 (C2-fix-2): `true` = ADMIN (كل المراحل — override) ·
   * `false` = مبيعات (**الرفض وحده**).
   *
   * 🔴 مرآة حارس SF-03 الخادمي (`lib/actions/customers.ts`) الذي يرفض من غير-ADMIN
   * أيَّ انتقال ليس `REJECTED`. عرض القائمة كاملة للمندوب كان سيُنتج **زرًّا نصف
   * ميت**: يختار «معاينة» فيُرفض بـ`errors.notAuthorized` — أي نُبدِل عيب الطريق
   * المقطوع بعيب الوعد الكاذب (STD-15). **القرار النافذ خادمي؛ هذا عرضٌ يعكسه.**
   */
  canOverrideStage: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  // المراحل المعروضة تتبع الصلاحية: ADMIN يرى الكل، والمبيعات ترى `REJECTED` وحدها.
  const availableStages = canOverrideStage ? STAGES : REJECT_ONLY_STAGES;
  const [newStage, setNewStage] = useState<(typeof STAGES)[number] | null>(
    // 🔴 غير-ADMIN يبدأ على `REJECTED` مباشرةً لا على المرحلة الحالية: القائمة لا
    // تحوي المرحلة الحالية أصلًا، فبدء الحالة عليها كان يُظهر قيمة خارج الخيارات
    // ويُبقي حارس `newStage === currentStage` مانعًا للإرسال بلا تفسير.
    canOverrideStage ? (currentStage as (typeof STAGES)[number]) : "REJECTED"
  );
  const [selectedReason, setSelectedReason] = useState<RejectReason | "">("");
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildRejectReason(): string {
    const label = selectedReason
      ? t(`customers.reason_${selectedReason}`)
      : "";
    const text = freeText.trim();
    if (label && text) return `${label}: ${text}`;
    if (label) return label;
    return text;
  }

  async function handleSubmit() {
    if (newStage === currentStage) return;
    setError(null);

    if (newStage === "REJECTED") {
      if (!selectedReason) {
        setError(t("customers.rejectReasonLabel") + " " + t("errors.required"));
        return;
      }
      if (selectedReason === "OTHER" && !freeText.trim()) {
        setError(t("customers.rejectReasonDetailRequired"));
        return;
      }
    }

    setSubmitting(true);

    const { changeCustomerStage } = await import("@/lib/actions/customers");

    const result = await changeCustomerStage({
      customerId,
      newStage: newStage ?? (currentStage as (typeof STAGES)[number]),
      rejectReason:
        newStage === "REJECTED" ? buildRejectReason() : undefined,
    });

    setSubmitting(false);

    if ("error" in result) {
      setError(t(result.error));
      return;
    }

    setOpen(false);
    onStageChanged();
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setSelectedReason("");
      setFreeText("");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {t("customers.changeStage")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("customers.changeStage")}</DialogTitle>
          <DialogDescription>
            {t("customers.changeStageDesc", { stage: t(`pipeline.${currentStage}`) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stage selector */}
          <div className="space-y-2">
            <Label htmlFor="stage">{t("customers.stage")}</Label>
            <Select
              value={newStage ?? currentStage}
              onValueChange={(value) => {
                setNewStage((value as (typeof STAGES)[number]) ?? null);
                setSelectedReason("");
                setFreeText("");
                setError(null);
              }}
            >
              <SelectTrigger id="stage">
                <SelectValue>{t(`pipeline.${newStage ?? currentStage}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`pipeline.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rejection reason controls */}
          {newStage === "REJECTED" && (
            <>
              {/* (أ) Drop-down أسباب محددة */}
              <div className="space-y-2">
                <Label htmlFor="rejectReasonSelect">
                  {t("customers.rejectReasonLabel")}
                  <span className="text-red-500 mr-1">*</span>
                </Label>
                <Select
                  value={selectedReason}
                  onValueChange={(v) => setSelectedReason(v as RejectReason)}
                >
                  <SelectTrigger id="rejectReasonSelect">
                    <SelectValue>
                      {selectedReason
                        ? t(`customers.reason_${selectedReason}`)
                        : t("customers.rejectReasonLabel")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {REJECT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`customers.reason_${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* (ب) نص حر — دائماً ظاهر، إجباري فقط عند OTHER */}
              <div className="space-y-2">
                <Label htmlFor="rejectFreeText">
                  {t("customers.rejectReasonDetail")}
                  {selectedReason === "OTHER" && (
                    <span className="text-red-500 mr-1">*</span>
                  )}
                </Label>
                <Input
                  id="rejectFreeText"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder={t("customers.rejectReasonPlaceholder")}
                />
              </div>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("customers.cancel")}
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || newStage === currentStage}
          >
            {submitting ? t("app.loading") : t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
