"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { judgeFaultInvestigationAction } from "../actions";

const FAULT_TYPES = [
  "BREAKAGE",
  "FACTORY_ERROR",
  "TEC_ERROR",
  "MEASUREMENT_ERROR",
  "CUSTOMER_DELAY",
];

// PHASE 3 (D-25): الحُكم ADMIN فقط — النموذج ظاهر لمن يرى الشاشة مع تنويه صريح،
// والحارس server-side يرفض غير ADMIN (نمط BL-32: سبب صريح لا إخفاء صامت).
export function VerdictForm({ investigationId }: { investigationId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [verdictFault, setVerdictFault] = useState("");
  const [verdictNotes, setVerdictNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleJudge() {
    if (!verdictFault) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setBusy(true);
    const res = await judgeFaultInvestigationAction({
      investigationId,
      verdictFault,
      verdictNotes,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(t(res.error));
      return;
    }
    toast.success(t("investigations.judged"));
    router.refresh();
  }

  return (
    <section className="border rounded-md text-sm max-w-3xl">
      <p className="bg-muted px-3 py-1.5 font-semibold border-b">
        {t("investigations.verdictTitle")}
      </p>
      <div className="p-3 space-y-3">
        <p className="text-muted-foreground">{t("investigations.verdictAdminOnly")}</p>
        <div className="space-y-1">
          <Label>{t("investigations.verdictFault")}</Label>
          <Select value={verdictFault} onValueChange={setVerdictFault}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t("investigations.selectVerdictFault")} />
            </SelectTrigger>
            <SelectContent>
              {FAULT_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {t(`investigations.fault_${ft}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="verdict-notes">{t("investigations.verdictNotes")}</Label>
          <Textarea
            id="verdict-notes"
            value={verdictNotes}
            onChange={(e) => setVerdictNotes(e.target.value)}
            rows={4}
            maxLength={10000}
            placeholder={t("investigations.verdictNotesHint")}
          />
        </div>
        <Button type="button" onClick={handleJudge} disabled={busy}>
          {t("investigations.judgeBtn")}
        </Button>
      </div>
    </section>
  );
}
