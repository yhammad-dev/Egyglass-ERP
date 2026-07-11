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
  createStatementAction,
  issueStatementAction,
} from "@/lib/finance/statements";

type StatementRow = {
  id: string;
  documentNumber: string | null;
  contractLabel: string;
  progressPct: number;
  statementValue: number;
  status: "DRAFT" | "ISSUED" | "PAID";
  issuedAt: string | null;
  notes: string | null;
};

const STATUS_VARIANT: Record<StatementRow["status"], "secondary" | "default" | "outline"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PAID: "outline",
};

export function StatementsClient({
  initialStatements,
  contracts,
}: {
  initialStatements: StatementRow[];
  contracts: { id: string; label: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [contractId, setContractId] = useState("");
  const [pctInput, setPctInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const numberFormat = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 });

  async function handleCreate() {
    setFormError(null);
    const pct = Number(pctInput);
    if (!contractId || Number.isNaN(pct) || pct <= 0 || pct > 100) {
      setFormError(t("errors.invalidInput"));
      return;
    }
    setSubmitting(true);
    const result = await createStatementAction({
      contractId,
      progressPct: pct,
      notes: notesInput || undefined,
    });
    setSubmitting(false);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t("statements.created"));
    setCreateOpen(false);
    setContractId("");
    setPctInput("");
    setNotesInput("");
    router.refresh();
  }

  async function handleIssue(id: string) {
    setIssuingId(id);
    const result = await issueStatementAction({ id });
    setIssuingId(null);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(`${t("statements.issued")}: ${result.documentNumber}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("statements.title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("statements.newStatement")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("statements.docNumber")}</TableHead>
              <TableHead>{t("statements.contract")}</TableHead>
              <TableHead>{t("statements.progressPct")}</TableHead>
              <TableHead>{t("statements.value")}</TableHead>
              <TableHead>{t("statements.statusLabel")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialStatements.length ? (
              initialStatements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span dir="ltr">{s.documentNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>{s.contractLabel}</TableCell>
                  <TableCell>
                    <span dir="ltr">{s.progressPct}%</span>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {numberFormat.format(s.statementValue)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status]}>
                      {t(`statements.status_${s.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {s.status === "DRAFT" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={issuingId === s.id}
                          onClick={() => handleIssue(s.id)}
                        >
                          {t("statements.issue")}
                        </Button>
                      )}
                      {s.status !== "DRAFT" && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`/statements/${s.id}`} target="_blank">
                            {t("statements.printLink")}
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("statements.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("statements.newStatement")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("statements.contract")}</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {contracts.find((c) => c.id === contractId)?.label ??
                      t("statements.selectContract")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pct">{t("statements.progressPct")}</Label>
              <Input
                id="pct"
                dir="ltr"
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">{t("statements.notes")}</Label>
              <Input
                id="notes"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
            <FieldError message={formError ?? undefined} />
            <Button type="button" onClick={handleCreate} disabled={submitting}>
              {t("statements.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
