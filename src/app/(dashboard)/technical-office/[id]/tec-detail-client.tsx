"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TecJobDetail, DrawingRow } from "@/lib/services/tec";
import { TEC_STATUS_COLORS } from "@/lib/status-colors";
// D-IN-26: المصدر الوحيد لتنسيق الوقت — مثبَّت على توقيت القاهرة
import { formatInstantDate } from "@/lib/format/dates";
import {
  updateJobNotesAction,
  uploadDrawingAction,
  approveDrawingAction,
} from "../actions";

type TecJobStatus = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "DONE";
type DrawingCategory =
  | "DRAWINGS"
  | "STRUCTURAL_CALC"
  | "DATA_SHEET"
  | "EXECUTION_DRAWINGS"
  | "APPROVALS";


const CATEGORIES: DrawingCategory[] = [
  "DRAWINGS",
  "STRUCTURAL_CALC",
  "DATA_SHEET",
  "EXECUTION_DRAWINGS",
  "APPROVALS",
];

const FILE_TYPES = ["PDF", "DWG", "JPG"] as const;

export function TecDetailClient({
  job: initialJob,
  currentRole,
  currentUserId,
}: {
  job: TecJobDetail;
  currentRole: string;
  currentUserId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [drawings, setDrawings] = useState<DrawingRow[]>(initialJob.drawings);
  const [notes, setNotes] = useState(initialJob.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DrawingCategory>("DRAWINGS");

  const canUpload = currentRole === "ADMIN" || currentRole === "TECHNICAL_OFFICE";
  const canApprove = currentRole === "ADMIN" || currentRole === "TEC_APPROVER";

  // TO-09: حالة مراجعة العرض محليًا كي يختفي التنبيه فور إعادة التقديم دون انتظار
  // إعادة التحميل — نفس نمط review-detail.tsx.
  const [reviewStatus, setReviewStatus] = useState(initialJob.reviewStatus);
  const [reviewNote, setReviewNote] = useState(initialJob.reviewNote);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  // TO-09: مرآة حارس resubmitQuotationAction (lib/review/actions.ts:271-282) —
  // RETURNED حصرًا، ثم المنشئ أو TECHNICAL_OFFICE أو ADMIN. INSPECTION_MANAGER يصل
  // لهذه الشاشة لكنه خارج بوابة الأكشن ⇒ يرى التنبيه ولا يرى الزر.
  // الإخفاء تجربة استخدام؛ الرفض الحقيقي server-side ولم يُمس.
  const canResubmit =
    reviewStatus === "RETURNED" &&
    (currentRole === "ADMIN" ||
      currentRole === "TECHNICAL_OFFICE" ||
      initialJob.quotationCreatedById === currentUserId);
  // PHASE 1 (دفعة هـ): بوابتا G2/G3 أُلغيتا (D-02/D-05) — سلسلة الرسمة = DRAFT → TEC_APPROVED.
  // لا بوابة تحقق لحسن بهاء، ولا اعتماد CEO. الإفراج صار خاصية أمر التصنيع (PHASE 3).

  // Upload form state
  const [uploadCategory, setUploadCategory] = useState<DrawingCategory>("DRAWINGS");
  const [uploadFileType, setUploadFileType] = useState<string>("PDF");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadRevision, setUploadRevision] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [approvingId, setApprovingId] = useState<string | null>(null);

  /**
   * D-IN-26: المُنسِّق المحلي **حُذف** — كان بلا `timeZone` فيُرسم بمنطقة البيئة
   * (UTC على الخادم · القاهرة في المتصفح) ⇒ نفس عيب اختلاف اليوم الذي عالجه C1-fix.
   * كل قيمة زمنية تمرّ الآن عبر `lib/format/dates.ts` المثبَّت على توقيت القاهرة.
   */

  async function handleSaveNotes() {
    setSavingNotes(true);
    const result = await updateJobNotesAction({ id: initialJob.id, notes });
    setSavingNotes(false);
    if ("error" in result) {
      toast.error(t(result.error ?? "errors.serverError"));
      return;
    }
    toast.success(t("tec.notesSaved"));
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      const result = await uploadDrawingAction({
        quotationRequestId: initialJob.id,
        category: uploadCategory,
        fileType: uploadFileType,
        originalName: uploadFile.name,
        mimeType: uploadFile.type || "application/octet-stream",
        sizeBytes: uploadFile.size,
        base64,
        label: uploadLabel.trim() || undefined,
        notes: uploadNotes.trim() || undefined,
        revision: uploadRevision.trim() || undefined,
      });

      if ("error" in result) {
        toast.error(t(result.error ?? "errors.serverError"));
        return;
      }

      toast.success(t("tec.drawingUploaded"));
      setUploadLabel("");
      setUploadRevision("");
      setUploadNotes("");
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // optimistic new drawing placeholder — server revalidates on next nav
      setDrawings((prev) => [
        {
          id: result.drawingId,
          category: uploadCategory,
          fileType: uploadFileType,
          filename: uploadFile.name,
          originalName: uploadFile.name,
          url: "",
          sizeBytes: uploadFile.size,
          label: uploadLabel.trim() || null,
          notes: uploadNotes.trim() || null,
          revision: uploadRevision.trim() || null,
          uploadedByName: t("app.me") ?? "أنا",
          approvedByName: null,
          approvedAt: null,
          createdAt: new Date(),
          status: "DRAFT",
        },
        ...prev,
      ]);
    } finally {
      setUploading(false);
    }
  }

  async function handleApprove(drawing: DrawingRow) {
    setApprovingId(drawing.id);
    const result = await approveDrawingAction({ drawingId: drawing.id });
    setApprovingId(null);
    if ("error" in result) {
      toast.error(
        result.error === "errors.cannotApproveSelf"
          ? t("tec.cannotApproveSelf")
          : t(result.error ?? "errors.serverError")
      );
      return;
    }
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === drawing.id
          ? { ...d, approvedByName: "✓", approvedAt: new Date(), status: "TEC_APPROVED" }
          : d
      )
    );
    toast.success(t("tec.drawingApproved"));
  }

  /**
   * TO-09: إعادة تقديم العرض المرتجع من شاشة المكتب الفني نفسها.
   * يستدعي resubmitQuotationAction القائم (TO-04) بلا أي تعديل عليه ولا على حارسه —
   * الشاشة كانت الحلقة المفقودة لا الأكشن.
   */
  async function handleResubmit() {
    const quotationId = initialJob.quotationId;
    if (!quotationId) return;
    setResubmitError(null);
    setResubmitting(true);
    const { resubmitQuotationAction } = await import(
      "../../../../../lib/review/actions"
    );
    const result = await resubmitQuotationAction({ id: quotationId });
    setResubmitting(false);
    if ("error" in result) {
      setResubmitError(t(result.error ?? "errors.serverError"));
      return;
    }
    setReviewStatus("PENDING_REVIEW");
    setReviewNote(null);
    toast.success(t("review.resubmitted"));
    router.refresh();
  }

  // PHASE 2 (BL-32): إصدار أمر التصنيع — بيت المدير التنفيذي (TEC_APPROVER/ADMIN).
  // الحارس النهائي server-side؛ هنا زر بسبب صريح لا صامت.
  const [issuingMfg, setIssuingMfg] = useState(false);

  // ── SCR-INS-J (C3): تأكيد استلام المقاسات ──
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  async function handleConfirmReceipt() {
    if (initialJob.inspection.kind !== "APPROVED") return;
    setConfirmingReceipt(true);
    // استيراد ديناميكي — نفس نمط `handleIssueMfg` أدناه: أكشن من موديول آخر
    const { confirmTecReceipt } = await import("../../inspections/actions");
    const res = await confirmTecReceipt({
      id: initialJob.inspection.inspectionId,
    });
    setConfirmingReceipt(false);
    if ("error" in res) {
      toast.error(t(res.error ?? "errors.updateFailed"));
      return;
    }
    // الاسم والوقت يأتيان من الخادم — `refresh` بدل تلفيقهما محليًا (نمط C1/C2)
    router.refresh();
    toast.success(t("tec.receipt.done"));
  }
  const canIssueMfg = currentRole === "ADMIN" || currentRole === "TEC_APPROVER";
  const hasApprovedDrawing = drawings.some((d) => d.status === "TEC_APPROVED");
  let mfgDisabledReason: string | null = null;
  if (initialJob.hasManufacturingOrder) mfgDisabledReason = t("tec.mfgAlreadyIssued");
  else if (!initialJob.quotationId) mfgDisabledReason = t("tec.mfgNoQuotation");
  else if (!hasApprovedDrawing) mfgDisabledReason = t("tec.mfgNoApprovedDrawing");
  // BL-44: عقد إلزامي للمسارين · D-10: دفعة واحدة على الأقل
  else if (!initialJob.hasContract) mfgDisabledReason = t("tec.mfgNoContract");
  else if (!initialJob.hasPayment) mfgDisabledReason = t("tec.mfgNoPayment");

  async function handleIssueMfg() {
    if (!initialJob.quotationId) return;
    setIssuingMfg(true);
    const { createManufacturingOrder } = await import(
      "../../../../../lib/manufacturing/actions"
    );
    const result = await createManufacturingOrder(initialJob.quotationId);
    setIssuingMfg(false);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(t("tec.mfgIssued"));
    router.refresh();
  }

  const categoryDrawings = drawings.filter((d) => d.category === activeCategory);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/technical-office">
              <Button type="button" variant="outline" size="sm">
                {t("tec.back")}
              </Button>
            </Link>
            <h1 className="text-xl font-semibold font-mono" dir="ltr">
              {initialJob.code}
            </h1>
            <Badge
              className={TEC_STATUS_COLORS[initialJob.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}
            >
              {t(`tec.status_${initialJob.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{initialJob.customerName}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {initialJob.quotationNumber}
          </p>
        </div>

        {/* دفعة هـ (W-01): المكتب الفني ينشئ العرض من الطلب (يرث المسار) */}
        {(canUpload || canApprove) && (
          <Button
            type="button"
            onClick={() =>
              router.push(
                `/quotations/new?customerId=${initialJob.customerId}&requestId=${initialJob.id}`
              )
            }
          >
            {initialJob.quotationNumber
              ? t("tec.reprice")
              : t("tec.createQuotation")}
          </Button>
        )}
        {/* PHASE 2 (BL-32): إصدار أمر التصنيع — TEC_APPROVER/ADMIN فقط، معطّل بسبب صريح */}
        {canIssueMfg && (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="default"
              disabled={mfgDisabledReason !== null || issuingMfg}
              onClick={handleIssueMfg}
            >
              {issuingMfg ? t("app.loading") : t("tec.issueMfgOrder")}
            </Button>
            {mfgDisabledReason && (
              <span className="text-xs text-amber-600">{mfgDisabledReason}</span>
            )}
          </div>
        )}
      </div>

      {/* TO-09: تنبيه العرض المرتجع — أعلى الشاشة لأنه فعل مطلوب لا بيان.
          هذه هي نقطة الوصول الوحيدة للمكتب الفني: /review/[id] محروسة
          ["ADMIN","TEC_APPROVER"] و /quotations/[id] لا تعرض reviewStatus. */}
      {reviewStatus === "RETURNED" && (
        <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-destructive">
              {t("tec.quotationReturnedTitle")}
            </h2>
            <Badge variant="destructive" className="text-xs">
              {t("review.status_RETURNED")}
            </Badge>
            {initialJob.quotationNumber && (
              <span className="text-xs text-muted-foreground" dir="ltr">
                {initialJob.quotationNumber}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("tec.quotationReturnedReason")}
            </p>
            {reviewNote?.trim() ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {reviewNote}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {t("tec.quotationReturnedNoReason")}
              </p>
            )}
          </div>

          {canResubmit && (
            <div className="space-y-1">
              <Button
                type="button"
                onClick={handleResubmit}
                disabled={resubmitting}
              >
                {resubmitting ? t("app.loading") : t("review.resubmit")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("review.resubmitHint")}
              </p>
            </div>
          )}

          {resubmitError && (
            <p className="text-sm text-destructive">{resubmitError}</p>
          )}
        </div>
      )}

      {/* TO-12: وصف طلب العميل كما سجّلته المبيعات — الأساس الذي يُسعَّر عليه،
          فيسبق كل بيان ثانوي. نص حر (لا بنود مهيكلة) → نحفظ فواصل الأسطر. */}
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-primary">
          {t("quotationRequest.summary")}
        </h2>
        {initialJob.summary?.trim() ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {initialJob.summary}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            {t("quotationRequest.noSummary")}
          </p>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-lg border p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">{t("tec.route")}</p>
          <p>{t(`tec.${initialJob.technicalRoute === "PROJECTS" ? "projects" : "socialMedia"}`)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("tec.engineer")}</p>
          <p>{initialJob.engineerName ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("tec.salesOwner")}</p>
          <p>{initialJob.salesOwnerName ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("tec.inspectionOwner")}</p>
          <p>{initialJob.inspectionOwnerName ?? "—"}</p>
        </div>

        {/* ── IN-06: مقاسات المعاينة — للقراءة فقط ──
            كان المكتب الفني يُطلب منه إعادة التسعير على مقاسات لا يراها إطلاقًا
            (صفر قراءة في هذا المجلد). تظهر بعد اعتماد مدير المعاينات حصرًا (D-37)،
            وكل حالة غياب مُصرَّح بها بنصّها — لا جدول فارغ بلا تفسير. */}
        <div className="md:col-span-2 space-y-2 pt-2 border-t">
          <p className="font-semibold">{t("tec.inspectionMeasurements")}</p>

          {initialJob.inspection.kind === "NO_INSPECTION" && (
            <p className="text-sm text-muted-foreground">
              {t("tec.noLinkedInspection")}
            </p>
          )}

          {initialJob.inspection.kind === "NOT_APPROVED" && (
            <p className="text-sm text-amber-600">
              {t("tec.inspectionNotApproved")}
            </p>
          )}

          {/* ── SCR-INS-A (IN-03): حكم المطابقة كما أعلنه مدير المعاينات ──
              🔴 **المكتب الفني هو المستهلك الحقيقي للحكم** — «اختلاف يستوجب إعادة
              التسعير» يعني عملًا عليه هو. يُعرض فوق المقاسات لا تحتها: القرار يسبق
              الأرقام التي بُني عليها.
              ⚠️ التوجيه الآلي على هذه النتيجة **غير مبني** (BL-166) — القراءة هنا
              والتصرف يدوي. لا تفترض أن النظام حرّك شيئًا بناءً عليها. */}
          {initialJob.inspection.kind === "APPROVED" && (
            <div className="rounded-md border p-3 space-y-1 mb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {t("inspections.match.title")}
                </span>
                {initialJob.inspection.matchResult ? (
                  <Badge
                    variant={
                      initialJob.inspection.matchResult === "REQUIRES_REPRICING"
                        ? "destructive"
                        : initialJob.inspection.matchResult === "ACCEPTABLE_DEVIATION"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {t(
                      `inspections.match.result_${initialJob.inspection.matchResult}`
                    )}
                  </Badge>
                ) : (
                  /* معتمدة ولم يُعلَن الحكم بعد — حالة قائمة لا عطل عرض */
                  <Badge variant="outline">
                    {t("inspections.match.notDeclared")}
                  </Badge>
                )}
              </div>
              {initialJob.inspection.matchReason && (
                <p className="text-sm whitespace-pre-wrap">
                  <span className="text-muted-foreground">
                    {t("inspections.match.reason")}:{" "}
                  </span>
                  {initialJob.inspection.matchReason}
                </p>
              )}
              {initialJob.inspection.matchDeclaredByName && (
                <p className="text-xs text-muted-foreground">
                  {t("inspections.match.declaredBy")}{" "}
                  {initialJob.inspection.matchDeclaredByName}
                  {initialJob.inspection.matchDeclaredAt && (
                    <>
                      {" — "}
                      <span dir="ltr">
                        {formatInstantDate(initialJob.inspection.matchDeclaredAt)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* ── SCR-INS-J (C3 · D-IN-4 · Q6): تأكيد استلام المقاسات ──
              الفجوة: الاعتماد يُخطر المكتب الفني (D-37) و**لا أحد يعرف هل وصلت ومتى
              ولمن**. الزرّ هنا لا في شاشة المعاينة: هذه هي الشاشة التي يرى فيها
              المكتب الفني المقاسات فعلًا، فالتأكيد إقرارٌ بما أمامه.
              🔴 **للقياس والمساءلة لا بوابة** — لا شيء يُمنع بغياب التأكيد. */}
          {initialJob.inspection.kind === "APPROVED" && (
            <div className="rounded-md border p-3 mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {initialJob.inspection.tecReceivedAt ? (
                  <>
                    ✅ {t("tec.receipt.confirmed")}
                    {initialJob.inspection.tecReceivedByName && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {initialJob.inspection.tecReceivedByName}
                        {" · "}
                        <span dir="ltr">
                          {formatInstantDate(initialJob.inspection.tecReceivedAt)}
                        </span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-700">{t("tec.receipt.pending")}</span>
                )}
              </span>
              {!initialJob.inspection.tecReceivedAt && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={confirmingReceipt}
                  onClick={handleConfirmReceipt}
                >
                  {confirmingReceipt ? t("app.loading") : t("tec.receipt.confirm")}
                </Button>
              )}
            </div>
          )}

          {initialJob.inspection.kind === "APPROVED" &&
            (initialJob.inspection.measurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tec.inspectionApprovedNoRows")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-md">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-start">
                        {t("inspections.detail.description")}
                      </th>
                      <th className="p-2 text-start">
                        {t("inspections.detail.width")}
                      </th>
                      <th className="p-2 text-start">
                        {t("inspections.detail.height")}
                      </th>
                      <th className="p-2 text-start">
                        {t("inspections.detail.unit")}
                      </th>
                      <th className="p-2 text-start">
                        {t("inspections.detail.quantity")}
                      </th>
                      <th className="p-2 text-start">{t("inspections.notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialJob.inspection.measurements.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2">{m.description}</td>
                        <td className="p-2" dir="ltr">{m.width}</td>
                        <td className="p-2" dir="ltr">{m.height}</td>
                        <td className="p-2">
                          {t(`inspections.detail.unit_${m.unit}`)}
                        </td>
                        <td className="p-2" dir="ltr">{m.quantity}</td>
                        <td className="p-2 text-muted-foreground">
                          {m.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>

        {/* Notes */}
        <div className="md:col-span-2 space-y-2 pt-2 border-t">
          <Label htmlFor="job-notes">{t("tec.notes")}</Label>
          <Textarea
            id="job-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            readOnly={!canUpload && !canApprove}
          />
          {(canUpload || canApprove) && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? t("app.loading") : t("tec.saveNotes")}
            </Button>
          )}
        </div>
      </div>

      {/* Drawings Section */}
      <div className="space-y-4">
        <h2 className="font-semibold">{t("tec.drawingsSection")}</h2>

        {/* Category Tabs */}
        <div className="border-b">
          <div className="flex flex-wrap" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap",
                  activeCategory === cat
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t(`tec.cat_${cat}`)}
                {activeCategory === cat && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Drawings List */}
        {categoryDrawings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("tec.noDrawings")}</p>
        ) : (
          <div className="space-y-3">
            {categoryDrawings.map((drawing) => {
              const notSelf = !(
                drawing.uploadedByName === (t("app.me") ?? "أنا") &&
                currentRole !== "ADMIN"
              );
              const canApproveThis =
                canApprove && drawing.status === "DRAFT" && notSelf;

              return (
                <div key={drawing.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium truncate">{drawing.originalName}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {drawing.fileType}
                        </Badge>
                        {drawing.label && (
                          <span className="text-xs text-muted-foreground">{drawing.label}</span>
                        )}
                        {drawing.revision && (
                          <span className="text-xs text-muted-foreground">
                            rev. {drawing.revision}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {drawing.url && (
                        <a href={drawing.url} target="_blank" rel="noreferrer">
                          <Button type="button" size="sm" variant="outline" className="text-xs">
                            {t("tec.download")}
                          </Button>
                        </a>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {t(`tec.dstatus_${drawing.status}`)}
                      </Badge>
                      {canApproveThis && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs"
                          disabled={approvingId === drawing.id}
                          onClick={() => handleApprove(drawing)}
                        >
                          {approvingId === drawing.id
                            ? t("app.loading")
                            : t("tec.approveDrawing")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {drawing.notes && (
                    <p className="text-xs text-muted-foreground">{drawing.notes}</p>
                  )}

                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                    <span>
                      {t("tec.uploadedBy")} {drawing.uploadedByName} —{" "}
                      {formatInstantDate(drawing.createdAt)}
                    </span>
                    {drawing.approvedAt && drawing.approvedByName && (
                      <span className="text-green-600">
                        ✅ {t("tec.approvedBy")} {drawing.approvedByName} —{" "}
                        {formatInstantDate(drawing.approvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Form */}
        {canUpload && (
          <div className="border rounded-lg p-5 space-y-4 bg-gray-50">
            <h3 className="text-sm font-semibold">{t("tec.uploadDrawing")}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("tec.category")}</Label>
                <Select
                  value={uploadCategory}
                  onValueChange={(v) => setUploadCategory(v as DrawingCategory)}
                >
                  <SelectTrigger>
                    <SelectValue>{t(`tec.cat_${uploadCategory}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(`tec.cat_${cat}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>{t("tec.fileType")}</Label>
                <Select
                  value={uploadFileType}
                  onValueChange={setUploadFileType}
                >
                  <SelectTrigger>
                    <SelectValue>{uploadFileType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft}>
                        {ft}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="up-label">{t("tec.label")}</Label>
                <Input
                  id="up-label"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="up-revision">{t("tec.revision")}</Label>
                <Input
                  id="up-revision"
                  value={uploadRevision}
                  onChange={(e) => setUploadRevision(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="up-notes">{t("tec.notes")}</Label>
              <Textarea
                id="up-notes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="up-file">{t("tec.selectFile")}</Label>
              <Input
                id="up-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.dwg,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !uploadFile}
            >
              {uploading ? t("app.loading") : t("tec.uploadDrawing")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
