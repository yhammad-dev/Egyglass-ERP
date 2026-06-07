import { auth } from "@/lib/auth";
import { t } from "@/lib/server-translations";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("dashboard.title")}</h1>
      <p className="text-gray-500">
        مرحباً {session?.user?.name} — {t("dashboard.title")}
      </p>
    </div>
  );
}
