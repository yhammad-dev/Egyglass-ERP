"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import {
  savePaymentPlan,
  getContractBalances,
  type ContractBalances,
} from "../../../../lib/finance/actions";

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PAID: "default",
  PARTIAL: "secondary",
  UNPAID: "destructive",
};

type AccountingRow = {
  quotationId: string;
  number: string;
  customerId: string;
  customerName: string;
  totalContract: number;
  totalPaid: number;
  remaining: number;
  contractId: string | null;
  status: PaymentStatus;
};

type MilestoneRow = { label: string; percentage: string };

const DEFAULT_MILESTONE_ROWS: MilestoneRow[] = [
  { label: "", percentage: "" },
  { label: "", percentage: "" },
  { label: "", percentage: "" },
];
const MAX_MILESTONE_ROWS = 8;

/**
 * Display-only preview of the "last takes the remainder" allocation
 * (mirrors lib/finance/engine.ts's policy for a nicer live preview).
 * NOT authoritative — savePaymentPlan recomputes in Decimal server-side.
 */
function previewMilestoneAmounts(rows: MilestoneRow[], totalValue: number): number[] {
  const pcts = rows.map((r) => Number(r.percentage) || 0);
  if (pcts.length === 0) return [];
  const amounts: number[] = [];
  let allocated = 0;
  for (let i = 0; i < pcts.length - 1; i++) {
    const amt = Math.round(((pcts[i] * totalValue) / 100) * 100) / 100;
    amounts.push(amt);
    allocated += amt;
  }
  amounts.push(Math.round((totalValue - allocated) * 100) / 100);
  return amounts;
}

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
  // Balances are a READ, available to every role in getFinanceScope — so the
  // actions column must appear for read-only viewers too whenever at least
  // one of their (already server-scoped) rows has a contract to view.
  const showActionsColumn = canWrite || initialRows.some((r) => r.contractId !== null);
  const columnCount = showActionsColumn ? 7 : 6;

  const [paymentTarget, setPaymentTarget] = useState<AccountingRow | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [methodInput, setMethodInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment-plan editor + balances panel (per-contract milestones)
  const [planTarget, setPlanTarget] = useState<AccountingRow | null>(null);
  const [balances, setBalances] = useState<ContractBalances | null>(null);
  const [milestoneRows, setMilestoneRows] = useState<MilestoneRow[]>(DEFAULT_MILESTONE_ROWS);
  const [planLoading, setPlanLoading] = useState(false);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

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

  async function openPaymentPlan(row: AccountingRow) {
    if (!row.contractId) return;
    setPlanTarget(row);
    setPlanError(null);
    setBalances(null);
    setMilestoneRows(DEFAULT_MILESTONE_ROWS);
    setPlanLoading(true);

    const result = await getContractBalances(row.contractId);
    setPlanLoading(false);

    if ("error" in result) {
      setPlanError(t(result.error ?? "errors.invalidInput"));
      return;
    }

    setBalances(result);
    if (result.milestones.length > 0) {
      setMilestoneRows(
        result.milestones
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m) => ({ label: m.label, percentage: String(m.percentage) }))
      );
    }
  }

  function updateMilestoneRow(index: number, field: keyof MilestoneRow, value: string) {
    setMilestoneRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addMilestoneRow() {
    setMilestoneRows((prev) =>
      prev.length >= MAX_MILESTONE_ROWS ? prev : [...prev, { label: "", percentage: "" }]
    );
  }

  function removeMilestoneRow(index: number) {
    setMilestoneRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const milestonePercentSum = milestoneRows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
  const milestoneSumIsValid = Math.abs(milestonePercentSum - 100) < 0.005;
  const milestoneAmounts = balances ? previewMilestoneAmounts(milestoneRows, balances.totalValue) : [];

  async function handleSavePlan() {
    if (!planTarget?.contractId) return;
    setPlanError(null);

    if (milestoneRows.some((r) => !r.label.trim() || !r.percentage.trim())) {
      setPlanError(t("errors.invalidInput"));
      return;
    }

    setPlanSubmitting(true);
    const response = await savePaymentPlan({
      contractId: planTarget.contractId,
      milestones: milestoneRows.map((r) => ({ label: r.label.trim(), percentage: r.percentage })),
    });

    if ("error" in response) {
      setPlanSubmitting(false);
      setPlanError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    // Refresh so the planned-vs-paid table reflects the new plan immediately
    // (dialog stays open — the refreshed table IS the save confirmation).
    const refreshed = await getContractBalances(planTarget.contractId);
    setPlanSubmitting(false);
    if (!("error" in refreshed)) setBalances(refreshed);
    toast.success(t("accounting.planSaved"));
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
              {showActionsColumn && <TableHead>{t("app.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.quotationId}>
                  <TableCell>
                    {/* SCR-015: رابط شيت العميل (أعمدة راندا) */}
                    <Link
                      href={`/accounting/customer/${row.customerId}`}
                      className="underline underline-offset-2"
                    >
                      {row.customerName}
                    </Link>
                  </TableCell>
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
                  {showActionsColumn && (
                    <TableCell>
                      <div className="flex gap-2">
                        {canWrite && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openAddPayment(row)}
                          >
                            {t("accounting.addPayment")}
                          </Button>
                        )}
                        {row.contractId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPaymentPlan(row)}
                          >
                            {canWrite ? t("accounting.paymentPlan") : t("accounting.viewBalances")}
                          </Button>
                        )}
                      </div>
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
                <TableCell colSpan={showActionsColumn ? 2 : 1} />
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

      <Dialog
        open={!!planTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPlanTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{canWrite ? t("accounting.paymentPlan") : t("accounting.viewBalances")}</DialogTitle>
          </DialogHeader>

          {planLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("app.loading")}</p>
          ) : balances ? (
            <div className="space-y-4">
              {/* Live balances — getContractBalances, within scope */}
              <div className="grid grid-cols-2 gap-3 text-sm rounded-md border p-3">
                <div>
                  <p className="text-muted-foreground">{t("accounting.contractTotalValue")}</p>
                  <p dir="ltr" className="font-semibold">{numberFormat.format(balances.totalValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("accounting.paid")}</p>
                  <p dir="ltr" className="font-semibold">{numberFormat.format(balances.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("accounting.remaining")}</p>
                  <p dir="ltr" className="font-semibold">{numberFormat.format(balances.remaining)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("accounting.completionPct")}</p>
                  <p dir="ltr" className="font-semibold">{balances.completionPct.toFixed(2)}%</p>
                </div>
              </div>

              {/* Planned vs paid per milestone */}
              {balances.milestones.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("accounting.milestoneLabel")}</TableHead>
                        <TableHead>{t("accounting.plannedAmount")}</TableHead>
                        <TableHead>{t("accounting.paid")}</TableHead>
                        <TableHead>{t("accounting.remaining")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.milestones.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.label}</TableCell>
                          <TableCell dir="ltr">{numberFormat.format(m.plannedAmount)}</TableCell>
                          <TableCell dir="ltr">{numberFormat.format(m.paidAmount)}</TableCell>
                          <TableCell dir="ltr">{numberFormat.format(m.remainingAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                !canWrite && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("accounting.noPlanYet")}
                  </p>
                )
              )}

              {balances.unlinkedPaid > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("accounting.unlinkedPaid")}:{" "}
                  <span dir="ltr">{numberFormat.format(balances.unlinkedPaid)}</span>
                </p>
              )}

              {/* Plan editor — write roles only (requireRole enforced server-side too) */}
              {canWrite && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">{t("accounting.editPlan")}</h3>

                  <div className="space-y-2">
                    {milestoneRows.map((row, i) => (
                      <div key={i} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label>{t("accounting.milestoneLabel")}</Label>
                          <Input
                            value={row.label}
                            onChange={(e) => updateMilestoneRow(i, "label", e.target.value)}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label>{t("accounting.milestonePercentage")}</Label>
                          <Input
                            dir="ltr"
                            type="number"
                            step="0.01"
                            value={row.percentage}
                            onChange={(e) => updateMilestoneRow(i, "percentage", e.target.value)}
                          />
                        </div>
                        <div className="w-32 space-y-1">
                          <Label>{t("accounting.milestoneAmount")}</Label>
                          <p dir="ltr" className="text-sm py-2 text-muted-foreground">
                            {numberFormat.format(milestoneAmounts[i] ?? 0)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={milestoneRows.length <= 1}
                          onClick={() => removeMilestoneRow(i)}
                        >
                          {t("accounting.removeMilestone")}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={milestoneRows.length >= MAX_MILESTONE_ROWS}
                    onClick={addMilestoneRow}
                  >
                    {t("accounting.addMilestone")}
                  </Button>

                  <p className={milestoneSumIsValid ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                    {t("accounting.percentageSum", { sum: milestonePercentSum.toFixed(2) })}
                  </p>

                  <FieldError message={planError ?? undefined} />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setPlanTarget(null)}>
                      {t("app.cancel")}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSavePlan}
                      disabled={planSubmitting || !milestoneSumIsValid}
                    >
                      {planSubmitting ? t("app.loading") : t("app.save")}
                    </Button>
                  </div>
                </div>
              )}

              {!canWrite && (
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setPlanTarget(null)}>
                    {t("app.cancel")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <FieldError message={planError ?? undefined} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
