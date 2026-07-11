"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { FieldError } from "@/components/ui/field-error";
import {
  submitForReviewAction,
  approveOrderAction,
  rejectOrderAction,
} from "./actions";

type FactoryOption = { id: string; name: string; code: string };

export function ReviewPanel({
  orderId,
  status,
  userRole,
  factories,
  expectedAt,
}: {
  orderId: string;
  status: string;
  userRole: string;
  factories: FactoryOption[];
  expectedAt: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();

  const canSubmit = ["PROCUREMENT", "TECHNICAL_OFFICE", "ADMIN"].includes(userRole);
  const canDecide = ["INSPECTION_MANAGER", "ADMIN"].includes(userRole);

  const [factoryId, setFactoryId] = useState("");
  const [expectedInput, setExpectedInput] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // countdown عرضي بسيط client-side — لا cron (قرار محسوم)
  const daysLeft = expectedAt
    ? Math.ceil((new Date(expectedAt).getTime() - Date.now()) / 86400000)
    : null;

  async function run(fn: () => Promise<{ success?: true } | { error: string }>, okMsg: string) {
    setError(null);
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if ("error" in result) {
      setError(t(result.error));
      toast.error(t(result.error));
      return;
    }
    toast.success(t(okMsg));
    router.refresh();
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <p className="font-semibold">{t("manufacturing.reviewGate")}</p>
        {expectedAt && (
          <p className="text-sm" dir="ltr">
            {t("manufacturing.expectedAt")}: {new Date(expectedAt).toLocaleDateString("ar-EG")}
            {daysLeft !== null && (
              <span className={daysLeft < 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                {" "}
                ({daysLeft >= 0
                  ? t("manufacturing.daysLeft", { days: daysLeft })
                  : t("manufacturing.daysOverdue", { days: Math.abs(daysLeft) })})
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        {canSubmit && (status === "PENDING" || status === "REJECTED") && (
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => submitForReviewAction({ id: orderId }), "manufacturing.submitted")
            }
          >
            {t("manufacturing.submitForReview")}
          </Button>
        )}

        {canDecide && status === "UNDER_REVIEW" && (
          <>
            <div className="space-y-1">
              <Label>{t("manufacturing.factory")}</Label>
              <Select value={factoryId} onValueChange={setFactoryId}>
                <SelectTrigger className="w-56">
                  <SelectValue>
                    {factories.find((f) => f.id === factoryId)
                      ? `${factories.find((f) => f.id === factoryId)!.code} — ${factories.find((f) => f.id === factoryId)!.name}`
                      : t("manufacturing.selectFactory")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {factories.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.code} — {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="expected">{t("manufacturing.expectedAt")}</Label>
              <Input
                id="expected"
                type="date"
                dir="ltr"
                value={expectedInput}
                onChange={(e) => setExpectedInput(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!factoryId || !expectedInput) {
                  setError(t("errors.invalidInput"));
                  return;
                }
                run(
                  () =>
                    approveOrderAction({
                      id: orderId,
                      factoryId,
                      expectedAt: expectedInput,
                    }),
                  "manufacturing.approved"
                );
              }}
            >
              {t("manufacturing.approve")}
            </Button>
            <div className="space-y-1">
              <Label htmlFor="reject-reason">{t("manufacturing.rejectReason")}</Label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-56"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () => rejectOrderAction({ id: orderId, reason: rejectReason }),
                  "manufacturing.rejected"
                )
              }
            >
              {t("manufacturing.reject")}
            </Button>
          </>
        )}
      </div>
      <FieldError message={error ?? undefined} />
    </div>
  );
}
