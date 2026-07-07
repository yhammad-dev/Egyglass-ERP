"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DiscountRequestData = {
  id: string;
  requestedPct: number;
  reason: string | null;
  createdAt: string;
};

type Props = {
  discountRequest: DiscountRequestData | null;
  currentRole: string;
  discountMaxReqPct: number;
};

export function DiscountApprovalPanel({ discountRequest, currentRole, discountMaxReqPct }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adjustedPct, setAdjustedPct] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [mode, setMode] = useState<"idle" | "adjust" | "reject">("idle");

  if (!discountRequest) return null;

  const { id, requestedPct, reason, createdAt } = discountRequest;

  const isAdmin = currentRole === "ADMIN";
  const isSalesManager = currentRole === "SALES_MANAGER";
  const isSalesRep = currentRole === "SALES_REP";

  // SALES_MANAGER can only decide if requestedPct ≤ discountMaxReqPct
  const canDecide =
    isAdmin || (isSalesManager && requestedPct <= discountMaxReqPct);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function submit(decision: "APPROVED" | "ADJUSTED" | "REJECTED") {
    setError(null);

    if (decision === "REJECTED" && !rejectNote.trim()) {
      setError(t("errors.rejectReasonRequired"));
      return;
    }

    const finalPct =
      decision === "ADJUSTED"
        ? Number(adjustedPct)
        : requestedPct;

    if (decision === "ADJUSTED" && (Number.isNaN(finalPct) || finalPct <= 0 || finalPct > requestedPct)) {
      setError(t("errors.invalidInput"));
      return;
    }

    startTransition(async () => {
      const { decideDiscountAction } = await import("@/lib/actions/discount");
      const result = await decideDiscountAction({
        discountRequestId: id,
        decision,
        approvedPct: decision === "ADJUSTED" ? finalPct : undefined,
        rejectNote: decision === "REJECTED" ? rejectNote : undefined,
      });

      if ("error" in result) {
        setError(t(result.error));
        return;
      }

      toast.success(t("discount.panel.success"));
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
        {t("discount.panel.title")}
      </h2>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("discount.panel.requestedPct")}</dt>
        <dd dir="ltr" className="font-medium">
          {requestedPct}%
        </dd>

        {reason && (
          <>
            <dt className="text-muted-foreground">{t("discount.panel.reason")}</dt>
            <dd>{reason}</dd>
          </>
        )}

        <dt className="text-muted-foreground">{t("discount.panel.requestedAt")}</dt>
        <dd>{dateFormat.format(new Date(createdAt))}</dd>
      </dl>

      {/* Read-only view for SALES_REP or SALES_MANAGER without authority */}
      {(isSalesRep || (!canDecide && !isAdmin)) && (
        <p className="text-xs text-muted-foreground">
          {isSalesRep
            ? t("discount.panel.awaitingApproval")
            : t("discount.panel.noPermission")}
        </p>
      )}

      {/* Decision controls */}
      {canDecide && (
        <div className="space-y-3">
          {/* Adjust mode: show adjustedPct input */}
          {mode === "adjust" && (
            <div className="space-y-1">
              <Label htmlFor="adjustedPct">{t("discount.panel.adjustedPct")}</Label>
              <Input
                id="adjustedPct"
                type="number"
                dir="ltr"
                min={0}
                max={requestedPct}
                step="0.01"
                value={adjustedPct}
                onChange={(e) => setAdjustedPct(e.target.value)}
                className="max-w-[140px]"
              />
            </div>
          )}

          {/* Reject mode: show rejectNote input */}
          {mode === "reject" && (
            <div className="space-y-1">
              <Label htmlFor="rejectNote">{t("discount.panel.rejectNote")}</Label>
              <Input
                id="rejectNote"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder={t("discount.panel.rejectNotePlaceholder")}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            {mode === "idle" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isPending}
                  onClick={() => submit("APPROVED")}
                >
                  {t("discount.panel.approve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setMode("adjust")}
                >
                  {t("discount.panel.adjust")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setMode("reject")}
                >
                  {t("discount.panel.reject")}
                </Button>
              </>
            )}

            {mode === "adjust" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isPending}
                  onClick={() => submit("ADJUSTED")}
                >
                  {isPending ? t("app.loading") : t("discount.panel.confirmAdjust")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => { setMode("idle"); setAdjustedPct(""); setError(null); }}
                >
                  {t("app.cancel")}
                </Button>
              </>
            )}

            {mode === "reject" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => submit("REJECTED")}
                >
                  {isPending ? t("app.loading") : t("discount.panel.confirmReject")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => { setMode("idle"); setRejectNote(""); setError(null); }}
                >
                  {t("app.cancel")}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
