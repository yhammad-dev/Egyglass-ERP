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

export function StageChangeDialog({
  customerId,
  currentStage,
  onStageChanged,
}: {
  customerId: string;
  currentStage: string;
  onStageChanged: () => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [newStage, setNewStage] = useState(currentStage);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (newStage === currentStage) return;
    setSubmitting(true);
    setError(null);

    const { changeCustomerStage } = await import(
      "@/lib/actions/customers"
    );

    const result = await changeCustomerStage({
      customerId,
      newStage,
      rejectReason: newStage === "REJECTED" ? rejectReason : undefined,
    });

    setSubmitting(false);

    if ("error" in result) {
      setError(t(result.error));
      return;
    }

    setOpen(false);
    onStageChanged();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="space-y-2">
            <Label htmlFor="stage">{t("customers.stage")}</Label>
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger id="stage">
                <SelectValue>{t(`pipeline.${newStage}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`pipeline.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStage === "REJECTED" && (
            <div className="space-y-2">
              <Label htmlFor="rejectReason">{t("customers.rejectReason")}</Label>
              <Input
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("customers.rejectReasonPlaceholder")}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("customers.cancel")}
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting || newStage === currentStage}>
            {submitting ? t("app.loading") : t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
