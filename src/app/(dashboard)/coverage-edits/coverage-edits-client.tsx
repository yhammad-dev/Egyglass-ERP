"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CoverageEditRow } from "../../../../lib/coverage-edits/actions";

const columnHelper = createColumnHelper<CoverageEditRow>();

const ACTION_LABEL_KEYS: Record<string, string> = {
  CUSTOMER_UPDATED: "coverageEdits.actionCustomerUpdated",
  STAGE_CHANGED: "coverageEdits.actionStageChanged",
  INTERACTION_ADDED: "coverageEdits.actionInteractionAdded",
};

export function CoverageEditsClient({
  initialRows,
}: {
  initialRows: CoverageEditRow[];
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat("ar-EG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter(
      (row) =>
        row.editorName.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q)
    );
  }, [initialRows, search]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("editorName", {
        header: () => t("coverageEdits.editor"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("customerName", {
        header: () => t("coverageEdits.customer"),
        cell: (info) => (
          <Link
            href={`/customers/${info.row.original.customerId}`}
            className="text-primary hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("ownerName", {
        header: () => t("coverageEdits.owner"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("action", {
        header: () => t("coverageEdits.action"),
        cell: (info) => {
          const key = ACTION_LABEL_KEYS[info.getValue()];
          return key ? t(key) : info.getValue();
        },
      }),
      columnHelper.accessor("createdAt", {
        header: () => t("coverageEdits.date"),
        cell: (info) => dateFormat.format(new Date(info.getValue())),
      }),
    ],
    [t, dateFormat]
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
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("coverageEdits.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("coverageEdits.subtitle")}
        </p>
      </div>

      <div className="w-64">
        <Input
          placeholder={t("coverageEdits.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("coverageEdits.pageInfo", {
              current: table.getState().pagination.pageIndex + 1,
              total: table.getPageCount(),
            })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              {t("coverageEdits.prevPage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              {t("coverageEdits.nextPage")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
