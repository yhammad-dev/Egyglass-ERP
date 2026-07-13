"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveEvidenceNotesAction } from "../actions";

export function EvidenceNotesForm({
  investigationId,
  initialNotes,
}: {
  investigationId: string;
  initialNotes: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const res = await saveEvidenceNotesAction({ investigationId, notes });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(t(res.error));
      return;
    }
    toast.success(t("investigations.notesSaved"));
    router.refresh();
  }

  return (
    <section className="border rounded-md text-sm max-w-3xl">
      <p className="bg-muted px-3 py-1.5 font-semibold border-b">
        {t("investigations.evidenceNotes")}
      </p>
      <div className="p-3 space-y-2">
        <Label htmlFor="evidence-notes" className="text-muted-foreground">
          {t("investigations.evidenceNotesHint")}
        </Label>
        <Textarea
          id="evidence-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={10000}
        />
        <Button type="button" onClick={handleSave} disabled={busy}>
          {t("investigations.saveNotes")}
        </Button>
      </div>
    </section>
  );
}
