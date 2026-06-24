"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FieldError } from "@/components/ui/field-error";
import type { InspectionRow, CustomerOption } from "@/lib/services/inspections";
import { createInspectionAction } from "./actions";

const columnHelper = createColumnHelper<InspectionRow>();

const LOCATIONS = ["INSIDE_CAIRO", "OUTSIDE_CAIRO"] as const;
const TYPES = ["PRICING", "EXECUTION"] as const;
const STATUSES = ["REQUESTED", "SCHEDULED", "DONE", "OVERDUE"] as const;

const formSchema = z.object({
  customerId: z.string().min(1, "errors.required"),
  location: z.string().min(1, "errors.required"),
  address: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  type: z.string().min(1, "errors.required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function InspectionsClient({
  initialInspections,
  customers,
  currentRole,
}: {
  initialInspections: InspectionRow[];
  customers: CustomerOption[];
  currentRole: string;
}) {
  const t = useTranslations();
  const [data, setData] = useState<InspectionRow[]>(initialInspections);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isViewer = currentRole === "VIEWER";
  const canCreate = currentRole === "ADMIN" || currentRole === "INSPECTION_MANAGER";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      location: "INSIDE_CAIRO",
      address: "",
      phone: "",
      type: "PRICING",
      notes: "",
    },
  });

  const locationValue = watch("location");
  const typeValue = watch("type");

  function openCreate() {
    reset({
      customerId: "",
      location: "INSIDE_CAIRO",
      address: "",
      phone: "",
      type: "PRICING",
      notes: "",
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  const fe = (err: { message?: string } | undefined) =>
    err?.message ? t(err.message) : undefined;

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await createInspectionAction(formData);
      if (!result.success) {
        const msg =
          typeof result.error === "string"
            ? t(result.error)
            : Object.values(result.error).flat().map((k) => t(k)).join("، ");
        toast.error(msg);
        return;
      }
      setData((prev) => [result.data, ...prev]);
      toast.success(t("inspections.created"));
      closeDialog();
    } finally {
      setSubmitting(false);
    }
  }

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !search ||
        row.customerName.toLowerCase().includes(search.toLowerCase()) ||
        row.phone.includes(search);

      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
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
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("location", {
        header: t("inspections.location"),
        cell: (info) => t(`inspections.${info.getValue() === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`),
      }),
      columnHelper.accessor("type", {
        header: t("inspections.type"),
        cell: (info) => t(`inspections.type_${info.getValue()}`),
      }),
      columnHelper.accessor("status", {
        header: t("inspections.status"),
        cell: (info) => t(`inspections.status_${info.getValue()}`),
      }),
      columnHelper.accessor("dueDate", {
        header: t("inspections.dueDate"),
        cell: (info) => (
          <span dir="ltr">
            {new Date(info.getValue()).toLocaleDateString("en-CA")}
          </span>
        ),
      }),
      columnHelper.accessor("assigneeName", {
        header: t("inspections.assignee"),
        cell: (info) => info.getValue() ?? "—",
      }),
      ...(canCreate
        ? [
            columnHelper.accessor("phone", {
              header: t("inspections.phone"),
              cell: (info) => <span dir="ltr">{info.getValue()}</span>,
            }),
          ]
        : []),
    ],
    [t, canCreate]
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
        {canCreate && (
          <Button onClick={openCreate}>{t("inspections.newInspection")}</Button>
        )}
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
              setStatusFilter(v);
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
              setLocationFilter(v);
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
              setTypeFilter(v);
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

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("inspections.newInspection")}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t("inspections.selectCustomer")}</Label>
              <Select
                onValueChange={(v) => setValue("customerId", v)}
                defaultValue=""
              >
                <SelectTrigger>
                  <SelectValue>
                    {customers.find((c) => c.id === watch("customerId"))?.name ?? t("inspections.selectCustomer")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fe(errors.customerId)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("inspections.location")}</Label>
                <Select
                  onValueChange={(v) => setValue("location", v)}
                  defaultValue="INSIDE_CAIRO"
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`inspections.${locationValue === "OUTSIDE_CAIRO" ? "outsideCairo" : "insideCairo"}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {t(`inspections.${loc === "INSIDE_CAIRO" ? "insideCairo" : "outsideCairo"}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.location)} />
              </div>
              <div className="space-y-1">
                <Label>{t("inspections.type")}</Label>
                <Select
                  onValueChange={(v) => setValue("type", v)}
                  defaultValue="PRICING"
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`inspections.type_${typeValue || "PRICING"}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`inspections.type_${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.type)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">{t("inspections.address")}</Label>
              <Input id="address" {...register("address")} />
              <FieldError message={fe(errors.address)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">{t("inspections.phone")}</Label>
              <Input id="phone" dir="ltr" {...register("phone")} />
              <FieldError message={fe(errors.phone)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">{t("inspections.notes")}</Label>
              <Textarea
                id="notes"
                placeholder={t("inspections.notesPlaceholder")}
                {...register("notes")}
              />
              <FieldError message={fe(errors.notes)} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t("app.cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? `${t("app.save")}...` : t("app.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
