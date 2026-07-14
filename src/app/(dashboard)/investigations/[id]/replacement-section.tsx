"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createReplacementOrderAction } from "../actions";

// PHASE 4 (D-29): TEC_APPROVER يُصدر البديل بعد حكم ADMIN — كأي أمر تصنيع:
// نفس الحراس، ويدخل بوابة REVIEW مباشرة. الزر ظاهر مع تنويه الدور، والحارس server-side.
export function ReplacementSection({
  investigationId,
  replacementOrderId,
  verdictFaultLabel,
}: {
  investigationId: string;
  replacementOrderId: string | null;
  verdictFaultLabel: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleIssue() {
    setBusy(true);
    const res = await createReplacementOrderAction({ investigationId });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(t(res.error));
      return;
    }
    toast.success(t("investigations.replacementIssued"));
    router.refresh();
  }

  return (
    <section className="border rounded-md text-sm max-w-3xl">
      <p className="bg-muted px-3 py-1.5 font-semibold border-b">
        {t("investigations.replacementTitle")}
      </p>
      <div className="p-3 space-y-2">
        {replacementOrderId ? (
          <p>
            {t("investigations.replacementExisting")}{" "}
            <Link href={`/manufacturing/${replacementOrderId}`} className="underline" dir="ltr">
              {replacementOrderId}
            </Link>
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {t("investigations.replacementHint", { fault: verdictFaultLabel })}
            </p>
            <Button type="button" onClick={handleIssue} disabled={busy}>
              {t("investigations.issueReplacementBtn")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
