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
  confirmMatchAction,
  assignFactoryAction,
} from "./actions";

type FactoryOption = { id: string; name: string; code: string };
type MatchItem = "CUSTOMER_REQUEST" | "INSPECTION" | "ENGINEERING";

type ThreeWay = {
  customerRequest: {
    code: string;
    summary: string | null;
    items: { description: string; quantity: number }[];
  };
  inspection: {
    hasInspection: boolean;
    measurements: {
      description: string;
      width: string;
      height: string;
      unit: string;
      quantity: number;
      notes: string | null;
    }[];
    drawings: { name: string; url: string }[];
  };
  engineering: {
    drawings: { name: string; url: string; revision: string | null }[];
  };
};

export function ReviewPanel({
  orderId,
  status,
  userRole,
  factories,
  expectedAt,
  threeWay,
  confirmedItems,
}: {
  orderId: string;
  status: string;
  userRole: string;
  factories: FactoryOption[];
  expectedAt: string | null;
  threeWay: ThreeWay;
  confirmedItems: MatchItem[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const canSubmit = ["PROCUREMENT", "TECHNICAL_OFFICE", "ADMIN"].includes(userRole);
  // PHASE 3 (D-09): القرار = محمد حسام (REVIEW) — لا مدير المعاينات
  const canDecide = ["REVIEW", "ADMIN"].includes(userRole);
  // D-12: تعيين المصنع/التاريخ = شكري (PROCUREMENT)
  const canAssignFactory = ["PROCUREMENT", "ADMIN"].includes(userRole);

  const [confirmed, setConfirmed] = useState<Set<MatchItem>>(new Set(confirmedItems));
  const [factoryId, setFactoryId] = useState("");
  const [expectedInput, setExpectedInput] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const daysLeft = expectedAt
    ? Math.ceil((new Date(expectedAt).getTime() - Date.now()) / 86400000)
    : null;

  const allConfirmed =
    confirmed.has("CUSTOMER_REQUEST") &&
    confirmed.has("INSPECTION") &&
    confirmed.has("ENGINEERING");

  async function run(
    fn: () => Promise<{ success?: true } | { error: string }>,
    okMsg: string
  ) {
    setError(null);
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if ("error" in result) {
      setError(t(result.error));
      toast.error(t(result.error));
      return false;
    }
    toast.success(t(okMsg));
    return true;
  }

  async function handleConfirm(item: MatchItem) {
    setBusy(true);
    const result = await confirmMatchAction({ id: orderId, item });
    setBusy(false);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    setConfirmed(new Set(result.confirmed as MatchItem[]));
    toast.success(t("manufacturing.matchConfirmed"));
  }

  const MATCH_UI: { key: MatchItem; titleKey: string; body: React.ReactNode }[] = [
    {
      key: "CUSTOMER_REQUEST",
      titleKey: "manufacturing.matchCustomerRequest",
      body: (
        <div className="text-xs space-y-1">
          <p dir="ltr" className="font-mono">{threeWay.customerRequest.code}</p>
          {threeWay.customerRequest.summary && <p>{threeWay.customerRequest.summary}</p>}
          <ul className="list-disc pr-4">
            {threeWay.customerRequest.items.map((it, i) => (
              <li key={i}>
                {it.description} — <span dir="ltr">{it.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: "INSPECTION",
      titleKey: "manufacturing.matchInspection",
      body: (
        <div className="text-xs space-y-1">
          {!threeWay.inspection.hasInspection && (
            <p className="text-amber-600">{t("manufacturing.noInspection")}</p>
          )}
          {threeWay.inspection.measurements.map((m, i) => (
            <p key={i}>
              <span>{m.description}</span>{" · "}
              <span dir="ltr">
                {m.width} × {m.height} {t(`inspections.detail.unit_${m.unit}`)} × {m.quantity}
              </span>
              {m.notes ? ` — ${m.notes}` : ""}
            </p>
          ))}
          {threeWay.inspection.drawings.map((d, i) => (
            <a key={i} href={d.url} target="_blank" className="underline block">
              {d.name}
            </a>
          ))}
        </div>
      ),
    },
    {
      key: "ENGINEERING",
      titleKey: "manufacturing.matchEngineering",
      body: (
        <div className="text-xs space-y-1">
          {threeWay.engineering.drawings.length === 0 && (
            <p className="text-amber-600">{t("manufacturing.noEngineeringDrawing")}</p>
          )}
          {threeWay.engineering.drawings.map((d, i) => (
            <a key={i} href={d.url} target="_blank" className="underline block">
              {d.name} {d.revision ? `(rev ${d.revision})` : ""}
            </a>
          ))}
        </div>
      ),
    },
  ];

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

      {/* PHASE 3 (D-09): عرض الأضلاع الثلاثة + تأكيد صريح لكل ضلع — لا مقارنة آلية */}
      {canDecide && status === "UNDER_REVIEW" && (
        <>
          <p className="text-sm text-muted-foreground">{t("manufacturing.matchInstruction")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MATCH_UI.map(({ key, titleKey, body }) => {
              const done = confirmed.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-md border p-3 space-y-2 ${done ? "border-green-500 bg-green-50" : ""}`}
                >
                  <p className="font-medium text-sm">{t(titleKey)}</p>
                  {body}
                  <Button
                    type="button"
                    size="sm"
                    variant={done ? "outline" : "default"}
                    disabled={busy || done}
                    onClick={() => handleConfirm(key)}
                  >
                    {done ? `✓ ${t("manufacturing.confirmed")}` : t("manufacturing.confirmMatch")}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        {canSubmit && (status === "PENDING" || status === "REJECTED") && (
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => submitForReviewAction({ id: orderId }), "manufacturing.submitted").then(
                (ok) => ok && router.refresh()
              )
            }
          >
            {t("manufacturing.submitForReview")}
          </Button>
        )}

        {/* D-12: REVIEW يعتمد بالمطابقة فقط — لا مصنع/تاريخ (نُقلا لـ PROCUREMENT) */}
        {canDecide && status === "UNDER_REVIEW" && (
          <>
            <Button
              type="button"
              // الاعتماد محجوب حتى تكتمل التأكيدات الثلاثة (تعزيز UI؛ الحجب الحقيقي server-side)
              disabled={busy || !allConfirmed}
              title={!allConfirmed ? t("manufacturing.matchIncompleteHint") : undefined}
              onClick={() =>
                run(
                  () => approveOrderAction({ id: orderId }),
                  "manufacturing.approved"
                ).then((ok) => ok && router.refresh())
              }
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
                ).then((ok) => ok && router.refresh())
              }
            >
              {t("manufacturing.reject")}
            </Button>
          </>
        )}

        {/* D-12: PROCUREMENT (شكري) يعيّن المصنع + التاريخ على أمر معتمد (IN_PRODUCTION) */}
        {canAssignFactory && status === "IN_PRODUCTION" && (
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
                    assignFactoryAction({
                      id: orderId,
                      factoryId,
                      expectedAt: expectedInput,
                    }),
                  "manufacturing.factoryAssigned"
                ).then((ok) => ok && router.refresh());
              }}
            >
              {t("manufacturing.assignFactory")}
            </Button>
          </>
        )}
      </div>
      {!allConfirmed && canDecide && status === "UNDER_REVIEW" && (
        <p className="text-xs text-amber-600">{t("manufacturing.matchIncompleteHint")}</p>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}
