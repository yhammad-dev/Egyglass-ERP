export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/server-translations";
import { InstallationExtrasPanel } from "./extras-panel";

// دفعة ج — صفحة أمر التركيب: بنود + صور (+ بطاقة الفريق في Phase 4)
export default async function InstallationOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["INSTALLATIONS", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const order = await prisma.installationOrder.findUnique({
    where: { id },
    include: {
      teamLead: { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      photos: { orderBy: { createdAt: "desc" } },
      manufacturingOrder: {
        select: {
          id: true,
          quotation: {
            select: {
              number: true,
              customer: { select: { name: true, address: true, phone: true } },
              // دفعة ج — IMT-R02: مسؤولو المشروع من علاقات QuotationRequest القائمة
              quotationRequest: {
                select: {
                  engineer: { select: { name: true } },
                  salesOwner: { select: { name: true } },
                  inspectionOwner: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("installations.orderTitle")} — {order.manufacturingOrder.quotation.number}
        </h1>
        <p className="text-sm text-muted-foreground">
          {order.manufacturingOrder.quotation.customer.name} ·{" "}
          {t(`installations.status_${order.status}`)} ·{" "}
          {t("installations.teamLead")}: {order.teamLead?.name ?? t("installations.dash")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("quotations.print.address")}:{" "}
          {order.manufacturingOrder.quotation.customer.address ?? t("installations.dash")} ·{" "}
          {t("quotations.print.phone")}:{" "}
          {order.manufacturingOrder.quotation.customer.phone ?? t("installations.dash")}
        </p>
      </div>

      {/* ── بطاقة فريق المشروع (IMT-R02) ── */}
      {(() => {
        const qr = order.manufacturingOrder.quotation.quotationRequest;
        const team = [
          [t("roles.TECHNICAL_OFFICE"), qr?.engineer?.name],
          [t("roles.SALES_REP"), qr?.salesOwner?.name],
          [t("roles.INSPECTION_MANAGER"), qr?.inspectionOwner?.name],
        ].filter(([, name]) => name) as [string, string][];
        return (
          <section className="border rounded-md text-sm max-w-lg">
            <p className="bg-muted px-3 py-1.5 font-semibold border-b">
              {t("installations.teamCard")}
            </p>
            {team.length ? (
              <div className="divide-y">
                {team.map(([role, name]) => (
                  <p key={role} className="px-3 py-1.5">
                    <span className="text-muted-foreground">{role}:</span> {name}
                  </p>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-muted-foreground">
                {t("installations.noTeam")}
              </p>
            )}
          </section>
        );
      })()}

      <InstallationExtrasPanel
        installationOrderId={order.id}
        isTeamLead={roleCheck.role === "ADMIN" || order.teamLeadId === roleCheck.userId}
        initialItems={order.items.map((i) => ({
          id: i.id,
          type: i.type,
          description: i.description,
          quantity: i.quantity?.toNumber() ?? null,
          cost: i.cost?.toNumber() ?? null,
          createdByName: i.createdBy.name,
          createdAt: i.createdAt.toISOString(),
        }))}
        initialPhotos={order.photos.map((p) => ({
          id: p.id,
          url: p.url,
          caption: p.caption,
        }))}
      />
    </div>
  );
}
