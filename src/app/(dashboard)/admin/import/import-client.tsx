"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importPriceListAction, importMaterialsAction } from "./actions";

function ImportSection({
  titleKey,
  onImport,
}: {
  titleKey: string;
  onImport: (fd: FormData) => Promise<{ success?: true; count?: number; error?: string }>;
}) {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    setLoading(true);
    const result = await onImport(fd);
    setLoading(false);

    if ("error" in result && result.error) {
      toast.error(t(result.error as never) ?? result.error);
      return;
    }

    toast.success(`${t("import.success")} — ${result.count} ${t("import.records")}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h2 className="font-semibold text-base">{t(titleKey as never)}</h2>

      <div className="space-y-2">
        <Label>{t("import.uploadFile")}</Label>
        <Input ref={fileRef} type="file" accept=".xlsx" />
      </div>

      <Button
        type="button"
        onClick={handleUpload}
        disabled={loading}
      >
        {loading ? t("app.loading") : t("import.upload")}
      </Button>
    </div>
  );
}

export function ImportClient() {
  const t = useTranslations();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t("import.title")}</h1>

      <ImportSection
        titleKey="import.priceList"
        onImport={importPriceListAction}
      />

      <ImportSection
        titleKey="import.materials"
        onImport={importMaterialsAction}
      />
    </div>
  );
}
