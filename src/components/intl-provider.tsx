"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import arMessages from "../../messages/ar.json";

export function IntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="ar" messages={arMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
