"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  entityId: string | null;
  entityType: string | null;
  isRead: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30_000;

/**
 * TO-37 — وجهة الإشعار مُشتقّة من `entityType` + `entityId` وحدهما.
 *
 * 🔴 **لا اشتقاق من نص الإشعار العربي ولا من `type`** — النص للقراءة البشرية
 * وقد يتغيّر بأي تعديل صياغة، فبناء تنقّل عليه يجعل الروابط تنكسر صامتة.
 *
 * الخريطة تقتصر على الكيانات التي **لها صفحة تفصيل فعلًا** (مُتحقَّق بوجود
 * `page.tsx` لكل مسار). الكيانات الباقية — `Drawing` · `Contract` · `Invoice` ·
 * `InstallationItem` — `entityId` فيها معرّف الكيان نفسه ولا توجد له صفحة
 * مستقلة، واشتقاق صفحة الأب يحتاج استعلامًا لا يملكه هذا المكوّن ⇒ **تبقى نصًّا
 * بلا رابط**. رابط يقود لمكان خاطئ أسوأ من غياب الرابط.
 */
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  Quotation: (id) => `/quotations/${id}`,
  QuotationRequest: (id) => `/technical-office/${id}`,
  InspectionRequest: (id) => `/inspections/${id}`,
  ManufacturingOrder: (id) => `/manufacturing/${id}`,
  InstallationOrder: (id) => `/installations/${id}`,
  FaultInvestigation: (id) => `/investigations/${id}`,
  Customer: (id) => `/customers/${id}`,
};

function notificationHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  return ENTITY_ROUTES[entityType]?.(entityId) ?? null;
}

export function NotificationsBell() {
  const t = useTranslations();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const unreadCount = notifications.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="icon" className="relative" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("notifications.title")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length ? (
          notifications.map((notification) => {
            const href = notificationHref(notification.entityType, notification.entityId);
            // SF-19: title مخزَّن كمفتاح ترجمة كامل (notifications.* / discount.* /
            // invoices.* / tec.*) — لازم t() الجذري ليُحلّ. كان يُعرض خامًا. body نص
            // عربي حرفي (لا مفتاح) فيبقى بلا t(). نقطة استهلاك واحدة تُصلح كل الإشعارات.
            const content = (
              <>
                <span className="text-sm font-medium">{t(notification.title)}</span>
                <span className="text-xs text-muted-foreground">{notification.body}</span>
              </>
            );

            // TO-37: الإشعار الذي له وجهة يصير رابطًا؛ وما لا وجهة له يبقى كما كان
            // بالضبط (يُعلَّم مقروءًا فقط) — لا رابط ميت ولا وعد بفتح لا يقع.
            // ⚠️ لا استثناء صلاحية هنا: إشعار لكيان خارج نطاق المستخدم يقود لصفحته
            // فيصدّه حارسها القائم برسالته المعتادة — وهو السلوك المقصود.
            return (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className="flex flex-col items-start gap-0.5 whitespace-normal"
                {...(href ? { render: <Link href={href} /> } : {})}
              >
                {content}
              </DropdownMenuItem>
            );
          })
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
