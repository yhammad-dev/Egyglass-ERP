export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listExtraItems } from "@/lib/services/extra-items";
import { t } from "@/lib/server-translations";
import { ExtraItemsPanel } from "./extra-items-panel";
import { ReviewPanel } from "./review-panel";

// دفعة أ: صفحة أمر التصنيع — تُوسَّع في Phase 4 لتصبح الشاشة الموحدة (PRC-R01)
const ORDER_VIEW_ROLES = [
  "PROCUREMENT",
  "ADMIN",
  "TECHNICAL_OFFICE",
  "INSPECTION_MANAGER",
  "INSPECTION_REP",
];

export default async function ManufacturingOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(ORDER_VIEW_ROLES);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [order, items, factories] = await Promise.all([
    prisma.manufacturingOrder.findUnique({
      where: { id },
      include: {
        factory: { select: { name: true, code: true } },
        quotation: {
          select: {
            number: true,
            customer: { select: { name: true } },
            quotationRequest: {
              select: {
                code: true,
                drawings: {
                  select: {
                    id: true,
                    category: true,
                    originalName: true,
                    url: true,
                    revision: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
      },
    }),
    listExtraItems(id),
    prisma.factory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!order) notFound();

  const drawings = order.quotation.quotationRequest?.drawings ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("manufacturing.orderTitle")} — {order.quotation.number}
        </h1>
        <p className="text-sm text-muted-foreground">
          {order.quotation.customer.name} · {t(`manufacturing.status_${order.status}`)}
          {order.factory && (
            <>
              {" · "}
              {t("manufacturing.factory")}: {order.factory.name} ({order.factory.code})
            </>
          )}
        </p>
        {order.rejectionReason && (
          <p className="text-sm text-red-600 mt-1">
            {t("manufacturing.rejectionReason")}: {order.rejectionReason}
          </p>
        )}
      </div>

      {/* ── بوابة المراجعة + المصنع + التاريخ المتوقع (PRC-R02..R05) ── */}
      <ReviewPanel
        orderId={order.id}
        status={order.status}
        userRole={roleCheck.role}
        factories={factories}
        expectedAt={order.expectedAt?.toISOString() ?? null}
      />

      {/* ── رسومات الطلب (PRC-R01 — روابط عبر Drawing→QuotationRequest) ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("manufacturing.drawings")}</h2>
        {drawings.length ? (
          <ul className="rounded-md border divide-y">
            {drawings.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {t(`tec.cat_${d.category}`)}
                </span>
                <a href={d.url} target="_blank" className="underline">
                  {d.originalName}
                </a>
                {d.revision && <span dir="ltr">rev {d.revision}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("manufacturing.noDrawings")}
          </p>
        )}
      </div>

      <ExtraItemsPanel
        manufacturingOrderId={order.id}
        userRole={roleCheck.role}
        initialItems={items.map((i) => ({
          id: i.id,
          type: i.type,
          description: i.description,
          qty: i.qty?.toNumber() ?? null,
          unitCost: i.unitCost?.toNumber() ?? null,
          confirmedByInspection: i.confirmedByInspection,
          createdByName: i.createdBy.name,
        }))}
      />
    </div>
  );
}
