"use client";

import { useTranslations } from "next-intl";

export function PrintButton() {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow"
    >
      {t("quotations.print.printPdf")}
    </button>
  );
}
