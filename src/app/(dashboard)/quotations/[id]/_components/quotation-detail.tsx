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
// TO-24: مستعملان في شريط بوابة الاعتماد المبدئي
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
// TO-31/TO-32: نفس مصدر حارس السيرفر — لا نسخة ثانية من قائمة الأدوار في الواجهة.
import { canChangeQuotationStatus, canEditQuotation } from "@/lib/quotation-roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuotationStatus = "DRAFT" | "SENT" | "PENDING_APPROVAL" | "APPROVED" | "EXPIRED";
// TO-24: مطابق لـenum LeadApprovalStatus في السكيما (SCR-023).
type LeadApprovalStatus =
  | "NOT_SUBMITTED"
  | "PENDING_LEAD"
  | "LEAD_APPROVED"
  | "LEAD_RETURNED";

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
  // TO-23: آخر مُعدِّل. null = لم يُعدَّل بعد إنشائه (أو عُدِّل قبل نزول العمود).
  lastUpdatedBy: string | null;
  lastUpdatedAt: string;
  // TO-24: بوابة الاعتماد المبدئي. `isGatedByLead=false` ⇒ عرض بلا طلب تسعير،
  // خارج البوابة كليًا فلا شريط ولا أزرار.
  isGatedByLead: boolean;
  leadApprovalStatus: LeadApprovalStatus;
  leadNote: string | null;
  isSelfLeadApproved: boolean;
  isCreator: boolean;
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

  // 🔴 TO-32 — صلاحية **التعديل** اشتقاق منفصل عن `canEdit`، من مصدر حارس
  // السيرفر نفسه (`QUOTATION_PRICING_ROLES`). كان الزر على `canEdit` فانحرف
  // في الاتجاهين: المهندس مسموح له والزر مخفي، والمندوب/المدير يريان زرًا
  // تصدّهما صفحته بـ307 (خرجا من التسعير في W-01/TO-29).
  // `canEdit` تبقى كما هي لزرّي العقد وطلب الخصم — شغل مبيعات لا تسعير.
  const canEditPricing = canEditQuotation(currentRole);

  // 🔴 TO-31 — أداة «تغيير الحالة» تتبع **نفس قائمة الحارس** لا `canEdit`.
  // كانتا قائمتين مختلفتين، فانحرفتا في الاتجاهين معًا:
  //  · `SALES_REP` كان **يرى** الأداة والأكشن يرفضه (زر يعد بما لا يقع).
  //  · `TEC_APPROVER` كان **مسموحًا له** والأداة مخفية عنه.
  // `canEdit` تبقى كما هي لزرّي العقد وطلب الخصم — وهما شغل مبيعات لا حالة.
  const canChangeStatus = canChangeQuotationStatus(currentRole);

  // ── TO-24: بوابة الاعتماد المبدئي ─────────────────────────────────────────
  // كل ما هنا **إخفاء إضافي** لا بديل عن الحارس: الأفعال الثلاثة تُعيد فحص الدور
  // والحالة والمسار server-side (`src/lib/actions/lead-approval.ts`).
  const [leadStatus, setLeadStatus] = useState<LeadApprovalStatus>(
    quotation.leadApprovalStatus
  );
  const [leadNote, setLeadNote] = useState<string | null>(quotation.leadNote);
  const [leadBusy, setLeadBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);

  const gated = quotation.isGatedByLead;
  // TO-24: الشرط الواحد الذي يحكم **كل** مسار يصل العميل. مصدر واحد كي لا يُغلق
  // مسار ويُنسى آخر — وهو بالضبط ما حدث حين حُجبت الطباعة وبقي واتساب مفتوحًا.
  const leadGateBlocksCustomer = gated && leadStatus !== "LEAD_APPROVED";
  // المهندس يقدّم عرضه؛ ADMIN/TEC_LEAD يقدّران نيابةً (نفس حارس الأكشن).
  const canSubmitToLead =
    gated &&
    ["NOT_SUBMITTED", "LEAD_RETURNED"].includes(leadStatus) &&
    (quotation.isCreator || ["ADMIN", "TEC_LEAD"].includes(currentRole));
  const canDecideLead =
    gated && leadStatus === "PENDING_LEAD" && ["ADMIN", "TEC_LEAD"].includes(currentRole);

  async function runLeadAction(fn: () => Promise<{ success: true; warning?: string } | { error: string }>) {
    setLeadBusy(true);
    try {
      const result = await fn();
      if ("error" in result) {
        toast.error(t(result.error));
        return false;
      }
      if (result.warning) toast.warning(t(result.warning));
      else toast.success(t("app.saved"));
      return true;
    } catch {
      // لا فشل صامت: رمي غير متوقَّع يظهر رسالة بدل زر ميت.
      toast.error(t("errors.serverError"));
      return false;
    } finally {
      setLeadBusy(false);
    }
  }

  async function handleSubmitToLead() {
    const { submitForLeadApproval } = await import("@/lib/actions/lead-approval");
    if (await runLeadAction(() => submitForLeadApproval({ id: quotation.id }))) {
      setLeadStatus("PENDING_LEAD");
      setLeadNote(null);
      router.refresh();
    }
  }

  async function handleLeadApprove() {
    const { leadApproveQuotation } = await import("@/lib/actions/lead-approval");
    if (await runLeadAction(() => leadApproveQuotation({ id: quotation.id }))) {
      setLeadStatus("LEAD_APPROVED");
      setLeadNote(null);
      router.refresh();
    }
  }

  async function handleLeadReturn() {
    setReturnError(null);
    if (!returnNote.trim()) {
      setReturnError(t("errors.leadNoteRequired"));
      return;
    }
    const { leadReturnQuotation } = await import("@/lib/actions/lead-approval");
    if (
      await runLeadAction(() =>
        leadReturnQuotation({ id: quotation.id, note: returnNote.trim() })
      )
    ) {
      setLeadStatus("LEAD_RETURNED");
      setLeadNote(returnNote.trim());
      setReturnOpen(false);
      setReturnNote("");
      router.refresh();
    }
  }

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

  // TO-32: تنسيق جدول البنود = تنسيق قالب الطباعة حرفيًا (print/page.tsx:117).
  // `numberFormat` (en-US) يبقى لبقية الشاشة كما هو — توحيده الكامل خارج النطاق.
  const itemFmt = new Intl.NumberFormat("ar-EG-u-nu-latn", { minimumFractionDigits: 2 });
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
      {/* 🔴 TO-24: شريط حالة البوابة — **لا يحجب الشاشة** (الحجب على الطباعة وحدها).
          الغرض أن يعرف كل من يفتح العرض لماذا لا يمكن تسليمه للعميل بعد. */}
      {gated && leadStatus !== "LEAD_APPROVED" && (
        <div
          className={cn(
            "rounded-md border-2 p-4",
            leadStatus === "LEAD_RETURNED"
              ? "border-destructive/40 bg-destructive/5"
              : "border-amber-300 bg-amber-50"
          )}
        >
          <p
            className={cn(
              "font-semibold",
              leadStatus === "LEAD_RETURNED" ? "text-destructive" : "text-amber-900"
            )}
          >
            {t(`quotations.leadGate.banner_${leadStatus}`)}
          </p>
          {leadStatus === "LEAD_RETURNED" && leadNote && (
            <p className="mt-1 text-sm">
              {t("quotations.leadGate.returnReason")}: {leadNote}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canSubmitToLead && (
              <Button type="button" size="sm" disabled={leadBusy} onClick={handleSubmitToLead}>
                {leadBusy ? t("app.loading") : t("quotations.leadGate.submit")}
              </Button>
            )}
            {canDecideLead && (
              <>
                <Button type="button" size="sm" disabled={leadBusy} onClick={handleLeadApprove}>
                  {leadBusy ? t("app.loading") : t("quotations.leadGate.approve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={leadBusy}
                  onClick={() => setReturnOpen((v) => !v)}
                >
                  {t("quotations.leadGate.return")}
                </Button>
              </>
            )}
          </div>

          {canDecideLead && returnOpen && (
            <div className="mt-3 space-y-2">
              <Input
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder={t("quotations.leadGate.returnPlaceholder")}
              />
              <FieldError message={returnError ?? undefined} />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={leadBusy}
                onClick={handleLeadReturn}
              >
                {leadBusy ? t("app.loading") : t("quotations.leadGate.confirmReturn")}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" dir="ltr">
            {quotation.number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dateFormat.format(new Date(quotation.createdAt))}
          </p>
          <p className="text-sm">{quotation.customer.name}</p>
          {/* TO-23: آخر مُعدِّل — اسم وتاريخ فقط. تفاصيل ما تغيّر تبقى في ActivityLog. */}
          {quotation.lastUpdatedBy && (
            <p className="text-sm text-muted-foreground">
              {t("quotations.lastUpdated")}: {quotation.lastUpdatedBy} —{" "}
              {dateFormat.format(new Date(quotation.lastUpdatedAt))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANT[status]}>
            {t(`quotations.detail.status_${status}`)}
          </Badge>
          {/* TO-24: وسم الاعتماد المبدئي — المبيعات تميّز الجاهز، وTEC_APPROVER يرى
              أن المعتمِد المبدئي هو المنشئ نفسه قبل الاعتماد النهائي. */}
          {gated && leadStatus === "LEAD_APPROVED" && (
            <Badge variant="secondary">{t("quotations.leadGate.badge_LEAD_APPROVED")}</Badge>
          )}
          {gated && quotation.isSelfLeadApproved && (
            <Badge variant="destructive">{t("quotations.leadGate.selfApproved")}</Badge>
          )}
          {/* 🔴 TO-24 — مسارا وصول العميل الوحيدان في النظام (مُتحقَّق بمسح شامل:
              لا تصدير ولا مشاركة رابط ولا window.open ثالث على مستند العرض).
              كلاهما يُعطَّل قبل الاعتماد المبدئي — بوابة على مسار واحد ليست بوابة.
              ⚠️ فارق جوهري بينهما:
              · الطباعة محروسة **server-side** أيضًا (print/page.tsx) — هذا التعطيل
                راحة للمستخدم لا خط الدفاع.
              · واتساب رابط يُبنى في المتصفح بالكامل، فلا وجود لخط دفاع خادمي له —
                هذا التعطيل هو الضابط الوحيد، ومن يعرف رقم العميل يستطيع تجاوزه
                يدويًا. مسجَّل صراحةً في التقرير. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={leadGateBlocksCustomer}
            title={leadGateBlocksCustomer ? t("quotations.leadGate.blockedHint") : undefined}
            onClick={() => window.open(`/quotations/${quotation.id}/print`, "_blank")}
          >
            🖨️ طباعة / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={leadGateBlocksCustomer}
            title={leadGateBlocksCustomer ? t("quotations.leadGate.blockedHint") : undefined}
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
          {/* TO-32: زر التعديل على صلاحية التسعير لا `canEdit` — انظر الاشتقاق أعلاه. */}
          {canEditPricing && (
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

      {/* TO-32: نفس أعمدة قالب الطباعة وترتيبها (print/page.tsx:244-303):
          # · البيان · الكمية · سعر الوحدة · الإجمالي — بمفاتيح القالب نفسها
          (quotations.print.*) وتنسيق أرقامه نفسه (ar-EG-u-nu-latn).
          · عمود «الوحدة» لم يُنقل: في القالب شرطي للمشروعات ويعرض «—» دائمًا
            (QuotationItem بلا حقل unit بعد) — نقله هنا عمود فارغ بلا معلومة.
          · 🔴 لا costSnapshot ولا أي اشتقاق منه — بيانات تكلفة، مكانها الداشبورد. */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>{t("quotations.print.item")}</TableHead>
              <TableHead className="text-end">{t("quotations.print.qty")}</TableHead>
              <TableHead className="text-end">{t("quotations.print.unitPrice")}</TableHead>
              <TableHead className="text-end">{t("quotations.print.lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotation.items.length ? (
              quotation.items.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="break-words">{item.description}</TableCell>
                  <TableCell className="text-end">
                    <span dir="ltr">{item.quantity}</span>
                  </TableCell>
                  <TableCell className="text-end">
                    <span dir="ltr">{itemFmt.format(item.unitPrice)}</span>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <span dir="ltr">{itemFmt.format(item.lineTotal)}</span>
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

      {canChangeStatus && (
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
