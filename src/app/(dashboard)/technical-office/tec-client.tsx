"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TecJobRow, EngineerOption } from "@/lib/services/tec";
import { TEC_STATUS_COLORS } from "@/lib/status-colors";
import { updateTecJobStatusAction, assignEngineerAction } from "./actions";

type TecJobStatus = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "DONE";
type TechnicalRoute = "PROJECTS" | "SOCIAL_MEDIA";

const STATUS_OPTIONS: TecJobStatus[] = ["NEW", "IN_PROGRESS", "ON_HOLD", "DONE"];

// TO-19: سقف العرض الافتراضي لقائمة "طلبات تحتاج إسنادًا"
const UNASSIGNED_PREVIEW_COUNT = 5;


const TABS: { id: TechnicalRoute; labelKey: string }[] = [
  { id: "PROJECTS", labelKey: "tec.projects" },
  { id: "SOCIAL_MEDIA", labelKey: "tec.socialMedia" },
];

export function TecClient({
  jobs: initialJobs,
  engineers,
  currentRole,
}: {
  jobs: TecJobRow[];
  engineers: EngineerOption[];
  currentRole: string;
}) {
  const t = useTranslations();
  const [jobs, setJobs] = useState<TecJobRow[]>(initialJobs);
  const [activeTab, setActiveTab] = useState<TechnicalRoute>("PROJECTS");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingStatus, setPendingStatus] = useState<Record<string, TecJobStatus>>({});
  const [pendingEngineer, setPendingEngineer] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  // TO-19: توسعة/طي قائمة غير المُسنَد — حالة محلية بحتة، بلا استعلام جديد
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);

  const isApprover = currentRole === "ADMIN" || currentRole === "TEC_APPROVER";
  const isTecOffice = currentRole === "TECHNICAL_OFFICE";

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (j.technicalRoute !== activeTab) return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !j.code.toLowerCase().includes(q) &&
          !j.customerName.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [jobs, activeTab, statusFilter, search]);

  async function handleStatusChange(job: TecJobRow) {
    const newStatus = pendingStatus[job.id];
    if (!newStatus || newStatus === job.status) return;
    setLoading((p) => ({ ...p, [job.id]: true }));
    const result = await updateTecJobStatusAction({ id: job.id, status: newStatus });
    setLoading((p) => ({ ...p, [job.id]: false }));
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
    );
    setPendingStatus((p) => { const n = { ...p }; delete n[job.id]; return n; });
    toast.success(t("app.saved"));
  }

  async function handleAssignEngineer(job: TecJobRow) {
    const engineerId = pendingEngineer[job.id];
    if (!engineerId) return;
    setLoading((p) => ({ ...p, [`eng-${job.id}`]: true }));
    const result = await assignEngineerAction({ id: job.id, engineerId });
    setLoading((p) => ({ ...p, [`eng-${job.id}`]: false }));
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    const engineer = engineers.find((e) => e.id === engineerId);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? { ...j, engineerId, engineerName: engineer?.name ?? null, status: "IN_PROGRESS" }
          : j
      )
    );
    setPendingEngineer((p) => { const n = { ...p }; delete n[job.id]; return n; });
    toast.success(t("app.saved"));
  }

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  /**
   * TO-19: أداة الإسناد الوحيدة في الشاشة — تُستدعى من مكانين (المربع الأصفر والجدول).
   * دالة عرض لا مكوّن: تعريف مكوّن داخل جسم TecClient يُنشئ نوعًا جديدًا في كل render
   * فيُعاد تركيب الـSelect ويفقد حالته. الاستدعاء المباشر يُدرج نفس الـJSX بلا هذا الأثر.
   * الصلاحية تبقى كما هي (isApprover) — الحارس النافذ هو assignEngineerAction نفسه.
   */
  function renderAssignControl(job: TecJobRow) {
    return (
      <div className="flex items-center gap-1">
        <Select
          value={pendingEngineer[job.id] ?? ""}
          onValueChange={(v) => setPendingEngineer((p) => ({ ...p, [job.id]: v }))}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder={t("tec.assignEngineer")} />
          </SelectTrigger>
          <SelectContent>
            {engineers.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={loading[`eng-${job.id}`] || !pendingEngineer[job.id]}
          onClick={() => handleAssignEngineer(job)}
        >
          {loading[`eng-${job.id}`] ? t("app.loading") : t("tec.assignEngineer")}
        </Button>
      </div>
    );
  }

  // دفعة هـ: الطلبات غير المُسنَدة (engineerId=null) — بارزة كي لا تتراكم بلا مالك
  // TO-19: الأقدم أولًا — الأطول انتظارًا في الأعلى (createdAt موجود في TecJobRow، بلا حقل جديد)
  const unassigned = useMemo(
    () =>
      jobs
        .filter((j) => !j.engineerId && j.status !== "DONE")
        .sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [jobs]
  );

  // TO-19: عرض أول 5 فقط افتراضيًا كي لا يزحم المربع الشاشة مع نمو العدد
  const visibleUnassigned = unassignedExpanded
    ? unassigned
    : unassigned.slice(0, UNASSIGNED_PREVIEW_COUNT);
  const hiddenUnassignedCount = unassigned.length - UNASSIGNED_PREVIEW_COUNT;

  // TO-09: العروض المرتجعة من المراجعة — بارزة فوق الجدول لأن الجدول مقسّم بتبويب
  // المسار (PROJECTS/SOCIAL_MEDIA) وقابل للفلترة، فطلب مرتجع في التبويب الآخر يُدفن.
  const returned = useMemo(
    () => jobs.filter((j) => j.reviewStatus === "RETURNED"),
    [jobs]
  );

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">{t("tec.title")}</h1>

      {/* دفعة هـ: قسم "طلبات تحتاج إسنادًا" بارز أعلى الشاشة */}
      {unassigned.length > 0 && (
        <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-amber-900">
              {t("tec.unassignedTitle")} ({unassigned.length})
            </p>
            {/* TO-19: عدّاد المخفي + توسعة/طي — بلا استعلام جديد */}
            {hiddenUnassignedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-amber-900 hover:bg-amber-100"
                onClick={() => setUnassignedExpanded((v) => !v)}
              >
                {unassignedExpanded
                  ? t("tec.unassignedShowLess")
                  : t("tec.unassignedShowMore", { count: hiddenUnassignedCount })}
              </Button>
            )}
          </div>
          <div
            className={cn(
              "space-y-1",
              // TO-19: سقف ارتفاع عند التوسعة فلا يتمدد المربع بلا حد
              unassignedExpanded && "max-h-72 overflow-y-auto pe-1"
            )}
          >
            {visibleUnassigned.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm py-1"
              >
                <span dir="ltr" className="min-w-0 truncate">
                  {j.code} · {j.customerName} ·{" "}
                  {t(j.technicalRoute === "PROJECTS" ? "tec.projects" : "tec.socialMedia")}
                </span>
                {/* TO-19: كان رابطًا باسم "إسناد" يقود لصفحة بلا أداة إسناد (طريق مسدود).
                    صار أداة الإسناد نفسها — نفس Select+زر الجدول عبر renderAssignControl.
                    غير المصرَّح له يرى رابط تفاصيل صادقًا، لا زرًا يوحي بفعل لا يملكه. */}
                {isApprover ? (
                  renderAssignControl(j)
                ) : (
                  <Link
                    href={`/technical-office/${j.id}`}
                    className="shrink-0 underline text-amber-800"
                  >
                    {t("tec.details")}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TO-09: قسم "عروض مرتجعة" — الوسم البصري كي لا يُدفن الطلب المرتجع.
          سقف ارتفاع بلا توسعة/طي: القائمة يفترض أن تفرغ بالتصحيح لا أن تتراكم. */}
      {returned.length > 0 && (
        <div className="rounded-md border-2 border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-2 font-semibold text-destructive">
            {t("tec.returnedTitle")} ({returned.length})
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
            {returned.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate">
                    <span dir="ltr">{j.code}</span> · {j.customerName} ·{" "}
                    {t(j.technicalRoute === "PROJECTS" ? "tec.projects" : "tec.socialMedia")}
                  </p>
                  {j.reviewNote?.trim() ? (
                    <p
                      className="line-clamp-2 text-xs text-muted-foreground"
                      title={j.reviewNote}
                    >
                      {t("tec.quotationReturnedReason")}: {j.reviewNote}
                    </p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      {t("tec.quotationReturnedNoReason")}
                    </p>
                  )}
                </div>
                <Link
                  href={`/technical-office/${j.id}`}
                  className="shrink-0 underline text-destructive"
                >
                  {t("tec.details")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder={t("tec.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {statusFilter === "all"
                ? t("tec.allStatuses")
                : t(`tec.status_${statusFilter}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tec.allStatuses")}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`tec.status_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tec.code")}</TableHead>
              <TableHead>{t("customers.name")}</TableHead>
              <TableHead>{t("quotations.number")}</TableHead>
              <TableHead>{t("tec.engineer")}</TableHead>
              <TableHead>{t("app.status")}</TableHead>
              <TableHead>{t("tec.drawings")}</TableHead>
              <TableHead>{t("app.updatedAt")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-10"
                >
                  {t("tec.noJobs")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-sm" dir="ltr">
                    {job.code}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[20rem] space-y-0.5">
                      <p>{job.customerName}</p>
                      {/* TO-12: مقتطف من وصف الطلب — سطران بحد أقصى كي لا يتمدد الصف */}
                      {job.summary?.trim() ? (
                        <p
                          className="text-xs text-muted-foreground line-clamp-2"
                          title={job.summary}
                        >
                          {job.summary}
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t("quotationRequest.noSummary")}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p dir="ltr">{job.quotationNumber}</p>
                      {/* TO-09: وسم الصف المرتجع — السبب في title كي لا يتمدد العمود */}
                      {job.reviewStatus === "RETURNED" && (
                        <Badge
                          variant="destructive"
                          className="text-xs"
                          title={job.reviewNote ?? undefined}
                        >
                          {t("review.status_RETURNED")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{job.engineerName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={TEC_STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}
                    >
                      {t(`tec.status_${job.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr">{job.drawingsCount}</TableCell>
                  <TableCell dir="ltr">
                    {dateFormat.format(new Date(job.updatedAt))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Change Status — TEC_OFFICE only */}
                      {(isTecOffice || isApprover) && (
                        <div className="flex items-center gap-1">
                          <Select
                            value={pendingStatus[job.id] ?? job.status}
                            onValueChange={(v) =>
                              setPendingStatus((p) => ({
                                ...p,
                                [job.id]: v as TecJobStatus,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue>
                                {t(
                                  `tec.status_${pendingStatus[job.id] ?? job.status}`
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {t(`tec.status_${s}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={
                              loading[job.id] ||
                              !pendingStatus[job.id] ||
                              pendingStatus[job.id] === job.status
                            }
                            onClick={() => handleStatusChange(job)}
                          >
                            {loading[job.id] ? t("app.loading") : t("app.save")}
                          </Button>
                        </div>
                      )}

                      {/* Assign Engineer — ADMIN / TEC_APPROVER only.
                          TO-19: نفس الأداة المستخدمة في مربع "طلبات تحتاج إسنادًا" — مصدر واحد. */}
                      {isApprover && renderAssignControl(job)}

                      <Link href={`/technical-office/${job.id}`}>
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
                          {t("tec.details")}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
