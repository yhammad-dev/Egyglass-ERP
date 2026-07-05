"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type ReviewQuotationRow = {
  id: string;
  number: string;
  customerName: string;
  total: number;
  createdByName: string;
  createdAt: string;
};

export function ReviewClient({
  initialQuotations,
}: {
  initialQuotations: ReviewQuotationRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [data] = useState<ReviewQuotationRow[]>(initialQuotations);

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("review.title")}</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("review.number")}</TableHead>
              <TableHead>{t("review.customer")}</TableHead>
              <TableHead>{t("review.total")}</TableHead>
              <TableHead>{t("review.createdBy")}</TableHead>
              <TableHead>{t("review.date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => router.push(`/review/${row.id}`)}
                >
                  <TableCell>
                    <span dir="ltr">{row.number}</span>
                  </TableCell>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell>
                    <span dir="ltr">{numberFormat.format(row.total)}</span>
                  </TableCell>
                  <TableCell>{row.createdByName}</TableCell>
                  <TableCell>
                    {dateFormat.format(new Date(row.createdAt))}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
