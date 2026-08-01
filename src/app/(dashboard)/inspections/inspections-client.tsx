"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { toast } from "sonner";
// C1-fix: المصدر الوحيد لتنسيق التواريخ — يمنع اختلاف اليوم بين الخادم والمتصفح
import { formatInstantDate, formatInstantDateTime } from "@/lib/format/dates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { INSPECTION_STATUS_COLORS } from "@/lib/status-colors";
import type { InspectionRow, UserOption } from "@/lib/services/inspections";
// SCR-INS-I (C2-fix): تصنيف الحالات — نفس المصدر الذي يقرؤه الحارس الخادمي
import { isTerminalInspectionStatus } from "@/lib/services/inspection-status";
import { scheduleInspectionAction } from "./actions";

const columnHelper = createColumnHelper<InspectionRow>();

const LOCATIONS = ["INSIDE_CAIRO", "OUTSIDE_CAIRO"] as const;
const TYPES = ["PRICING", "EXECUTION"] as const;
// SCR-INS-D (C2): `POSTPONED` تُضاف للفلتر — وإلا صارت صفوفها غير قابلة للفلترة
// (لا تُضاف لقائمة **الكتابة** في شاشة التفاصيل: لها إجراؤها الذي يفرض السبب).
const STATUSES = [
  "REQUESTED",
  "SCHEDULED",
  "POSTPONED",
  "DONE",
  // SCR-INS-I (C2-fix): وإلا صارت الملغاة غير قابلة للفلترة — تختفي من الشاشة عمليًا
  "CANCELLED",
  "OVERDUE",
] as const;

const scheduleFormSchema = z.object({
  scheduledAt: z.string().min(1, "errors.required"),
  assigneeId: z.string().min(1, "errors.required"),
});

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;

export function InspectionsClient({
  initialInspections,
  currentRole,
  assignableUsers,
}: {
  initialInspections: InspectionRow[];
  currentRole: string;
  assignableUsers: UserOption[];
}) {
  const t = useTranslations();
  const [data, setData] = useState<InspectionRow[]>(initialInspections);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleRow, setScheduleRow] = useState<InspectionRow | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  // BL-104 (قرار يوسف 2026-07-14): لا إنشاء من هنا — المدخل الوحيد شاشة العميل (D-31).
  // هذه الشاشة = عرض + جدولة. الجدولة/التعيين بيد INSPECTION_MANAGER وحده.
  const canSchedule = currentRole === "ADMIN" || currentRole === "INSPECTION_MANAGER";

  const {
    register: regSchedule,
    handleSubmit: handleScheduleSubmit,
    reset: resetSchedule,
    setValue: setScheduleValue,
    watch: watchSchedule,
    formState: { errors: scheduleErrors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { scheduledAt: "", assigneeId: "" },
  });

  const assigneeIdValue = watchSchedule("assigneeId");

  function openSchedule(row: InspectionRow) {
    resetSchedule({ scheduledAt: "", assigneeId: "" });
    setScheduleRow(row);
    setScheduleOpen(true);
  }

  async function onScheduleSubmit(formData: ScheduleFormData) {
    if (!scheduleRow) return;
    setScheduleSubmitting(true);
    try {
      const result = await scheduleInspectionAction({
        id: scheduleRow.id,
        ...formData,
      });
      if (!result.success) {
        const msg =
          typeof result.error === "string"
            ? t(result.error)
            : t("errors.updateFailed");
        toast.error(msg);
        return;
      }
      setData((prev) =>
        prev.map((r) => (r.id === result.data.id ? result.data : r))
      );
      toast.success(t("inspections.scheduled"));
      /**
       * D-IN-24: **تحذير لا حجب.** الجدولة نجحت بالفعل (الصفّ محدَّث أعلاه)،
       * والتعارض يُعرض بعدها كتنبيه منفصل — لأن المدير قد يعرف ما لا يعرفه النظام
       * (موقعان متجاوران · زيارتان قصيرتان). التعريف المُنفَّذ: **نفس اليوم**
       * بتوقيت القاهرة؛ النافذة الزمنية الدقيقة تحتاج مدة الزيارة وهي غير مخزَّنة.
       */
      const conflicts = result.data.scheduleConflicts ?? [];
      if (conflicts.length > 0) {
        toast.warning(
          t("inspections.scheduleConflict", {
            count: conflicts.length,
            customers: conflicts.map((c) => c.customerName).join(" · "),
          })
        );
      }
      setScheduleOpen(false);
    } finally {
      setScheduleSubmitting(false);
    }
  }

  const fe = (err: { message?: string } | undefined) =>
    err?.message ? t(err.message) : undefined;

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !search ||
        row.customerName.toLowerCase().includes(search.toLowerCase()) ||
        row.phone.includes(search);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "OVERDUE"
            ? row.effectiveStatus === "OVERDUE"
            : row.status === statusFilter;
      const matchesLocation =
        locationFilter === "all" || row.location === locationFilter;
      const matchesType =
        typeFilter === "all" || row.type === typeFilter;

      return matchesSearch && matchesStatus && matchesLocation && matchesType;
    });
  }, [data, search, statusFilter, locationFilter, typeFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("customerName", {
        header: t("inspections.customer"),
        cell: (info) => (
          <Link href={`/inspections/${info.row.original.id}`} className="text-primary hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("location", {
        header: t("inspections.location"),
        cell: (info) => t(`inspections.${info.getValue() === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`),
      }),
      // IN-39: العنوان كان يُجلب في InspectionRow ولا يُعرض في القائمة إطلاقًا —
      // فالمندوب لا يعرف وجهته إلا بفتح كل صف على حدة. مقصوص لأن العناوين طويلة.
      columnHelper.accessor("address", {
        header: t("inspections.address"),
        cell: (info) => (
          <span className="block max-w-[18rem] truncate" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("type", {
        header: t("inspections.type"),
        cell: (info) => t(`inspections.type_${info.getValue()}`),
      }),
      columnHelper.accessor("status", {
        header: t("inspections.status"),
        cell: (info) => {
          const { effectiveStatus, status } = info.row.original;
          const key = effectiveStatus === "OVERDUE" ? "OVERDUE" : status;
          return (
            <Badge
              className={INSPECTION_STATUS_COLORS[key] ?? "bg-gray-100 text-gray-700 border-gray-200"}
            >
              {t(`inspections.status_${key}`)}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("dueDate", {
        header: t("inspections.dueDate"),
        // SCR-INS-B2: `null` = لم تُجدوَل. بلا هذا الفرع كان `new Date(null)` يطبع
        // **«1970-01-01»** — رقم يبدو بيانات وهو عطل.
        cell: (info) => {
          // ✅ D-IN-26(ج): `dueDate` انتقل إلى التوقيت القاهري كبقية النظام.
          // كان `formatBusinessDate` (UTC) — وهو ما صرّحتُ به استثناءً في D-IN-25،
          // لأن الصفوف القديمة (`23:59:59Z` · `22:21Z`) كان يومها UTC يخالف يومها
          // القاهري فتحويلها المبكر كان يعرضها **باليوم التالي**. بعد سكربت التصحيح
          // (28/28، تباين صفر بين التقويمين) سقط الاستثناء.
          const v = formatInstantDate(info.getValue());
          return v ? (
            <span dir="ltr">{v}</span>
          ) : (
            <span className="text-muted-foreground">
              {t("inspections.notScheduledYet")}
            </span>
          );
        },
      }),
      // SCR-INS-A: عمود نتيجة المطابقة — المدير يرى الأحكام دفعةً لا صفًّا صفًّا
      columnHelper.accessor("matchResult", {
        header: t("inspections.match.title"),
        cell: (info) => {
          const v = info.getValue();
          return v ? (
            <span>{t(`inspections.match.result_${v}`)}</span>
          ) : (
            <span className="text-muted-foreground">{t("inspections.dash")}</span>
          );
        },
      }),
      columnHelper.accessor("scheduledAt", {
        header: t("inspections.scheduledAt"),
        cell: (info) => {
          // 🔴 D-IN-24: `scheduledAt` **غادر صنف «يوم العمل»** إلى صنف «لحظة»
          // (صار يحمل وقتًا فعليًا) ⇒ يُعرض بتوقيت القاهرة لا UTC. إبقاؤه على
          // `formatBusinessDate` كان سيُظهر موعد 01:00 قاهرة على أنه اليوم السابق.
          const v = formatInstantDateTime(info.getValue());
          return v ? <span dir="ltr">{v}</span> : "—";
        },
      }),
      columnHelper.accessor("assigneeName", {
        header: t("inspections.assignee"),
        cell: (info) => info.getValue() ?? "—",
      }),
      ...(canSchedule
        ? [
            columnHelper.accessor("phone", {
              header: t("inspections.phone"),
              cell: (info) => <span dir="ltr">{info.getValue()}</span>,
            }),
            columnHelper.display({
              id: "actions",
              header: t("app.actions"),
              cell: (info) => {
                const row = info.row.original;
                // IN-07: الشرط كان `!== "REQUESTED"` فحبس صفوف OVERDUE القديمة.
                // IN-28: وصار يشمل `SCHEDULED` كذلك — **إعادة التعيين** هي شكوى
                // يوسف الأصلية، والحارس الخادمي جاهز من موجة A (يمنع DONE و
                // APPROVED ويسمح بالباقي) فالناقص كان الواجهة وحدها.
                // `DONE` مستبعد (معاينة منتهية) و`APPROVED` كذلك: الحارس يرفضه،
                // فإظهار الزر كان سيُنتج نداءً فاشلًا (نمط IN-13: الواجهة تعكس الحارس).
                // SCR-INS-I (C2-fix): `CANCELLED` تنضمّ لـ`DONE` — مرآة حارس
                // `scheduleInspection` الذي صار يرفض الحالتين. زر يظهر ثم يفشل هو
                // ما تمنعه STD-15، والأسوأ هنا أن نجاحه كان **يبعث معاينة ملغاة**.
                if (
                  isTerminalInspectionStatus(row.status) ||
                  row.approvalStatus === "APPROVED"
                )
                  return null;
                // تمييز بصري صريح بين أول إسناد وإعادة إسناد — ليسا الفعل نفسه
                const isReassign = row.assigneeId !== null;
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openSchedule(row)}
                  >
                    {isReassign
                      ? t("inspections.reassign")
                      : t("inspections.schedule")}
                  </Button>
                );
              },
            }),
          ]
        : []),
    ],
    [t, canSchedule]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("inspections.title")}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-64">
          <Input
            placeholder={t("inspections.searchByCustomer")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          />
        </div>

        <div className="w-40">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v ?? "all");
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("inspections.allStatuses")}>
                {statusFilter !== "all" ? t(`inspections.status_${statusFilter}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inspections.allStatuses")}</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`inspections.status_${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={locationFilter}
            onValueChange={(v) => {
              setLocationFilter(v ?? "all");
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("inspections.allLocations")}>
                {locationFilter !== "all"
                  ? t(`inspections.${locationFilter === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inspections.allLocations")}</SelectItem>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {t(`inspections.${loc === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v ?? "all");
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("inspections.allTypes")}>
                {typeFilter !== "all" ? t(`inspections.type_${typeFilter}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inspections.allTypes")}</SelectItem>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`inspections.type_${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-center">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-gray-500 py-8"
                >
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">
          {t("inspections.pageInfo", {
            current: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount(),
          })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("inspections.prevPage")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("inspections.nextPage")}
          </Button>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inspections.scheduleInspection")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleScheduleSubmit(onScheduleSubmit)}
            className="space-y-4"
          >
            {/* IN-48: تحذير مرئي غير حاجز — «غير جاهز» تُجدوَل بقرار المدير، لكنه
                يقرأ الحقيقة قبل أن يصرف وقود مندوب ووقته. */}
            {scheduleRow?.siteReadiness === "NOT_READY" && (
              <p className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                {t("inspections.siteNotReadyWarning")}
              </p>
            )}
            {/* 🔴 تصحيح مراجعة: الحوار كان يحذّر من الحالة **المسموحة** ويصمت عن
                الحالة **الحاجزة**. المدير يملأ الموعد والمندوب ثم يُرفض بـtoast.
                ✅ BL-160 (C2): اللافتة صارت **دقيقة**. كانت تظهر لكل `null` — بما
                فيها الصفوف التاريخية التي **لا تُحجَب فعلًا** — فتَعِد بحجب لا يقع
                وتقول «تم إخطار المبيعات» ولا إشعار (العرَض المسجَّل في تحديث B3).
                الآن `UNCONFIRMED` وحدها تُحجَب وتُعرض، و`null` (لم يُسأل) لها نصّها. */}
            {scheduleRow?.siteReadiness === "UNCONFIRMED" && (
              <p className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                {t("inspections.siteReadinessBlocksScheduling")}
              </p>
            )}
            {/* `null` = لم يُسأل أصلًا (صفّ تاريخي) — تنبيه غير حاجز، والجدولة تمرّ */}
            {scheduleRow?.siteReadiness === null && (
              <p className="rounded-md bg-muted border p-2 text-xs text-muted-foreground">
                {t("inspections.siteReadinessNeverAsked")}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="scheduledAt">{t("inspections.scheduledAt")}</Label>
              {/* 🔴 D-IN-24 (IN-29): كان `type="date"` بلا وقت — و«جدول المندوب
                  اليومي» الذي طلبه حسن غير قابل للتمثيل بتاريخ مجرَّد.
                  ⚠️ القيمة تصل الخادم **بلا منطقة زمنية** (`2026-08-06T22:00`)
                  وتُقرأ هناك كساعة **قاهرية** صراحةً (`parseCairoWallTime`) — لا
                  بـ`new Date()` الذي كان سيفسّرها UTC فيزيح الموعد ثلاث ساعات. */}
              <Input
                id="scheduledAt"
                type="datetime-local"
                dir="ltr"
                {...regSchedule("scheduledAt")}
              />
              <FieldError message={fe(scheduleErrors.scheduledAt)} />
            </div>
            <div className="space-y-1">
              <Label>{t("inspections.selectAssignee")}</Label>
              <Select
                onValueChange={(v) => setScheduleValue("assigneeId", v ?? "")}
                defaultValue=""
              >
                <SelectTrigger>
                  <SelectValue>
                    {assignableUsers.find((u) => u.id === assigneeIdValue)?.name ??
                      t("inspections.selectAssignee")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fe(scheduleErrors.assigneeId)} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleOpen(false)}
              >
                {t("app.cancel")}
              </Button>
              <Button type="submit" disabled={scheduleSubmitting}>
                {scheduleSubmitting ? `${t("app.save")}...` : t("app.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
