"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QuotationRow } from "@/lib/services/quotations";

const columnHelper = createColumnHelper<QuotationRow>();

const STATUS_BUCKET_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  NEW: "secondary",
  IN_PROGRESS: "default",
  ON_HOLD: "outline",
  COMPLETED: "default",
  EXPIRED: "destructive",
};

export function QuotationsClient({
  initialQuotations,
  currentRole,
}: {
  initialQuotations: QuotationRow[];
  currentRole: string;
}) {
  const t = useTranslations();
  const [data] = useState<QuotationRow[]>(initialQuotations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const isViewer = currentRole === "VIEWER";

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !search ||
        row.number.toLowerCase().includes(search.toLowerCase()) ||
        row.customerName.toLowerCase().includes(search.toLowerCase()) ||
        row.customerPhone.includes(search);

      const matchesStatus =
        statusFilter === "all" || row.statusBucket === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("number", {
        header: t("quotations.number"),
        cell: (info) => (
          <span className="font-medium" dir="ltr">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("customerName", {
        header: t("quotations.customer"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("customerPhone", {
        header: t("quotations.phone"),
        cell: (info) => <span dir="ltr">{info.getValue()}</span>,
      }),
      columnHelper.accessor("source", {
        header: t("quotations.source"),
        cell: (info) => t(`customers.source_${info.getValue()}`),
      }),
      columnHelper.accessor("statusBucket", {
        header: t("quotations.status"),
        cell: (info) => {
          const bucket = info.getValue();
          return (
            <Badge variant={STATUS_BUCKET_VARIANT[bucket] ?? "secondary"}>
              {t(`quotations.statusBucket_${bucket}`)}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("total", {
        header: t("quotations.total"),
        cell: (info) => (
          <span dir="ltr">
            {new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("technicalEngineer", {
        header: t("quotations.technicalEngineer"),
        cell: (info) => info.getValue() ?? t("quotations.dash"),
      }),
      columnHelper.accessor("salesResponsible", {
        header: t("quotations.salesResponsible"),
        cell: (info) => info.getValue() ?? t("quotations.dash"),
      }),
      columnHelper.accessor("inspectionsResponsible", {
        header: t("quotations.inspectionsResponsible"),
        cell: () => t("quotations.dash"),
      }),
      columnHelper.accessor("createdAt", {
        header: t("quotations.createdAt"),
        cell: (info) =>
          new Intl.DateTimeFormat("ar-EG", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(info.getValue())),
      }),
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

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("quotations.title")}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t("customers.searchByNameOrPhone")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm h-10"
        >
          <option value="all">{t("quotations.status")}</option>
          <option value="NEW">{t("quotations.statusBucket_NEW")}</option>
          <option value="IN_PROGRESS">{t("quotations.statusBucket_IN_PROGRESS")}</option>
          <option value="ON_HOLD">{t("quotations.statusBucket_ON_HOLD")}</option>
          <option value="COMPLETED">{t("quotations.statusBucket_COMPLETED")}</option>
          <option value="EXPIRED">{t("quotations.statusBucket_EXPIRED")}</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-center">
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-gray-500 py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredData.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {t("customers.pageInfo", {
              current: pagination.pageIndex + 1,
              total: totalPages,
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))
              }
              disabled={pagination.pageIndex === 0}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("customers.prevPage")}
            </button>
            <button
              type="button"
              onClick={() =>
                setPagination((p) => ({
                  ...p,
                  pageIndex: Math.min(totalPages - 1, p.pageIndex + 1),
                }))
              }
              disabled={pagination.pageIndex >= totalPages - 1}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("customers.nextPage")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
