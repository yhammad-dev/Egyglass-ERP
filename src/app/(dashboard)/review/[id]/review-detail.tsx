"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "RETURNED";

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING_REVIEW: "outline",
  APPROVED: "default",
  RETURNED: "destructive",
};

type ReviewQuotationDetailData = {
  id: string;
  number: string;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  createdAt: string;
  subtotal: number;
  taxPct: number;
  taxAmount: number;
  total: number;
  customer: { id: string; name: string; phone: string };
  createdBy: { id: string; name: string };
  items: { id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

export function ReviewDetail({ quotation }: { quotation: ReviewQuotationDetailData }) {
  const t = useTranslations();
  const router = useRouter();

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(quotation.reviewStatus);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const pending = reviewStatus === "PENDING_REVIEW";

  async function handleApprove() {
    setError(null);
    setSubmitting(true);
    const { approveQuotationAction } = await import("../../../../../lib/review/actions");
    const response = await approveQuotationAction({ id: quotation.id });
    setSubmitting(false);

    if ("error" in response) {
      setError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setReviewStatus("APPROVED");
    toast.success(t("review.approved"));
    router.refresh();
  }

  async function handleReject() {
    setError(null);
    if (!reason.trim()) {
      setError(t("errors.rejectReasonRequired"));
      return;
    }

    setSubmitting(true);
    const { rejectQuotationAction } = await import("../../../../../lib/review/actions");
    const response = await rejectQuotationAction({ id: quotation.id, reason });
    setSubmitting(false);

    if ("error" in response) {
      setError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setReviewStatus("RETURNED");
    toast.success(t("review.rejected"));
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" dir="ltr">
            {quotation.number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dateFormat.format(new Date(quotation.createdAt))}
          </p>
          <p className="text-sm">{quotation.customer.name}</p>
          <p className="text-sm text-muted-foreground">{quotation.createdBy.name}</p>
        </div>
        <Badge variant={STATUS_VARIANT[reviewStatus]}>
          {t(`review.status_${reviewStatus}`)}
        </Badge>
      </div>

      {quotation.reviewNote && (
        <p className="text-sm text-red-500">{quotation.reviewNote}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("quotations.detail.product")}</TableHead>
              <TableHead className="text-right">
                <span dir="ltr">{t("quotations.detail.itemSubtotal")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotation.items.length ? (
              quotation.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">
                    <span dir="ltr">{numberFormat.format(item.lineTotal)}</span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="max-w-sm space-y-1 text-sm">
        <div className="flex justify-between">
          <span>{t("quotations.subtotal")}</span>
          <span dir="ltr">{numberFormat.format(quotation.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("quotations.vat")}</span>
          <span dir="ltr">{numberFormat.format(quotation.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>{t("quotations.total")}</span>
          <span dir="ltr">{numberFormat.format(quotation.total)}</span>
        </div>
      </div>

      {pending && (
        <div className="space-y-3 max-w-md">
          <div className="space-y-1">
            <Textarea
              placeholder={t("review.rejectReasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleApprove} disabled={submitting}>
              {t("review.approve")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={submitting}
            >
              {t("review.reject")}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
