"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { addPayment } from "../../../../lib/accounting/actions";

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PAID: "default",
  PARTIAL: "secondary",
  UNPAID: "destructive",
};

type AccountingRow = {
  quotationId: string;
  number: string;
  customerName: string;
  totalContract: number;
  totalPaid: number;
  remaining: number;
  status: PaymentStatus;
};

export function AccountingClient({
  initialRows,
  currentRole,
}: {
  initialRows: AccountingRow[];
  currentRole: string;
}) {
  const t = useTranslations();
  const [rows, setRows] = useState<AccountingRow[]>(initialRows);

  // R-03: only ADMIN/ACCOUNTING can record payments — PROJECTS/TECHNICAL_OFFICE
  // get read-only, scope-filtered visibility (enforced server-side too).
  const canWrite = currentRole === "ADMIN" || currentRole === "ACCOUNTING";
  const columnCount = canWrite ? 7 : 6;

  const [paymentTarget, setPaymentTarget] = useState<AccountingRow | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [methodInput, setMethodInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          totalContract: acc.totalContract + row.totalContract,
          totalPaid: acc.totalPaid + row.totalPaid,
          remaining: acc.remaining + row.remaining,
        }),
        { totalContract: 0, totalPaid: 0, remaining: 0 }
      ),
    [rows]
  );

  function openAddPayment(row: AccountingRow) {
    setPaymentTarget(row);
    setAmountInput("");
    setDateInput(new Date().toISOString().slice(0, 10));
    setMethodInput("");
    setNotesInput("");
    setError(null);
  }

  async function handleAddPayment() {
    if (!paymentTarget) return;
    setError(null);

    const amount = Number(amountInput);
    if (Number.isNaN(amount) || amount <= 0 || !dateInput || !methodInput.trim()) {
      setError(t("errors.invalidInput"));
      return;
    }

    setSubmitting(true);
    const response = await addPayment({
      quotationId: paymentTarget.quotationId,
      amount,
      paidAt: dateInput,
      method: methodInput,
      notes: notesInput || undefined,
    });
    setSubmitting(false);

    if ("error" in response) {
      setError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setRows((prev) =>
      prev.map((row) => {
        if (row.quotationId !== paymentTarget.quotationId) return row;
        const totalPaid = row.totalPaid + amount;
        const remaining = row.totalContract - totalPaid;
        return {
          ...row,
          totalPaid,
          remaining,
          status: remaining <= 0 ? "PAID" : "PARTIAL",
        };
      })
    );
    toast.success(t("accounting.paymentAdded"));
    setPaymentTarget(null);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("accounting.title")}</h1>
        {!canWrite && (
          <p className="text-sm text-muted-foreground mt-1">
            {currentRole === "PROJECTS"
              ? t("accounting.scopedNoticeProjects")
              : t("accounting.scopedNoticeTechnicalOffice")}
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("accounting.customer")}</TableHead>
              <TableHead>{t("accounting.number")}</TableHead>
              <TableHead>{t("accounting.total")}</TableHead>
              <TableHead>{t("accounting.paid")}</TableHead>
              <TableHead>{t("accounting.remaining")}</TableHead>
              <TableHead>{t("accounting.status")}</TableHead>
              {canWrite && <TableHead>{t("app.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.quotationId}>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.number}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{numberFormat.format(row.totalContract)}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{numberFormat.format(row.totalPaid)}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{numberFormat.format(row.remaining)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {t(`accounting.status_${row.status}`)}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openAddPayment(row)}
                      >
                        {t("accounting.addPayment")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  {t("accounting.totals")}
                </TableCell>
                <TableCell className="font-semibold">
                  <span dir="ltr">{numberFormat.format(totals.totalContract)}</span>
                </TableCell>
                <TableCell className="font-semibold">
                  <span dir="ltr">{numberFormat.format(totals.totalPaid)}</span>
                </TableCell>
                <TableCell className="font-semibold">
                  <span dir="ltr">{numberFormat.format(totals.remaining)}</span>
                </TableCell>
                <TableCell colSpan={canWrite ? 2 : 1} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <Dialog
        open={!!paymentTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPaymentTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("accounting.addPayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="amount">{t("accounting.amount")}</Label>
              <Input
                id="amount"
                dir="ltr"
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paidAt">{t("accounting.paidAt")}</Label>
              <Input
                id="paidAt"
                dir="ltr"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="method">{t("accounting.method")}</Label>
              <Input
                id="method"
                value={methodInput}
                onChange={(e) => setMethodInput(e.target.value)}
                placeholder={t("accounting.methodPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">{t("accounting.notes")}</Label>
              <Input
                id="notes"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
            <FieldError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentTarget(null)}
              >
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleAddPayment} disabled={submitting}>
                {submitting ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
