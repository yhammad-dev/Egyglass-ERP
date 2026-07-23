export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNavItems } from "@/lib/nav";
import { signOutAction } from "@/lib/actions/auth";
import { t } from "@/lib/server-translations";
import { Toaster } from "@/components/ui/sonner";
import { NotificationsBell } from "@/components/notifications-bell";
import { getSystemSettings } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Search,
  DraftingCompass,
  ClipboardCheck,
  Factory,
  Wrench,
  Gavel,
  Folder,
  Wallet,
  FileText,
  ReceiptText,
  Inbox,
  ChartLine,
  ShieldUser,
  Settings,
  History,
  UserCog,
  FileUp,
  Circle,
  type LucideIcon,
} from "lucide-react";

// BL-146 (يعالج اكتشاف BL-145): خط material-symbols غير مُحمَّل في المشروع
// إطلاقًا، فأيقونات القائمة الجانبية كانت تُعرَض نصًّا خامًا. هذه الخريطة تربط
// مفاتيح nav.ts (أسماء دلالية) بأيقونات lucide-react (SVG، نفس التبعية المستخدمة
// في Unauthorized). أي مفتاح غير معروف يرتدّ إلى Circle (نفس سلوك fallback القديم "circle").
const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  people: Users,
  receipt: Receipt,
  search: Search,
  drafting_compass: DraftingCompass,
  fact_check: ClipboardCheck,
  factory: Factory,
  handyman: Wrench,
  gavel: Gavel,
  folder: Folder,
  payments: Wallet,
  request_quote: FileText,
  receipt_long: ReceiptText,
  group: Users,
  inbox: Inbox,
  analytics: ChartLine,
  admin: ShieldUser,
  settings: Settings,
  history: History,
  supervisor_account: UserCog,
  upload_file: FileUp,
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const navItems = getNavItems(session.user.role);

  const settings = await getSystemSettings().catch(() => null);

  const companyLogoUrl = settings?.companyLogoUrl ?? null;
  const companyName = settings?.companyName ?? t("app.name");

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {companyLogoUrl && (
              <Image
                src={companyLogoUrl}
                alt={companyName}
                width={32}
                height={32}
                className="rounded object-contain shrink-0"
              />
            )}
            <h1 className="text-lg font-bold truncate">{companyName}</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 truncate">
            {session.user.name} — {t(`roles.${session.user.role}`)}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = (item.icon && NAV_ICONS[item.icon]) || Circle;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-700">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full text-right px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-gray-800 transition-colors"
            >
              {t("auth.logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {companyLogoUrl && (
              <Image
                src={companyLogoUrl}
                alt={companyName}
                width={80}
                height={80}
                className="rounded object-contain shrink-0"
              />
            )}
            <span className="text-sm font-semibold text-gray-800 truncate">
              {companyName}
            </span>
          </div>
          <NotificationsBell />
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>

      <Toaster />
    </div>
  );
}
