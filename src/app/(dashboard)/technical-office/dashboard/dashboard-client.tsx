"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TecDashboardData, TecDashboardRow, TecStage } from "@/lib/services/tec-dashboard";
import { getTecDashboardAction } from "./actions";

/** TO-08: أرقام بنمط المشروع (`ar-EG-u-nu-latn`). */
const NUM = new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("ar-EG-u-nu-latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** عتبة التأخير في الانتظار — يومًا. مكان واحد موثّق. */
const LATE_DAYS = 5;

const STAGES: TecStage[] = [
  "UNASSIGNED",
  "NOT_SUBMITTED",
  "PENDING_LEAD",
  "LEAD_RETURNED",
  "LEAD_APPROVED",
  "FINAL_APPROVED",
];

const STAGE_COLOR: Record<TecStage, string> = {
  UNASSIGNED: "bg-slate-400",
  NOT_SUBMITTED: "bg-slate-300",
  PENDING_LEAD: "bg-amber-500",
  LEAD_RETURNED: "bg-red-500",
  LEAD_APPROVED: "bg-blue-500",
  FINAL_APPROVED: "bg-emerald-600",
};

const STAGE_PILL: Record<TecStage, string> = {
  UNASSIGNED: "bg-slate-100 text-slate-700",
  NOT_SUBMITTED: "bg-slate-100 text-slate-600",
  PENDING_LEAD: "bg-amber-100 text-amber-800",
  LEAD_RETURNED: "bg-red-100 text-red-800",
  LEAD_APPROVED: "bg-blue-100 text-blue-800",
  FINAL_APPROVED: "bg-emerald-100 text-emerald-800",
};

type Drill = { title: string; subtitle: string; rows: TecDashboardRow[] } | null;

export function TecDashboardClient({
  initialData,
  currentRole,
}: {
  initialData: TecDashboardData;
  currentRole: string;
}) {
  const t = useTranslations();
  const [data, setData] = useState(initialData);
  const [route, setRoute] = useState<string>("");
  const [days, setDays] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<Drill>(null);

  const rows = data.rows;
  const money = data.canSeeMoney;

  async function applyFilters(nextRoute: string, nextDays: string) {
    setLoading(true);
    const result = await getTecDashboardAction({
      route: nextRoute || undefined,
      days: Number(nextDays) || undefined,
    });
    setLoading(false);
    if ("error" in result) return;
    setData(result);
  }

  // ── التجميعات: كلها على نفس الصفوف في الذاكرة — صفر استعلام إضافي ──
  const agg = useMemo(() => {
    const unassigned = rows.filter((r) => r.stage === "UNASSIGNED");
    const pending = rows.filter((r) => r.stage === "PENDING_LEAD");
    const returned = rows.filter((r) => r.stage === "LEAD_RETURNED");
    const late = pending.filter((r) => (r.waitingDays ?? 0) > LATE_DAYS);
    const decided = rows.filter((r) => r.decisionDays !== null);
    const avgDecision = decided.length
      ? decided.reduce((s, r) => s + (r.decisionDays ?? 0), 0) / decided.length
      : null;
    const valued = rows.filter((r) => r.value !== null && r.value > 0);
    const totalValue = valued.reduce((s, r) => s + (r.value ?? 0), 0);
    const withMargin = rows.filter((r) => r.marginPct !== null);
    const avgMargin = withMargin.length
      ? withMargin.reduce((s, r) => s + (r.marginPct ?? 0), 0) / withMargin.length
      : null;
    return { unassigned, pending, returned, late, decided, avgDecision, valued, totalValue, withMargin, avgMargin };
  }, [rows]);

  const byEngineer = useMemo(() => {
    const map = new Map<string, { name: string; rows: TecDashboardRow[]; avg: number }>();
    for (const r of rows) {
      if (!r.engineerId || r.decisionDays === null) continue;
      const e = map.get(r.engineerId) ?? { name: r.engineerName ?? "—", rows: [], avg: 0 };
      e.rows.push(r);
      map.set(r.engineerId, e);
    }
    for (const e of map.values()) {
      e.avg = e.rows.reduce((s, r) => s + (r.decisionDays ?? 0), 0) / e.rows.length;
    }
    return [...map.values()].sort((a, b) => b.avg - a.avg);
  }, [rows]);

  const byRoute = useMemo(
    () =>
      (["PROJECTS", "SOCIAL_MEDIA"] as const).map((code) => ({
        code,
        rows: rows.filter((r) => r.route === code),
      })),
    [rows]
  );

  const byDrawing = useMemo(
    () =>
      (["approved", "draft", "none"] as const).map((k) => ({
        key: k,
        rows: rows.filter((r) => r.drawing === k),
      })),
    [rows]
  );

  const maxStage = Math.max(1, ...STAGES.map((s) => rows.filter((r) => r.stage === s).length));

  function open(title: string, subtitle: string, list: TecDashboardRow[]) {
    setDrill({ title, subtitle, rows: list });
  }

  /** 🔴 المبدأ الحاكم: كل رقم مضغوط ويقود لصفوفه. الكرت المقفول وحده غير مضغوط. */
  const KPIS = [
    {
      key: "un",
      label: t("tecDashboard.kpiUnassigned"),
      value: agg.unassigned.length,
      color: "border-s-slate-400",
      sub: agg.unassigned.length
        ? t("tecDashboard.needsAssignment")
        : t("tecDashboard.allAssigned"),
      good: agg.unassigned.length === 0,
      onClick: () => open(t("tecDashboard.kpiUnassigned"), t("tecDashboard.needsAssignment"), agg.unassigned),
    },
    {
      key: "pl",
      label: t("tecDashboard.kpiPendingLead"),
      value: agg.pending.length,
      color: "border-s-amber-500",
      sub: agg.late.length
        ? t("tecDashboard.lateCount", { count: NUM.format(agg.late.length), days: LATE_DAYS })
        : t("tecDashboard.allOnTime"),
      good: agg.late.length === 0,
      onClick: () =>
        open(
          t("tecDashboard.kpiPendingLead"),
          t("tecDashboard.sortedByLongestWait"),
          [...agg.pending].sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0))
        ),
    },
    {
      key: "rt",
      label: t("tecDashboard.kpiReturned"),
      value: agg.returned.length,
      color: "border-s-red-500",
      sub: agg.returned.length ? t("tecDashboard.needsFix") : t("tecDashboard.noReturned"),
      good: agg.returned.length === 0,
      onClick: () => open(t("tecDashboard.kpiReturned"), t("tecDashboard.withReturnReason"), agg.returned),
    },
    {
      key: "avg",
      label: t("tecDashboard.kpiAvgDecision"),
      value: agg.avgDecision === null ? "—" : NUM2.format(agg.avgDecision),
      color: "border-s-blue-500",
      sub: t("tecDashboard.daysFromSubmit"),
      good: true,
      onClick: () =>
        open(
          t("tecDashboard.kpiAvgDecision"),
          t("tecDashboard.daysFromSubmit"),
          [...agg.decided].sort((a, b) => (b.decisionDays ?? 0) - (a.decisionDays ?? 0))
        ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("tecDashboard.title")}</h1>
        <span className="text-xs text-muted-foreground">{t(`roles.${currentRole}`)}</span>
        <div className="flex-1" />

        <Select
          value={route}
          onValueChange={(v) => {
            const next = v ?? "";
            setRoute(next);
            void applyFilters(next, days);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {route === "PROJECTS"
                ? t("quotationRequest.route_PROJECTS")
                : route === "SOCIAL_MEDIA"
                  ? t("quotationRequest.route_SOCIAL_MEDIA")
                  : t("tecDashboard.allRoutes")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("tecDashboard.allRoutes")}</SelectItem>
            <SelectItem value="PROJECTS">{t("quotationRequest.route_PROJECTS")}</SelectItem>
            <SelectItem value="SOCIAL_MEDIA">{t("quotationRequest.route_SOCIAL_MEDIA")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={days}
          onValueChange={(v) => {
            const next = v ?? "0";
            setDays(next);
            void applyFilters(route, next);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue>
              {days === "30"
                ? t("tecDashboard.last30")
                : days === "90"
                  ? t("tecDashboard.last90")
                  : t("tecDashboard.allTime")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">{t("tecDashboard.last30")}</SelectItem>
            <SelectItem value="90">{t("tecDashboard.last90")}</SelectItem>
            <SelectItem value="0">{t("tecDashboard.allTime")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="rounded-md border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        💡 {t("tecDashboard.hint")}
      </p>

      {/* ── الكروت ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={k.onClick}
            className={cn(
              "rounded-xl border border-s-4 bg-card p-4 text-start transition hover:shadow-md",
              k.color
            )}
          >
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-3xl font-bold" dir="ltr">
              {typeof k.value === "number" ? NUM.format(k.value) : k.value}
            </div>
            {/* الصفر الإيجابي يُقال بلغة إيجابية لا كرقم أحمر. */}
            <div className={cn("mt-1 text-xs", k.good ? "text-emerald-600" : "text-red-600")}>
              {k.sub}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{t("tecDashboard.details")} ›</div>
          </button>
        ))}

        {/* 🔒 الكرتان الماليان: يظهران للجميع **مقفولين** لا محذوفين — الغياب
            الصامت يوهم بعدم وجود المؤشر أصلًا. والقيم مقصوصة server-side. */}
        {[
          {
            key: "val",
            label: t("tecDashboard.kpiValue"),
            value: money ? NUM.format(agg.totalValue) : "🔒",
            sub: money
              ? t("tecDashboard.quotationsCount", { count: NUM.format(agg.valued.length) })
              : t("tecDashboard.byPermission"),
            onClick: () =>
              open(
                t("tecDashboard.kpiValue"),
                t("tecDashboard.sortedByValue"),
                [...agg.valued].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
              ),
          },
          {
            key: "mg",
            label: t("tecDashboard.kpiMargin"),
            value: money ? (agg.avgMargin === null ? "—" : `${NUM2.format(agg.avgMargin)}٪`) : "🔒",
            sub: money ? t("tecDashboard.fromSavedCost") : t("tecDashboard.byPermission"),
            onClick: () =>
              open(
                t("tecDashboard.kpiMargin"),
                t("tecDashboard.sortedByMargin"),
                [...agg.withMargin].sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))
              ),
          },
        ].map((k) => (
          <button
            key={k.key}
            type="button"
            disabled={!money}
            onClick={money ? k.onClick : undefined}
            className={cn(
              "rounded-xl border border-s-4 border-s-violet-500 bg-card p-4 text-start transition",
              money ? "hover:shadow-md" : "cursor-not-allowed bg-muted/40"
            )}
          >
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div
              className={cn("mt-1 font-bold", money ? "text-3xl" : "text-xl text-muted-foreground")}
              dir={money ? "ltr" : undefined}
            >
              {k.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* ── قمع المراحل + المسار ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">{t("tecDashboard.funnel")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("tecDashboard.funnelHint")}</p>
          <div className="space-y-2">
            {STAGES.map((s) => {
              const list = rows.filter((r) => r.stage === s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => open(t(`tecDashboard.stage_${s}`), t("tecDashboard.funnelHint"), list)}
                  className="flex w-full items-center gap-3 rounded-md p-1 text-start hover:bg-muted/60"
                >
                  <span className="w-32 shrink-0 text-xs font-semibold">
                    {t(`tecDashboard.stage_${s}`)}
                  </span>
                  <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                    <span
                      className={cn("block h-full rounded", STAGE_COLOR[s])}
                      style={{ width: `${(list.length / maxStage) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-end text-sm font-bold" dir="ltr">
                    {NUM.format(list.length)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">{t("tecDashboard.byRoute")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("tecDashboard.byRouteHint")}</p>
          <div className="space-y-2">
            {byRoute.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() =>
                  open(t(`quotationRequest.route_${r.code}`), t("tecDashboard.byRouteHint"), r.rows)
                }
                className="flex w-full items-center gap-3 rounded-md p-1 text-start hover:bg-muted/60"
              >
                <span className="w-32 shrink-0 text-xs font-semibold">
                  {t(`quotationRequest.route_${r.code}`)}
                </span>
                <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded",
                      r.code === "PROJECTS" ? "bg-blue-500" : "bg-amber-500"
                    )}
                    style={{ width: `${rows.length ? (r.rows.length / rows.length) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-8 text-end text-sm font-bold" dir="ltr">
                  {NUM.format(r.rows.length)}
                </span>
              </button>
            ))}
          </div>

          <h2 className="mt-5 text-sm font-bold">{t("tecDashboard.drawings")}</h2>
          <div className="mt-2 space-y-2">
            {byDrawing.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => open(t(`tecDashboard.drawing_${d.key}`), t("tecDashboard.drawings"), d.rows)}
                className="flex w-full items-center gap-3 rounded-md p-1 text-start hover:bg-muted/60"
              >
                <span className="w-32 shrink-0 text-xs font-semibold">
                  {t(`tecDashboard.drawing_${d.key}`)}
                </span>
                <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded",
                      d.key === "approved" ? "bg-emerald-600" : d.key === "draft" ? "bg-amber-500" : "bg-slate-300"
                    )}
                    style={{ width: `${rows.length ? (d.rows.length / rows.length) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-8 text-end text-sm font-bold" dir="ltr">
                  {NUM.format(d.rows.length)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── زمن القرار لكل مهندس ── */}
      {byEngineer.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold">{t("tecDashboard.byEngineer")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("tecDashboard.byEngineerHint")}</p>
          <div className="space-y-2">
            {byEngineer.map((e) => (
              <button
                key={e.name}
                type="button"
                onClick={() => open(e.name, t("tecDashboard.byEngineerHint"), e.rows)}
                className="flex w-full items-center gap-3 rounded-md p-1 text-start hover:bg-muted/60"
              >
                <span className="w-32 shrink-0 truncate text-xs font-semibold">{e.name}</span>
                <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded",
                      e.avg > 6 ? "bg-red-500" : e.avg > 4 ? "bg-amber-500" : "bg-emerald-600"
                    )}
                    style={{
                      width: `${Math.min(100, (e.avg / Math.max(1, byEngineer[0].avg)) * 100)}%`,
                    }}
                  />
                </span>
                <span className="w-16 text-end text-sm font-bold" dir="ltr">
                  {NUM2.format(e.avg)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── كل الملفات ── */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold">{t("tecDashboard.allFiles")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("tecDashboard.allFilesHint")}</p>
        {loading && <p className="text-xs text-muted-foreground">{t("app.loading")}</p>}
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="p-2 text-start">{t("quotationRequest.request")}</th>
                <th className="p-2 text-start">{t("quotations.title")}</th>
                <th className="p-2 text-start">{t("quotations.customer")}</th>
                <th className="p-2 text-start">{t("quotations.technicalEngineer")}</th>
                <th className="p-2 text-start">{t("quotationRequest.route")}</th>
                <th className="p-2 text-start">{t("quotations.status")}</th>
                <th className="p-2 text-end">{t("tecDashboard.waitingDays")}</th>
                {money && <th className="p-2 text-end">{t("quotations.total")}</th>}
                {money && <th className="p-2 text-end">{t("tecDashboard.margin")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={money ? 9 : 7} className="p-8 text-center text-muted-foreground">
                    {t("app.noResults")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.requestId}
                    className="cursor-pointer border-b hover:bg-muted/40"
                    onClick={() => open(r.code, t("tecDashboard.singleFile"), [r])}
                  >
                    <td className="p-2 font-semibold">{r.code}</td>
                    <td className="p-2" dir="ltr">{r.quotationNumber ?? "—"}</td>
                    <td className="p-2">{r.customerName}</td>
                    <td className="p-2">{r.engineerName ?? "—"}</td>
                    <td className="p-2">{t(`quotationRequest.route_${r.route}`)}</td>
                    <td className="p-2">
                      <span className={cn("rounded-full px-2 py-0.5", STAGE_PILL[r.stage])}>
                        {t(`tecDashboard.stage_${r.stage}`)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "p-2 text-end",
                        (r.waitingDays ?? 0) > LATE_DAYS && "font-bold text-red-600"
                      )}
                      dir="ltr"
                    >
                      {r.waitingDays === null ? "—" : NUM.format(r.waitingDays)}
                    </td>
                    {money && (
                      <td className="p-2 text-end" dir="ltr">
                        {r.value === null ? "—" : NUM.format(r.value)}
                      </td>
                    )}
                    {money && (
                      <td className="p-2 text-end" dir="ltr">
                        {r.marginPct === null ? "—" : `${NUM2.format(r.marginPct)}٪`}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── الدرل-داون ──
          🔴 تثبيت **فيزيائي** مقصود (`right-0` + `translateX(105%)`): النموذج
          كشف أن الإخفاء بالخصائص المنطقية ينعكس تحت `dir="rtl"` فتظهر اللوحة
          مفتوحة. هذا الاستثناء الوحيد عن قاعدة الخصائص المنطقية (TO-32)،
          وهو مبرَّر لأن المحور هنا محور الشاشة لا محور القراءة. */}
      {drill && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrill(null)}
          role="presentation"
        />
      )}
      <aside
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 flex w-[min(760px,94vw)] flex-col bg-background shadow-2xl transition-transform duration-300",
          drill ? "translate-x-0" : "translate-x-[105%] invisible"
        )}
      >
        <div className="flex items-center gap-3 border-b bg-slate-900 p-4 text-white">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{drill?.title ?? "—"}</h2>
            <p className="text-xs text-slate-300">{drill?.subtitle ?? ""}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto text-white hover:bg-white/20"
            onClick={() => setDrill(null)}
          >
            ✕
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {drill?.rows.length ? (
            drill.rows.map((r) => (
              // 🔴 كل صف رابط للكيان نفسه — الرقم يقود للصفوف، والصف يقود للملف.
              <Link
                key={r.requestId}
                href={`/technical-office/${r.requestId}`}
                className="block border-b p-3 hover:bg-muted/50"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{r.code}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STAGE_PILL[r.stage])}>
                    {t(`tecDashboard.stage_${r.stage}`)}
                  </span>
                  {(r.waitingDays ?? 0) > LATE_DAYS && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-800">
                      {t("tecDashboard.late")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("quotations.customer")}: <b>{r.customerName}</b>
                  </span>
                  <span>
                    {t("quotations.technicalEngineer")}: <b>{r.engineerName ?? "—"}</b>
                  </span>
                  <span>
                    {t("quotationRequest.route")}: <b>{t(`quotationRequest.route_${r.route}`)}</b>
                  </span>
                  {r.waitingDays !== null && (
                    <span>
                      {t("tecDashboard.waitingDays")}: <b dir="ltr">{NUM.format(r.waitingDays)}</b>
                    </span>
                  )}
                  {r.quotationNumber && (
                    <span>
                      {t("quotations.title")}: <b dir="ltr">{r.quotationNumber}</b>
                    </span>
                  )}
                  {money && r.value !== null && (
                    <span>
                      {t("quotations.total")}: <b dir="ltr">{NUM.format(r.value)}</b>
                    </span>
                  )}
                  {money && r.marginPct !== null && (
                    <span>
                      {t("tecDashboard.margin")}: <b dir="ltr">{NUM2.format(r.marginPct)}٪</b>
                    </span>
                  )}
                </div>
                {r.leadNote && (
                  <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
                    {t("quotations.leadGate.returnReason")}: {r.leadNote}
                  </p>
                )}
              </Link>
            ))
          ) : (
            <p className="p-12 text-center text-sm text-muted-foreground">
              {t("tecDashboard.emptyDrill")}
            </p>
          )}
        </div>

        <div className="border-t bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("tecDashboard.drillFooter", { count: NUM.format(drill?.rows.length ?? 0) })}
        </div>
      </aside>
    </div>
  );
}
