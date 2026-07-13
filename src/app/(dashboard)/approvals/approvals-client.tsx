"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type DiscountItem = {
  id: string;
  requestedPct: number;
  reason: string | null;
  quotationNumber: string;
  customerName: string;
  createdAt: string;
};
type InvoiceItem = {
  id: string;
  documentNumber: string | null;
  totalAmount: number;
  customerName: string;
  createdAt: string;
};
type InvestigationItem = {
  id: string;
  claimedFault: string;
  quotationNumber: string;
  customerName: string;
  openedAt: string;
};

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function ApprovalsClient({
  discounts,
  invoices,
  investigations = [],
}: {
  discounts: DiscountItem[];
  invoices: InvoiceItem[];
  investigations?: InvestigationItem[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const numberFormat = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2 });
  const total = discounts.length + invoices.length + investigations.length;

  // BL-74: نفس الأكشنات القائمة بنفس الحرّاس — لا منطق جديد، مدخل فقط.
  function decideDiscount(id: string, decision: "APPROVED" | "REJECTED", note?: string) {
    startTransition(async () => {
      const { decideDiscountAction } = await import("@/lib/actions/discount");
      const result = await decideDiscountAction({
        discountRequestId: id,
        decision,
        rejectNote: decision === "REJECTED" ? note : undefined,
      });
      if ("error" in result) {
        toast.error(t(result.error));
        return;
      }
      toast.success(t("approvals.done"));
      setRejectId(null);
      setRejectNote("");
      router.refresh();
    });
  }

  function issueInvoice(id: string) {
    startTransition(async () => {
      const { issueInvoiceAction } = await import("@/lib/finance/invoices");
      const result = await issueInvoiceAction({ id });
      if ("error" in result) {
        toast.error(t(result.error));
        return;
      }
      toast.success(t("approvals.done"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("approvals.title")}</h1>

      {total === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          {t("approvals.empty")}
        </p>
      )}

      {discounts.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("approvals.discountsSection")}</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("approvals.quotation")}</TableHead>
                  <TableHead>{t("approvals.customer")}</TableHead>
                  <TableHead>{t("approvals.pct")}</TableHead>
                  <TableHead>{t("approvals.reason")}</TableHead>
                  <TableHead>{t("approvals.waiting")}</TableHead>
                  <TableHead>{t("app.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell dir="ltr">{d.quotationNumber}</TableCell>
                    <TableCell>{d.customerName}</TableCell>
                    <TableCell dir="ltr">{d.requestedPct}%</TableCell>
                    <TableCell className="max-w-[220px] truncate">{d.reason ?? "—"}</TableCell>
                    <TableCell>{t("approvals.daysAgo", { days: ageDays(d.createdAt) })}</TableCell>
                    <TableCell>
                      {rejectId === d.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder={t("approvals.rejectReason")}
                            className="w-40"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isPending || !rejectNote.trim()}
                            onClick={() => decideDiscount(d.id, "REJECTED", rejectNote.trim())}
                          >
                            {t("approvals.confirmReject")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => { setRejectId(null); setRejectNote(""); }}
                          >
                            {t("app.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={isPending}
                            onClick={() => decideDiscount(d.id, "APPROVED")}
                          >
                            {t("approvals.approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => setRejectId(d.id)}
                          >
                            {t("approvals.reject")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {investigations.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("approvals.investigationsSection")}</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("approvals.quotation")}</TableHead>
                  <TableHead>{t("approvals.customer")}</TableHead>
                  <TableHead>{t("investigations.claimedFault")}</TableHead>
                  <TableHead>{t("approvals.waiting")}</TableHead>
                  <TableHead>{t("app.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investigations.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell dir="ltr">{f.quotationNumber}</TableCell>
                    <TableCell>{f.customerName}</TableCell>
                    <TableCell>{t(`investigations.fault_${f.claimedFault}`)}</TableCell>
                    <TableCell>{t("approvals.daysAgo", { days: ageDays(f.openedAt) })}</TableCell>
                    <TableCell>
                      <Link href={`/investigations/${f.id}`} className="underline text-sm">
                        {t("approvals.openInvestigation")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("approvals.invoicesSection")}</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("approvals.customer")}</TableHead>
                  <TableHead>{t("approvals.amount")}</TableHead>
                  <TableHead>{t("approvals.waiting")}</TableHead>
                  <TableHead>{t("app.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {numberFormat.format(inv.totalAmount)}
                    </TableCell>
                    <TableCell>{t("approvals.daysAgo", { days: ageDays(inv.createdAt) })}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={isPending}
                        onClick={() => issueInvoice(inv.id)}
                      >
                        {t("approvals.issue")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
