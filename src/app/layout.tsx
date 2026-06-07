import type { Metadata } from "next";
import { Cairo, Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import arMessages from "../../messages/ar.json";
import enMessages from "../../messages/en.json";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
      className={cn("font-cairo", "h-full", "antialiased", cairo.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale="ar" messages={messages.ar}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
