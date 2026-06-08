import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNavItems } from "@/lib/nav";
import { signOutAction } from "@/lib/actions/auth";
import { t } from "@/lib/server-translations";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const navItems = getNavItems(session.user.role);

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">{t("app.name")}</h1>
          <p className="text-xs text-gray-400 mt-1 truncate">
            {session.user.name} — {t(`roles.${session.user.role}`)}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                {item.icon || "circle"}
              </span>
              <span>{t(item.labelKey)}</span>
            </Link>
          ))}
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

      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
