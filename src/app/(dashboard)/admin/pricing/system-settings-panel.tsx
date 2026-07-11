"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  updateWarrantySettings,
  updatePolicySettings,
  updateCashbackSettings,
} from "../../../../../lib/admin/actions";

// دفعة د: لوحة الإعدادات الكاملة — أقسام منطقية (ضمان/سياسات/كاش باك)، كل حقل بنص مساعدة
export type SystemConfig = {
  warrantyTextProjects: string;
  warrantyTextSocialMedia: string;
  warrantyProjectsOnQuotation: boolean;
  warrantyProjectsOnContract: boolean;
  warrantySocialOnQuotation: boolean;
  ceoDrawingApprovalThreshold: number | null;
  managerApprovalCeilingPct: number | null;
  reviewGatePosition: number | null;
  satisfactionSurveyDelayDays: number;
  quotationValidDays: number;
  vatPct: number;
  cashbackActive: boolean;
  cashbackStartDate: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

export function SystemSettingsPanel({ initial }: { initial: SystemConfig }) {
  const t = useTranslations();

  // ── الضمان ──
  const [wtP, setWtP] = useState(initial.warrantyTextProjects);
  const [wtS, setWtS] = useState(initial.warrantyTextSocialMedia);
  const [wpQ, setWpQ] = useState(initial.warrantyProjectsOnQuotation);
  const [wpC, setWpC] = useState(initial.warrantyProjectsOnContract);
  const [wsQ, setWsQ] = useState(initial.warrantySocialOnQuotation);
  // ── السياسات ──
  const [ceoThr, setCeoThr] = useState(initial.ceoDrawingApprovalThreshold?.toString() ?? "");
  const [mgrCeil, setMgrCeil] = useState(initial.managerApprovalCeilingPct?.toString() ?? "");
  const [reviewPos, setReviewPos] = useState(initial.reviewGatePosition?.toString() ?? "");
  const [surveyDays, setSurveyDays] = useState(String(initial.satisfactionSurveyDelayDays));
  const [validDays, setValidDays] = useState(String(initial.quotationValidDays));
  const [vat, setVat] = useState(String(initial.vatPct));
  // ── الكاش باك ──
  const [cbActive, setCbActive] = useState(initial.cashbackActive);
  const [cbDate, setCbDate] = useState(initial.cashbackStartDate ?? "");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(section: string, fn: () => Promise<{ success?: true } | { error: string }>) {
    setError(null);
    setBusy(section);
    const result = await fn();
    setBusy(null);
    if ("error" in result) {
      setError(t(result.error));
      toast.error(t(result.error));
      return;
    }
    toast.success(t("settings.saved"));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* ═══ الضمان ═══ */}
      <Section title={t("settings.warrantySection")}>
        <div className="space-y-1">
          <Label htmlFor="wtP">{t("settings.warrantyTextProjects")}</Label>
          <textarea
            id="wtP"
            className="w-full border rounded-md p-2 text-sm min-h-24"
            value={wtP}
            onChange={(e) => setWtP(e.target.value)}
          />
          <Hint text={t("settings.warrantyTextProjectsHint")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wtS">{t("settings.warrantyTextSocial")}</Label>
          <textarea
            id="wtS"
            className="w-full border rounded-md p-2 text-sm min-h-24"
            value={wtS}
            onChange={(e) => setWtS(e.target.value)}
          />
          <Hint text={t("settings.warrantyTextSocialHint")} />
        </div>
        <div className="flex gap-6 flex-wrap text-sm">
          {(
            [
              ["wpQ", wpQ, setWpQ, "settings.warrantyProjectsOnQuotation"],
              ["wpC", wpC, setWpC, "settings.warrantyProjectsOnContract"],
              ["wsQ", wsQ, setWsQ, "settings.warrantySocialOnQuotation"],
            ] as const
          ).map(([id, val, set, key]) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => set(e.target.checked)}
              />
              {t(key)}
            </label>
          ))}
        </div>
        <Hint text={t("settings.warrantySocialNoContractHint")} />
        <Button
          type="button"
          disabled={busy === "w"}
          onClick={() =>
            save("w", () =>
              updateWarrantySettings({
                warrantyTextProjects: wtP,
                warrantyTextSocialMedia: wtS,
                warrantyProjectsOnQuotation: wpQ,
                warrantyProjectsOnContract: wpC,
                warrantySocialOnQuotation: wsQ,
              })
            )
          }
        >
          {t("app.save")}
        </Button>
      </Section>

      {/* ═══ السياسات المالية والاعتمادات ═══ */}
      <Section title={t("settings.policySection")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ceoThr">{t("settings.ceoThreshold")}</Label>
            <Input id="ceoThr" dir="ltr" value={ceoThr} onChange={(e) => setCeoThr(e.target.value)} className="w-40" />
            <Hint text={t("settings.ceoThresholdHint")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mgrCeil">{t("settings.managerCeiling")}</Label>
            <Input id="mgrCeil" dir="ltr" value={mgrCeil} onChange={(e) => setMgrCeil(e.target.value)} className="w-40" />
            <Hint text={t("settings.managerCeilingHint")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reviewPos">{t("settings.reviewGatePosition")}</Label>
            <Input id="reviewPos" dir="ltr" value={reviewPos} onChange={(e) => setReviewPos(e.target.value)} className="w-40" />
            <Hint text={t("settings.reviewGatePositionHint")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="surveyDays">{t("settings.surveyDelayDays")}</Label>
            <Input id="surveyDays" dir="ltr" value={surveyDays} onChange={(e) => setSurveyDays(e.target.value)} className="w-40" />
            <Hint text={t("settings.surveyDelayDaysHint")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="validDays">{t("settings.quotationValidDays")}</Label>
            <Input id="validDays" dir="ltr" value={validDays} onChange={(e) => setValidDays(e.target.value)} className="w-40" />
            <Hint text={t("settings.quotationValidDaysHint")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vat">{t("settings.vatPct")}</Label>
            <Input id="vat" dir="ltr" value={vat} onChange={(e) => setVat(e.target.value)} className="w-40" />
            <Hint text={t("settings.vatPctHint")} />
          </div>
        </div>
        <Button
          type="button"
          disabled={busy === "p"}
          onClick={() =>
            save("p", () =>
              updatePolicySettings({
                ceoDrawingApprovalThreshold: ceoThr.trim() === "" ? null : Number(ceoThr),
                managerApprovalCeilingPct: mgrCeil.trim() === "" ? null : Number(mgrCeil),
                reviewGatePosition: reviewPos.trim() === "" ? null : Number(reviewPos),
                satisfactionSurveyDelayDays: Number(surveyDays),
                quotationValidDays: Number(validDays),
                vatPct: Number(vat),
              })
            )
          }
        >
          {t("app.save")}
        </Button>
      </Section>

      {/* ═══ الكاش باك ═══ */}
      <Section title={t("settings.cashbackSection")}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cbActive} onChange={(e) => setCbActive(e.target.checked)} />
          {t("settings.cashbackActive")}
        </label>
        <div className="space-y-1">
          <Label htmlFor="cbDate">{t("settings.cashbackStartDate")}</Label>
          <Input id="cbDate" type="date" dir="ltr" value={cbDate} onChange={(e) => setCbDate(e.target.value)} className="w-44" />
          <Hint text={t("settings.cashbackStartDateHint")} />
        </div>
        <Button
          type="button"
          disabled={busy === "c"}
          onClick={() =>
            save("c", () =>
              updateCashbackSettings({
                cashbackActive: cbActive,
                cashbackStartDate: cbDate.trim() === "" ? null : cbDate,
              })
            )
          }
        >
          {t("app.save")}
        </Button>
      </Section>

      <FieldError message={error ?? undefined} />
    </div>
  );
}
