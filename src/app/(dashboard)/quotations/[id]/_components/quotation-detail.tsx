"use client";

import { useState, lazy, Suspense } from "react";
import { DiscountApprovalPanel } from "./discount-approval-panel";
const DocumentUpload = lazy(() =>
  import("@/components/document-upload").then((m) => ({ default: m.DocumentUpload }))
);
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuotationStatus = "DRAFT" | "SENT" | "PENDING_APPROVAL" | "APPROVED" | "EXPIRED";

const STATUS_VARIANT: Record<QuotationStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "default",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  EXPIRED: "destructive",
};

const STATUS_OPTIONS: QuotationStatus[] = [
  "DRAFT",
  "SENT",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXPIRED",
];

type DiscountRequestData = {
  id: string;
  requestedPct: number;
  reason: string | null;
  createdAt: string;
};

type QuotationDetailData = {
  id: string;
  number: string;
  status: QuotationStatus;
  createdAt: string;
  validUntil: string;
  subtotal: number;
  taxPct: number;
  taxAmount: number;
  total: number;
  customer: { id: string; name: string; phone: string };
  createdBy: { id: string; name: string };
  items: { id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

export function QuotationDetail({
  quotation,
  currentRole,
  discountRequest,
  discountMaxReqPct,
}: {
  quotation: QuotationDetailData;
  currentRole: string;
  discountRequest?: DiscountRequestData | null;
  discountMaxReqPct?: number;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [status, setStatus] = useState<QuotationStatus>(quotation.status);
  const [selectedStatus, setSelectedStatus] = useState<QuotationStatus>(quotation.status);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = ["ADMIN", "SALES_MANAGER", "SALES_REP"].includes(currentRole);

  // PHASE C (D-23/BL-71): طلب خصم على عرض قائم — نفس السلسلة، requestDiscountAction القائم.
  // يظهر لأدوار الخصم على عرض DRAFT/SENT بلا طلب معلّق (الحارس النهائي server-side).
  const canRequestDiscount =
    ["ADMIN", "SALES_MANAGER", "SALES_REP"].includes(currentRole) &&
    ["DRAFT", "SENT"].includes(status) &&
    !discountRequest;
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [requestingDiscount, setRequestingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  async function handleRequestDiscount() {
    setDiscountError(null);
    const pct = Number(discountPct);
    if (Number.isNaN(pct) || pct <= 0) {
      setDiscountError(t("errors.invalidInput"));
      return;
    }
    setRequestingDiscount(true);
    const { requestDiscountAction } = await import("@/lib/actions/discount");
    const result = await requestDiscountAction({
      quotationId: quotation.id,
      requestedPct: pct,
      reason: discountReason.trim() || undefined,
    });
    setRequestingDiscount(false);
    if ("error" in result) {
      setDiscountError(t(result.error));
      return;
    }
    toast.success(t("discount.request.success"));
    setDiscountOpen(false);
    setDiscountPct("");
    setDiscountReason("");
    router.refresh();
  }

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function buildWhatsAppLink() {
    const rawPhone = quotation.customer.phone.replace(/[\s+\-()]/g, "").replace(/^0+/, "");
    const phone = `20${rawPhone}`;
    const formattedTotal = numberFormat.format(quotation.total);
    const text = encodeURIComponent(
      `مرحباً ${quotation.customer.name}، يسعدنا إرسال عرض السعر رقم ${quotation.number} بإجمالي ${formattedTotal} جنيه. للاطلاع على التفاصيل تواصلوا معنا.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  async function handleStatusChange() {
    setError(null);
    if (selectedStatus === status) return;

    setChangingStatus(true);
    const { updateQuotationStatus } = await import("../../../../../../lib/pricing/actions");
    const response = await updateQuotationStatus({
      quotationId: quotation.id,
      status: selectedStatus,
    });
    setChangingStatus(false);

    if ("error" in response) {
      setError(t(response.error));
      return;
    }

    setStatus(selectedStatus);
    toast.success(t("quotations.detail.statusUpdated"));
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
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANT[status]}>
            {t(`quotations.detail.status_${status}`)}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(`/quotations/${quotation.id}/print`, "_blank")}
          >
            🖨️ طباعة / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(buildWhatsAppLink(), "_blank")}
          >
            💬 {t("quotations.sendWhatsApp")}
          </Button>
          {canEdit && status === "APPROVED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(`/quotations/${quotation.id}/contract`)}
            >
              📝 إنشاء عقد
            </Button>
          )}
          {canRequestDiscount && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDiscountOpen(true)}
            >
              {t("discount.request.button")}
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
            >
              {t("quotations.detail.edit")}
            </Button>
          )}
        </div>
      </div>

      {/* PHASE C: نافذة طلب خصم على عرض قائم */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("discount.request.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="req-pct">{t("discount.request.pct")}</Label>
              <Input
                id="req-pct"
                type="number"
                dir="ltr"
                min={0}
                step="0.01"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-reason">{t("discount.request.reason")}</Label>
              <Input
                id="req-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            </div>
            {discountError && (
              <p className="text-sm text-red-600 dark:text-red-400">{discountError}</p>
            )}
            <Button type="button" onClick={handleRequestDiscount} disabled={requestingDiscount}>
              {requestingDiscount ? t("app.loading") : t("discount.request.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {quotation.status === "PENDING_APPROVAL" && discountRequest && (
        <DiscountApprovalPanel
          discountRequest={discountRequest}
          currentRole={currentRole}
          discountMaxReqPct={discountMaxReqPct ?? 25}
        />
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

      {/* Documents */}
      <div className="space-y-3 border rounded-md p-4">
        <h2 className="text-sm font-semibold">المستندات المرفقة</h2>
        <Suspense fallback={<p className="text-xs text-gray-400">جاري التحميل...</p>}>
          <DocumentUpload entityType="quotation" entityId={quotation.id} />
        </Suspense>
      </div>

      {canEdit && (
        <div className="space-y-2 max-w-sm">
          <p className="text-sm font-medium">{t("quotations.detail.changeStatus")}</p>
          <div className="flex items-center gap-2">
            <Select
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus((value as QuotationStatus) ?? status)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{t(`quotations.detail.status_${selectedStatus}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`quotations.detail.status_${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={handleStatusChange}
              disabled={changingStatus || selectedStatus === status}
            >
              {changingStatus ? t("app.loading") : t("quotations.detail.save")}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
