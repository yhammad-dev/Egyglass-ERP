"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import {
  createInvoiceAction,
  issueInvoiceAction,
  cancelInvoiceAction,
} from "@/lib/finance/invoices";

type InvoiceRow = {
  id: string;
  documentNumber: string | null;
  customerName: string;
  quotationNumber: string | null;
  statementNumber: string | null;
  totalAmount: number;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  issuedAt: string | null;
};

type QuotationOption = {
  id: string;
  label: string;
  contractId: string | null;
  route: "PROJECTS" | "SOCIAL_MEDIA" | null;
};

type StatementOption = { id: string; label: string; quotationId: string };

const STATUS_VARIANT: Record<
  InvoiceRow["status"],
  "secondary" | "default" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PAID: "outline",
  CANCELLED: "destructive",
};

export function InvoicesClient({
  initialInvoices,
  quotations,
  statements,
}: {
  initialInvoices: InvoiceRow[];
  quotations: QuotationOption[];
  statements: StatementOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [quotationId, setQuotationId] = useState("");
  const [statementId, setStatementId] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  // إلغاء بسبب إلزامي (سند لا يُحذف — ISSUED→CANCELLED فقط)
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const numberFormat = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 });

  const selectedQuotation = quotations.find((q) => q.id === quotationId);
  // مستخلصات العرض المختار فقط (مشروعات) — السوشيال بلا عقد ولا مستخلص
  const linkableStatements = statements.filter(
    (s) => s.quotationId === quotationId
  );

  async function handleCreate() {
    setFormError(null);
    if (!quotationId) {
      setFormError(t("errors.invalidInput"));
      return;
    }
    setSubmitting(true);
    const result = await createInvoiceAction({
      quotationId,
      // مشروعات: العقد يُربط تلقائيًا من العرض · سوشيال: يبقى NULL (مباشرة)
      ...(selectedQuotation?.contractId
        ? { contractId: selectedQuotation.contractId }
        : {}),
      ...(statementId ? { statementId } : {}),
      ...(notesInput ? { notes: notesInput } : {}),
    });
    setSubmitting(false);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t("invoices.created"));
    setCreateOpen(false);
    setQuotationId("");
    setStatementId("");
    setNotesInput("");
    router.refresh();
  }

  async function handleIssue(id: string) {
    setIssuingId(id);
    const result = await issueInvoiceAction({ id });
    setIssuingId(null);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(`${t("invoices.issued")}: ${result.documentNumber}`);
    router.refresh();
  }

  async function handleCancel() {
    setCancelError(null);
    if (!cancelReason.trim()) {
      setCancelError(t("errors.rejectReasonRequired"));
      return;
    }
    if (!cancelId) return;
    setCancelling(true);
    const result = await cancelInvoiceAction({
      id: cancelId,
      reason: cancelReason.trim(),
    });
    setCancelling(false);
    if ("error" in result) {
      setCancelError(t(result.error));
      return;
    }
    toast.success(t("invoices.cancelled"));
    setCancelId(null);
    setCancelReason("");
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("invoices.title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("invoices.newInvoice")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoices.docNumber")}</TableHead>
              <TableHead>{t("invoices.customer")}</TableHead>
              <TableHead>{t("invoices.quotation")}</TableHead>
              <TableHead>{t("invoices.statement")}</TableHead>
              <TableHead>{t("invoices.total")}</TableHead>
              <TableHead>{t("invoices.statusLabel")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialInvoices.length ? (
              initialInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <span dir="ltr">{inv.documentNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>{inv.customerName}</TableCell>
                  <TableCell>
                    <span dir="ltr">{inv.quotationNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{inv.statementNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {numberFormat.format(inv.totalAmount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]}>
                      {t(`invoices.status_${inv.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {inv.status === "DRAFT" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={issuingId === inv.id}
                          onClick={() => handleIssue(inv.id)}
                        >
                          {t("invoices.issue")}
                        </Button>
                      )}
                      {inv.status === "ISSUED" && (
                        <>
                          <Button asChild variant="outline" size="sm">
                            <a href={`/invoices/${inv.id}`} target="_blank">
                              {t("invoices.printLink")}
                            </a>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setCancelId(inv.id)}
                          >
                            {t("invoices.cancel")}
                          </Button>
                        </>
                      )}
                      {(inv.status === "PAID" || inv.status === "CANCELLED") && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`/invoices/${inv.id}`} target="_blank">
                            {t("invoices.printLink")}
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("invoices.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* إنشاء فاتورة */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invoices.newInvoice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("invoices.quotation")}</Label>
              <Select
                value={quotationId}
                onValueChange={(v) => {
                  setQuotationId(v ?? "");
                  setStatementId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedQuotation?.label ?? t("invoices.selectQuotation")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {quotations.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedQuotation && (
              <p className="text-sm text-muted-foreground">
                {selectedQuotation.contractId
                  ? t("invoices.linkedToContract")
                  : t("invoices.directNoContract")}
              </p>
            )}
            {linkableStatements.length > 0 && (
              <div className="space-y-1">
                <Label>{t("invoices.statementOptional")}</Label>
                <Select value={statementId} onValueChange={(v) => setStatementId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {linkableStatements.find((s) => s.id === statementId)?.label ??
                        t("invoices.selectStatement")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {linkableStatements.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="inv-notes">{t("invoices.notes")}</Label>
              <Input
                id="inv-notes"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
            <FieldError message={formError ?? undefined} />
            <Button type="button" onClick={handleCreate} disabled={submitting}>
              {t("invoices.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* إلغاء بسبب إلزامي */}
      <Dialog open={cancelId !== null} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invoices.cancelTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cancel-reason">{t("invoices.cancelReason")}</Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <FieldError message={cancelError ?? undefined} />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {t("invoices.confirmCancel")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCancelId(null)}>
                {t("customers.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
