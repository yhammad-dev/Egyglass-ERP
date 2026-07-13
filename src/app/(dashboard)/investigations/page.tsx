export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/server-translations";
import { INVESTIGABLE_ITEM_TYPES } from "@/lib/services/fault-investigations";
import { OpenInvestigationButton } from "./open-investigation-button";

// SCR-017 PHASE 1 (BL-63) — بيت التحقيقات: REVIEW تفتح وتجمّع، ADMIN يحكم (D-25)
export default async function InvestigationsPage() {
  const roleCheck = await requireRole(["REVIEW", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [pendingItems, investigations] = await Promise.all([
    // بنود كسر/عيب قابلة للتحقيق (خريطة BL-79) لم يُفتح عليها تحقيق بعد
    prisma.installationItem.findMany({
      where: {
        type: { in: INVESTIGABLE_ITEM_TYPES as never[] },
        faultInvestigation: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        installationOrder: {
          select: {
            manufacturingOrder: {
              select: {
                id: true,
                quotation: {
                  select: { number: true, customer: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.faultInvestigation.findMany({
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        status: true,
        claimedFault: true,
        verdictFault: true,
        openedAt: true,
        openedBy: { select: { name: true } },
        installationItem: { select: { type: true, description: true } },
        manufacturingOrder: {
          select: {
            id: true,
            quotation: {
              select: { number: true, customer: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("investigations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("investigations.subtitle")}</p>
      </div>

      {/* ── بنود بلا تحقيق ── */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("investigations.pendingItems")}</h2>
        {pendingItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("investigations.noPendingItems")}</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-start">
                  <th className="px-3 py-2 text-start">{t("investigations.quotation")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.customer")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.itemType")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.description")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.reportedBy")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.reportedAt")}</th>
                  <th className="px-3 py-2 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2" dir="ltr">
                      {item.installationOrder.manufacturingOrder.quotation.number}
                    </td>
                    <td className="px-3 py-2">
                      {item.installationOrder.manufacturingOrder.quotation.customer.name}
                    </td>
                    <td className="px-3 py-2">{t(`installations.itype_${item.type}`)}</td>
                    <td className="px-3 py-2">{item.description ?? "—"}</td>
                    <td className="px-3 py-2">{item.createdBy.name}</td>
                    <td className="px-3 py-2">{dateFmt.format(item.createdAt)}</td>
                    <td className="px-3 py-2">
                      <OpenInvestigationButton installationItemId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── التحقيقات ── */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("investigations.listTitle")}</h2>
        {investigations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("investigations.noInvestigations")}</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-start">{t("investigations.quotation")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.customer")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.claimedFault")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.verdictFault")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.status")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.openedBy")}</th>
                  <th className="px-3 py-2 text-start">{t("investigations.openedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {investigations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2" dir="ltr">
                      {inv.manufacturingOrder.quotation.number}
                    </td>
                    <td className="px-3 py-2">
                      {inv.manufacturingOrder.quotation.customer.name}
                    </td>
                    <td className="px-3 py-2">{t(`investigations.fault_${inv.claimedFault}`)}</td>
                    <td className="px-3 py-2">
                      {inv.verdictFault ? t(`investigations.fault_${inv.verdictFault}`) : "—"}
                    </td>
                    <td className="px-3 py-2">{t(`investigations.status_${inv.status}`)}</td>
                    <td className="px-3 py-2">{inv.openedBy.name}</td>
                    <td className="px-3 py-2">{dateFmt.format(inv.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
