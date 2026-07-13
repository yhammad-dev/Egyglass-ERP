"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openFaultInvestigationAction } from "./actions";

export function OpenInvestigationButton({
  installationItemId,
}: {
  installationItemId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    const res = await openFaultInvestigationAction({ installationItemId });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(t(res.error));
      return;
    }
    toast.success(t("investigations.opened"));
    router.refresh();
  }

  return (
    <Button type="button" size="sm" onClick={handleOpen} disabled={busy}>
      {t("investigations.openBtn")}
    </Button>
  );
}
