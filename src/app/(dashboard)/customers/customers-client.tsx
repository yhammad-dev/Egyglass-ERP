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
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CustomerRow, SalesRepOption } from "@/lib/services/customers";
import {
  createCustomerAction,
  updateCustomerAction,
} from "./actions";

const columnHelper = createColumnHelper<CustomerRow>();

const CUSTOMER_TYPES = ["INDIVIDUAL", "ENGINEER", "COMPANY"] as const;
const CUSTOMER_SOURCES = [
  "AD",
  "REFERRAL",
  "WHATSAPP",
  "EXHIBITION",
  "VISIT",
] as const;
const PIPELINE_STAGES = [
  "NEW",
  "PRICED",
  "FOLLOW_UP",
  "INSPECTION",
  "EXECUTION",
  "RE_INSPECTION_FOLLOWUP",
  "REJECTED",
] as const;

const formSchema = z.object({
  name: z.string().min(1, "errors.required"),
  phone: z.string().min(1, "errors.required"),
  altPhone: z.string().optional(),
  type: z.string().min(1, "errors.required"),
  source: z.string().min(1, "errors.required"),
  address: z.string().optional(),
  notes: z.string().optional(),
  isRepeat: z.boolean(),
  ownerId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function CustomersClient({
  initialCustomers,
  salesReps,
  currentRole,
}: {
  initialCustomers: CustomerRow[];
  salesReps: SalesRepOption[];
  currentRole: string;
}) {
  const t = useTranslations();
  const [data, setData] = useState<CustomerRow[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isViewer = currentRole === "VIEWER";
  const isAdminOrManager = currentRole === "ADMIN" || currentRole === "SALES_MANAGER";

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
      name: "",
      phone: "",
      altPhone: "",
      type: "INDIVIDUAL",
      source: "VISIT",
      address: "",
      notes: "",
      isRepeat: false,
      ownerId: undefined,
    },
  });

  const isRepeatValue = watch("isRepeat");
  const ownerIdValue = watch("ownerId");

  function openCreate() {
    setEditingCustomer(null);
    reset({
      name: "",
      phone: "",
      altPhone: "",
      type: "INDIVIDUAL",
      source: "VISIT",
      address: "",
      notes: "",
      isRepeat: false,
      ownerId: undefined,
    });
    setOpen(true);
  }

  function openEdit(customer: CustomerRow) {
    setEditingCustomer(customer);
    reset({
      name: customer.name,
      phone: customer.phone,
      altPhone: "",
      type: customer.type,
      source: customer.source,
      address: "",
      notes: "",
      isRepeat: false,
      ownerId: customer.ownerId ?? undefined,
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingCustomer(null);
  }

  const fe = (err: { message?: string } | undefined) =>
    err?.message ? t(err.message) : undefined;

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      if (editingCustomer) {
        const result = await updateCustomerAction({
          id: editingCustomer.id,
          ...formData,
        });
        if (!result.success) {
          const msg =
            typeof result.error === "string"
              ? t(result.error)
              : Object.values(result.error).flat().map((k) => t(k)).join("، ");
          toast.error(msg);
          return;
        }
        setData((prev) =>
          prev.map((c) => (c.id === editingCustomer.id ? result.data : c))
        );
        toast.success(t("customers.updated"));
      } else {
        const result = await createCustomerAction(formData);
        if (!result.success) {
          const msg =
            typeof result.error === "string"
              ? t(result.error)
              : Object.values(result.error).flat().map((k) => t(k)).join("، ");
          toast.error(msg);
          return;
        }
        setData((prev) => [result.data, ...prev]);
        toast.success(t("customers.created"));
      }
      closeDialog();
    } finally {
      setSubmitting(false);
    }
  }

  const globalFilter = useMemo(() => {
    return { search, typeFilter, sourceFilter, stageFilter, ownerFilter };
  }, [search, typeFilter, sourceFilter, stageFilter, ownerFilter]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.phone.includes(search);

      const matchesType =
        typeFilter === "all" || row.type === typeFilter;
      const matchesSource =
        sourceFilter === "all" || row.source === sourceFilter;
      const matchesStage =
        stageFilter === "all" || row.stage === stageFilter;
      const matchesOwner =
        ownerFilter === "all" || row.ownerId === ownerFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesSource &&
        matchesStage &&
        matchesOwner
      );
    });
  }, [data, globalFilter, search, typeFilter, sourceFilter, stageFilter, ownerFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("customers.name"),
        cell: (info) => (
          <Link
            href={`/customers/${info.row.original.id}`}
            className="text-primary hover:underline font-medium"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("phone", {
        header: t("customers.phone"),
        cell: (info) => <span dir="ltr">{info.getValue()}</span>,
      }),
      columnHelper.accessor("type", {
        header: t("customers.type"),
        cell: (info) => t(`customers.${info.getValue().toLowerCase()}`),
      }),
      columnHelper.accessor("source", {
        header: t("customers.source"),
        cell: (info) => t(`customers.source_${info.getValue()}`),
      }),
      columnHelper.accessor("stage", {
        header: t("customers.stage"),
        cell: (info) => t(`pipeline.${info.getValue()}`),
      }),
      columnHelper.accessor("ownerName", {
        header: t("customers.owner"),
        cell: (info) => info.getValue() ?? "—",
      }),
      ...(!isViewer
        ? [
            columnHelper.display({
              id: "actions",
              header: t("app.actions"),
              cell: (info) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(info.row.original)}
                >
                  {t("app.edit")}
                </Button>
              ),
            }),
          ]
        : []),
    ],
    [t, isViewer]
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
        <h1 className="text-2xl font-bold">{t("customers.title")}</h1>
        {!isViewer && (
          <Button onClick={openCreate}>{t("customers.newCustomer")}</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-64">
          <Input
            placeholder={t("customers.searchByNameOrPhone")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          />
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
              <SelectValue placeholder={t("customers.allTypes")}>
                {typeFilter !== "all" ? t(`customers.${typeFilter.toLowerCase()}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("customers.allTypes")}</SelectItem>
              {CUSTOMER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`customers.${type.toLowerCase()}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("customers.allSources")}>
                {sourceFilter !== "all" ? t(`customers.source_${sourceFilter}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("customers.allSources")}</SelectItem>
              {CUSTOMER_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {t(`customers.source_${source}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={stageFilter}
            onValueChange={(v) => {
              setStageFilter(v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("customers.allStages")}>
                {stageFilter !== "all" ? t(`pipeline.${stageFilter}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("customers.allStages")}</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {t(`pipeline.${stage}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={ownerFilter}
            onValueChange={(v) => {
              setOwnerFilter(v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("customers.allOwners")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("customers.allOwners")}</SelectItem>
              {salesReps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.name}
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
          {t("customers.pageInfo", {
            current: table.getState().pagination.pageIndex + 1,
            total: table.getPageCount(),
          })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("customers.prevPage")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("customers.nextPage")}
          </Button>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? t("customers.editCustomer") : t("customers.newCustomer")}
            </DialogTitle>
          </DialogHeader>
          <form
            key={editingCustomer?.id ?? "create"}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">{t("customers.name")}</Label>
              <Input id="name" {...register("name")} />
              <FieldError message={fe(errors.name)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="phone">{t("customers.phone")}</Label>
                <Input id="phone" dir="ltr" {...register("phone")} />
                <FieldError message={fe(errors.phone)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="altPhone">{t("customers.altPhone")}</Label>
                <Input id="altPhone" dir="ltr" {...register("altPhone")} />
                <FieldError message={fe(errors.altPhone)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("customers.type")}</Label>
                <Select
                  onValueChange={(v) => setValue("type", v)}
                  defaultValue="INDIVIDUAL"
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`customers.${(watch("type") || "INDIVIDUAL").toLowerCase()}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`customers.${type.toLowerCase()}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.type)} />
              </div>
              <div className="space-y-1">
                <Label>{t("customers.source")}</Label>
                <Select
                  onValueChange={(v) => setValue("source", v)}
                  defaultValue="VISIT"
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`customers.source_${watch("source") || "VISIT"}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {t(`customers.source_${source}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.source)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">{t("customers.address")}</Label>
              <Textarea id="address" {...register("address")} />
              <FieldError message={fe(errors.address)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">{t("customers.notes")}</Label>
              <Textarea id="notes" {...register("notes")} />
              <FieldError message={fe(errors.notes)} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isRepeat"
                checked={isRepeatValue}
                onCheckedChange={(v) => setValue("isRepeat", v === true)}
              />
              <Label htmlFor="isRepeat" className="cursor-pointer">
                {t("customers.isRepeat")}
              </Label>
            </div>

            {isAdminOrManager && (
              <div className="space-y-1">
                <Label>{t("customers.assignOwner")}</Label>
                <Select
                  value={ownerIdValue ?? "none"}
                  onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—">
                      {salesReps.find((r) => r.id === ownerIdValue)?.name ?? "—"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.ownerId)} />
              </div>
            )}

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
