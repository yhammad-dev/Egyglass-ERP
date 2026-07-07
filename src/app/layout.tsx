import type { Metadata } from "next";
import { Cairo, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { IntlProvider } from "@/components/intl-provider";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "EgyGlass ERP",
  description: "نظام إدارة مؤسسات الزجاج",
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
        <IntlProvider>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
