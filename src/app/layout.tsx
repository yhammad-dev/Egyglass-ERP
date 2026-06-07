import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import arMessages from "../../messages/ar.json";
import enMessages from "../../messages/en.json";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "EgyGlass ERP",
  description: "نظام إدارة مؤسسات الزجاج",
};

const messages: Record<string, Record<string, unknown>> = {
  ar: arMessages,
  en: enMessages,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} font-cairo h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale="ar" messages={messages.ar}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
