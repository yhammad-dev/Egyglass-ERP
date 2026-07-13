export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/server-translations";
import { EvidenceNotesForm } from "./evidence-notes-form";
import { VerdictForm } from "./verdict-form";

// SCR-017 PHASE 2 (D-25) — شاشة الأثر: الأضلاع الأربعة جنبًا إلى جنب.
// 🔴 النظام يعرض — البشر يحكمون. صفر استنتاج آلي للسبب، صفر اقتراح متسبب.
const MATCH_LABEL_KEYS: Record<string, string> = {
  CUSTOMER_REQUEST: "manufacturing.matchCustomerRequest",
  INSPECTION: "manufacturing.matchInspection",
  ENGINEERING: "manufacturing.matchEngineering",
};

export default async function InvestigationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["REVIEW", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const inv = await prisma.faultInvestigation.findUnique({
    where: { id },
    include: {
      openedBy: { select: { name: true } },
      verdictBy: { select: { name: true } },
      installationItem: {
        select: {
          type: true,
          description: true,
          quantity: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
      manufacturingOrder: {
        select: {
          id: true,
          status: true,
          quotation: {
            select: {
              number: true,
              customer: { select: { name: true } },
              quotationRequest: {
                select: {
                  code: true,
                  inspectionRequestId: true,
                  drawings: {
                    where: { status: "TEC_APPROVED" },
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      originalName: true,
                      url: true,
                      revision: true,
                      approvedAt: true,
                      approvedBy: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!inv) notFound();

  const req = inv.manufacturingOrder.quotation.quotationRequest;
  const approvedDrawings = req?.drawings ?? [];

  // الضلع 1 — مقاسات المعاينة (نص من ActivityLog — دَين BL-81 الموثّق)
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
  const measurements = measurementLogs.map((m) => {
    try {
      const d = JSON.parse(m.details ?? "{}");
      return {
        width: d.width ?? null,
        height: d.height ?? null,
        notes: d.notes ?? null,
        raw: null as string | null,
        at: m.createdAt,
      };
    } catch {
      return { width: null, height: null, notes: null, raw: m.details, at: m.createdAt };
    }
  });

  // الضلع 4 — تأكيدات REVIEW الثلاث: مَن أكّد أي عنصر ومتى (كل السجلات، الأحدث أولًا)
  const confirmLogs = await prisma.activityLog.findMany({
    where: {
      entity: "ManufacturingOrder",
      entityId: inv.manufacturingOrder.id,
      action: "MFG_MATCH_CONFIRMED",
    },
    orderBy: { createdAt: "desc" },
    select: { details: true, createdAt: true, user: { select: { name: true } } },
  });
  const confirmations = confirmLogs.map((c) => {
    let item: string | null = null;
    try {
      item = JSON.parse(c.details ?? "{}").item ?? null;
    } catch {
      /* سجل قديم بصيغة غير JSON */
    }
    return { item, by: c.user.name, at: c.createdAt };
  });

  const dateFmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dash = "—";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {t("investigations.detailTitle")} —{" "}
            <span dir="ltr">{inv.manufacturingOrder.quotation.number}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {inv.manufacturingOrder.quotation.customer.name}
            {req?.code ? (
              <>
                {" · "}
                <span dir="ltr">{req.code}</span>
              </>
            ) : null}
          </p>
        </div>
        <Link href="/investigations" className="text-sm underline">
          {t("investigations.backToList")}
        </Link>
      </div>

      {/* ── بطاقة الادعاء والحالة ── */}
      <section className="border rounded-md text-sm max-w-2xl">
        <p className="bg-muted px-3 py-1.5 font-semibold border-b">
          {t("investigations.claimCard")}
        </p>
        <div className="divide-y">
          <p className="px-3 py-1.5">
            <span className="text-muted-foreground">{t("investigations.claimedFault")}:</span>{" "}
            {t(`investigations.fault_${inv.claimedFault}`)}
            <span className="text-muted-foreground"> ({t(`installations.itype_${inv.installationItem.type}`)})</span>
          </p>
          <p className="px-3 py-1.5">
            <span className="text-muted-foreground">{t("investigations.description")}:</span>{" "}
            {inv.installationItem.description ?? dash}
          </p>
          <p className="px-3 py-1.5">
            <span className="text-muted-foreground">{t("investigations.reportedBy")}:</span>{" "}
            {inv.installationItem.createdBy.name} · {dateFmt.format(inv.installationItem.createdAt)}
          </p>
          <p className="px-3 py-1.5">
            <span className="text-muted-foreground">{t("investigations.status")}:</span>{" "}
            {t(`investigations.status_${inv.status}`)}
            {" · "}
            <span className="text-muted-foreground">{t("investigations.openedBy")}:</span>{" "}
            {inv.openedBy.name} · {dateFmt.format(inv.openedAt)}
          </p>
          {inv.status === "JUDGED" && (
            <>
              <p className="px-3 py-1.5">
                <span className="text-muted-foreground">{t("investigations.verdictFault")}:</span>{" "}
                {inv.verdictFault ? t(`investigations.fault_${inv.verdictFault}`) : dash}
                {inv.verdictBy ? (
                  <>
                    {" · "}
                    <span className="text-muted-foreground">{t("investigations.judgedBy")}:</span>{" "}
                    {inv.verdictBy.name}
                    {inv.verdictAt ? ` · ${dateFmt.format(inv.verdictAt)}` : ""}
                  </>
                ) : null}
              </p>
              <p className="px-3 py-1.5">
                <span className="text-muted-foreground">{t("investigations.verdictNotes")}:</span>{" "}
                {inv.verdictNotes ?? dash}
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── الأضلاع الأربعة جنبًا إلى جنب (D-25: عرض فقط) ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1. مقاسات المعاينة */}
        <section className="border rounded-md text-sm">
          <p className="bg-muted px-3 py-1.5 font-semibold border-b">
            {t("investigations.panelMeasurements")}
          </p>
          {measurements.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">
              {t("investigations.noMeasurements")}
            </p>
          ) : (
            <div className="divide-y">
              {measurements.map((m, i) => (
                <div key={i} className="px-3 py-1.5">
                  {m.raw ? (
                    <p>{m.raw}</p>
                  ) : (
                    <p>
                      {t("inspections.detail.width")}: <span dir="ltr">{m.width ?? dash}</span>
                      {" · "}
                      {t("inspections.detail.height")}: <span dir="ltr">{m.height ?? dash}</span>
                      {m.notes ? <> · {m.notes}</> : null}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{dateFmt.format(m.at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. رسمة المكتب الهندسي المعتمدة */}
        <section className="border rounded-md text-sm">
          <p className="bg-muted px-3 py-1.5 font-semibold border-b">
            {t("investigations.panelDrawing")}
          </p>
          {approvedDrawings.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">{t("investigations.noDrawing")}</p>
          ) : (
            <div className="divide-y">
              {approvedDrawings.map((d) => (
                <div key={d.id} className="px-3 py-1.5">
                  <a href={d.url} target="_blank" rel="noreferrer" className="underline break-all">
                    {d.originalName}
                  </a>
                  {d.revision ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {t("investigations.revision")} <span dir="ltr">{d.revision}</span>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. اعتماد TEC_APPROVER */}
        <section className="border rounded-md text-sm">
          <p className="bg-muted px-3 py-1.5 font-semibold border-b">
            {t("investigations.panelApproval")}
          </p>
          {approvedDrawings.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">{t("investigations.noApproval")}</p>
          ) : (
            <div className="divide-y">
              {approvedDrawings.map((d) => (
                <div key={d.id} className="px-3 py-1.5">
                  <p>{d.approvedBy?.name ?? dash}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.approvedAt ? dateFmt.format(d.approvedAt) : dash} ·{" "}
                    <span className="break-all">{d.originalName}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. تأكيدات REVIEW الثلاث */}
        <section className="border rounded-md text-sm">
          <p className="bg-muted px-3 py-1.5 font-semibold border-b">
            {t("investigations.panelConfirmations")}
          </p>
          {confirmations.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">
              {t("investigations.noConfirmations")}
            </p>
          ) : (
            <div className="divide-y">
              {confirmations.map((c, i) => (
                <div key={i} className="px-3 py-1.5">
                  <p>
                    {c.item && MATCH_LABEL_KEYS[c.item]
                      ? t(MATCH_LABEL_KEYS[c.item])
                      : c.item ?? dash}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.by} · {dateFmt.format(c.at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── ملاحظات الأثر (REVIEW تكتب — النظام لا يستنتج) · D-30: مقفلة بعد الحكم ── */}
      <EvidenceNotesForm
        investigationId={inv.id}
        initialNotes={inv.evidenceNotes ?? ""}
        locked={inv.status === "JUDGED"}
      />

      {/* ── الحُكم (D-25: ADMIN فقط — الحارس server-side) ── */}
      {inv.status === "OPEN" && <VerdictForm investigationId={inv.id} />}
    </div>
  );
}
