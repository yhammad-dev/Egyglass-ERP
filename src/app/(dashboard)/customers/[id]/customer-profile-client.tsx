"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StageChangeDialog } from "./stage-change-dialog";
import { AssignOwnerDialog } from "./assign-owner-dialog";
import { SetCoverageDialog } from "./set-coverage-dialog";
import { RequestInspectionDialog } from "./request-inspection-dialog";
import { RequestQuotationDialog } from "./request-quotation-dialog";
import { PostInstallTab } from "./_components/post-install-tab";
import type { CustomerProfileData, SalesRepOption } from "@/lib/services/customers";
import type { PostInstallReviewRow } from "@/lib/actions/post-install";

type TabId = "interactions" | "quotations" | "inspections" | "postInstall";

const BASE_TABS: { id: TabId; labelKey: string }[] = [
  { id: "interactions", labelKey: "customers.interactions" },
  { id: "quotations", labelKey: "quotations.title" },
  { id: "inspections", labelKey: "inspections.title" },
];

function DetailRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium" dir={dir}>{value}</span>
    </div>
  );
}

export function CustomerProfileClient({
  customer,
  currentRole,
  currentUserId,
  salesReps,
  postInstallReviews = [],
}: {
  customer: CustomerProfileData;
  currentRole: string;
  currentUserId: string;
  salesReps: SalesRepOption[];
  postInstallReviews?: PostInstallReviewRow[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const showPostInstall =
    customer.stage === "EXECUTION" || postInstallReviews.length > 0;

  const TABS = showPostInstall
    ? [
        ...BASE_TABS,
        { id: "postInstall" as TabId, labelKey: "customers.tabs.postInstall" },
      ]
    : BASE_TABS;

  const [activeTab, setActiveTab] = useState<TabId>("interactions");
  const [interactionType, setInteractionType] = useState<string | null>("NOTE");
  const [interactionNote, setInteractionNote] = useState("");
  const [interactionSubmitting, setInteractionSubmitting] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const isViewer = currentRole === "VIEWER";
  // دفعة هـ · Phase 4: المرحلة تُشتق من الأحداث آليًا — لا زر يدوي للتقدّم العادي.
  // يبقى الزر لـ ADMIN فقط كاستثناء override + قرار الرفض (REJECTED) البشري
  // الذي لا يُشتق من حدث. باقي الأدوار لم تعد تحرّك المرحلة يدويًا.
  const canChangeStage = currentRole === "ADMIN";
  const isAdminOrManager = currentRole === "ADMIN" || currentRole === "SALES_MANAGER";
  // D-31 (BL-91): طلب المعاينة من شاشة العميل = المبيعات (+ المدير للاستثناء)
  const canCreateInspection =
    currentRole === "ADMIN" ||
    currentRole === "INSPECTION_MANAGER" ||
    currentRole === "SALES_MANAGER" ||
    currentRole === "SALES_REP";
  const canCreateQuotation =
    currentRole === "ADMIN" ||
    currentRole === "SALES_MANAGER" ||
    currentRole === "SALES_REP";

  async function handleAddInteraction() {
    if (!interactionNote.trim()) return;
    setInteractionSubmitting(true);

    const { addInteraction } = await import("@/lib/actions/customers");

    const result = await addInteraction({
      customerId: customer.id,
      type: (interactionType ?? "NOTE") as "CALL" | "WHATSAPP" | "VISIT" | "NOTE",
      note: interactionNote.trim(),
    });

    setInteractionSubmitting(false);

    if ("error" in result) {
      alert(result.error);
      return;
    }

    setInteractionNote("");
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="outline" size="sm">{t("customers.backToList")}</Button>
          </Link>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          {customer.coveredById && (
            <Badge variant="secondary">{t("customers.coverageBadge")}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrManager && (
            <>
              <AssignOwnerDialog
                customerId={customer.id}
                currentOwnerId={customer.ownerId}
                currentOwnerName={customer.ownerName}
                salesReps={salesReps}
                onAssigned={refresh}
              />
              <SetCoverageDialog
                customerId={customer.id}
                currentCoveredById={customer.coveredById}
                currentCoveredByName={customer.coveredByName}
                salesReps={salesReps}
                onCoverageUpdated={refresh}
              />
            </>
          )}
          {canChangeStage && (
            <StageChangeDialog
              customerId={customer.id}
              currentStage={customer.stage}
              onStageChanged={refresh}
            />
          )}
          {canCreateInspection && (
            <RequestInspectionDialog
              customerId={customer.id}
              customerPhone={customer.phone}
              customerAddress={customer.address}
              onCreated={refresh}
            />
          )}
          {canCreateQuotation && (
            <RequestQuotationDialog customerId={customer.id} onCreated={refresh} />
          )}
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
          <DetailRow label={t("customers.name")} value={customer.name} />
          <DetailRow label={t("customers.phone")} value={customer.phone} dir="ltr" />
          <DetailRow label={t("customers.altPhone")} value={customer.altPhone || "—"} dir="ltr" />
          <DetailRow label={t("customers.type")} value={t(`customers.${customer.type.toLowerCase()}`)} />
          <DetailRow label={t("customers.source")} value={t(`customers.source_${customer.source}`)} />
          <DetailRow label={t("customers.stage")} value={t(`pipeline.${customer.stage}`)} />
          {customer.stage === "REJECTED" && customer.rejectReason && (
            <DetailRow label={t("customers.rejectReason")} value={customer.rejectReason} />
          )}
          <DetailRow label={t("customers.owner")} value={customer.ownerName || "—"} />
          {customer.coveredById && customer.coveredByName && (
            <DetailRow label={t("customers.coveredBy")} value={customer.coveredByName} />
          )}
          <DetailRow label={t("customers.address")} value={customer.address || "—"} />
          {/* دفعة هـ: شارة مشتقّة — "عميل سابق" مؤهل للكاش باك (لا حقل إدخال) */}
          {customer.isRepeat && (
            <DetailRow
              label={t("customers.isRepeat")}
              value={t("customers.repeatBadge")}
            />
          )}
          <DetailRow
            label={t("customers.createdAt")}
            value={new Date(customer.createdAt).toLocaleDateString("ar-EG")}
          />
          <DetailRow
            label={t("customers.updatedAt")}
            value={new Date(customer.updatedAt).toLocaleDateString("ar-EG")}
          />
          {(customer.ownerName || customer.coveredByName) && (
            <DetailRow
              label={t("customers.lastModifiedBy")}
              value={customer.ownerName || customer.coveredByName || "—"}
            />
          )}
        </div>
        {customer.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500 mb-1">{t("customers.notes")}</p>
            <p className="text-sm">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border">
        <div className="border-b">
          <div className="flex" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t(tab.labelKey)}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Interactions Tab */}
          {activeTab === "interactions" && (
            <div>
              {/* Add Interaction Form */}
              {!isViewer && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="text-sm font-semibold mb-3">{t("customers.addInteraction")}</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>{t("customers.selectType")}</Label>
                      <Select value={interactionType ?? "NOTE"} onValueChange={setInteractionType}>
                        <SelectTrigger className="w-48">
                          <SelectValue>
                            {t(`customers.interaction_${interactionType ?? "NOTE"}`)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["CALL", "WHATSAPP", "VISIT", "NOTE"] as const).map((type) => (
                            <SelectItem key={type} value={type}>
                              {t(`customers.interaction_${type}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="interactionNote">{t("customers.interactionNote")}</Label>
                      <Textarea
                        id="interactionNote"
                        placeholder={t("customers.interactionNotePlaceholder")}
                        value={interactionNote}
                        onChange={(e) => setInteractionNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAddInteraction}
                        disabled={interactionSubmitting || !interactionNote.trim()}
                      >
                        {interactionSubmitting ? t("app.loading") : t("customers.addInteraction")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {customer.interactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t("customers.noInteractions")}</p>
              ) : (
                <div className="space-y-4">
                  {customer.interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="flex items-start gap-3 pb-4 border-b last:border-0"
                    >
                      <span className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        interaction.type === "CALL" && "bg-blue-100 text-blue-700",
                        interaction.type === "WHATSAPP" && "bg-green-100 text-green-700",
                        interaction.type === "VISIT" && "bg-purple-100 text-purple-700",
                        interaction.type === "NOTE" && "bg-gray-100 text-gray-700",
                      )}>
                        {t(`customers.interaction_${interaction.type}`)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap">{interaction.note}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {interaction.userName && `${t("customers.by")} ${interaction.userName} — `}
                          {new Date(interaction.createdAt).toLocaleString("ar-EG")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quotations Tab (stub) */}
          {activeTab === "quotations" && (
            <div className="space-y-6">
              {/* دفعة هـ: طلبات التسعير — نقطة الدخول (المسار + الحالة + المهندس) */}
              <div>
                <p className="text-sm font-semibold mb-2">{t("quotationRequest.title")}</p>
                {customer.quotationRequests.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">{t("quotationRequest.none")}</p>
                ) : (
                  <div className="space-y-2">
                    {customer.quotationRequests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2 border rounded-md px-3">
                        <div>
                          <p className="text-sm font-medium" dir="ltr">
                            {r.code}{" "}
                            <span className="text-xs text-muted-foreground">
                              · {t(`quotationRequest.route_${r.technicalRoute}`)}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {t(`tec.status_${r.status}`)} ·{" "}
                            {r.engineerName ?? t("quotationRequest.unassigned")}
                            {r.quotationId ? " · ✅" : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {customer.quotations.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t("customers.noQuotations")}</p>
              ) : (
                <div className="space-y-3">
                  {customer.quotations.map((q) => (
                    <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{q.number}</p>
                        <p className="text-xs text-gray-500">{t(`quotations.statuses.${q.status}`)}</p>
                      </div>
                      <p className="text-sm font-medium" dir="ltr">{Number(q.total).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Post-Install Tab */}
          {activeTab === "postInstall" && (
            <PostInstallTab
              reviews={postInstallReviews}
              customerId={customer.id}
              currentRole={currentRole}
            />
          )}

          {/* Inspections Tab (stub) */}
          {activeTab === "inspections" && (
            <div>
              {customer.inspections.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t("customers.noInspections")}</p>
              ) : (
                <div className="space-y-3">
                  {customer.inspections.map((ins) => (
                    <div key={ins.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{ins.status}</p>
                        <p className="text-xs text-gray-500">{ins.location}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {ins.scheduledAt
                          ? new Date(ins.scheduledAt).toLocaleDateString("ar-EG")
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
