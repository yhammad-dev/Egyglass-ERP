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
  "REVIEW", // PHASE 3 (D-09): محمد حسام يفتح الأمر ليطابق ويعتمد
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
            total: true,
            customer: { select: { name: true } },
            items: { select: { description: true, quantity: true, unitPrice: true } },
            quotationRequest: {
              select: {
                code: true,
                summary: true,
                technicalRoute: true,
                inspectionRequestId: true,
                drawings: {
                  select: {
                    id: true,
                    category: true,
                    originalName: true,
                    url: true,
                    revision: true,
                    status: true,
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

  const req = order.quotation.quotationRequest;
  const drawings = req?.drawings ?? [];

  // PHASE 3 (D-09): الأضلاع الثلاثة للمطابقة اليدوية + العناصر المؤكَّدة
  const { getConfirmedMatchItems } = await import("@/lib/services/mfg-review");
  const confirmedItems = await getConfirmedMatchItems(order.id);

  // ضلع المعاينات: المقاسات مخزّنة كـ ActivityLog (دَين تقني موثّق InspectionMeasurement)
  const measurementLogs = req?.inspectionRequestId
    ? await prisma.activityLog.findMany({
        where: {
          entity: "InspectionRequest",
          entityId: req.inspectionRequestId,
          action: "MEASUREMENTS_RECORDED",
        },
        orderBy: { createdAt: "asc" },
        select: { details: true, createdAt: true },
      })
    : [];

  const threeWay = {
    customerRequest: {
      code: req?.code ?? "—",
      summary: req?.summary ?? null,
      items: order.quotation.items.map((i) => ({
        description: i.description,
        quantity: i.quantity.toNumber(),
      })),
    },
    inspection: {
      hasInspection: !!req?.inspectionRequestId,
      measurements: measurementLogs.map((m) => {
        try {
          const d = JSON.parse(m.details ?? "{}");
          return { width: d.width ?? null, height: d.height ?? null, notes: d.notes ?? null };
        } catch {
          return { width: null, height: null, notes: m.details };
        }
      }),
      drawings: drawings
        .filter((d) => d.category === "DRAWINGS")
        .map((d) => ({ name: d.originalName, url: d.url })),
    },
    engineering: {
      drawings: drawings
        .filter((d) => d.status === "TEC_APPROVED")
        .map((d) => ({ name: d.originalName, url: d.url, revision: d.revision })),
    },
  };

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
        threeWay={threeWay}
        confirmedItems={confirmedItems}
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
