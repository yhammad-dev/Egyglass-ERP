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
import {
  updateJobNotesAction,
  uploadDrawingAction,
  approveDrawingAction,
  verifyDrawingAction,
  ceoApproveDrawingAction,
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
  // دفعة ب — بوابتا G2/G3 (W-05)
  const canVerify = currentRole === "ADMIN" || currentRole === "INSPECTION_MANAGER";
  const canCeoApprove = currentRole === "ADMIN";

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

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

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

  // دفعة ب — G2: تحقق مدير المعاينات (قد يُفرج مباشرة تحت العتبة)
  async function handleVerify(drawing: DrawingRow) {
    setApprovingId(drawing.id);
    const result = await verifyDrawingAction({ drawingId: drawing.id });
    setApprovingId(null);
    if ("error" in result) {
      toast.error(t(result.error ?? "errors.serverError"));
      return;
    }
    const newStatus = result.released ? "RELEASED_TO_FACTORY" : "INS_VERIFIED";
    setDrawings((prev) =>
      prev.map((d) => (d.id === drawing.id ? { ...d, status: newStatus } : d))
    );
    toast.success(t(result.released ? "tec.drawingReleased" : "tec.drawingVerified"));
  }

  // دفعة ب — G3: اعتماد CEO (فوق العتبة) ثم إفراج
  async function handleCeoApprove(drawing: DrawingRow) {
    setApprovingId(drawing.id);
    const result = await ceoApproveDrawingAction({ drawingId: drawing.id });
    setApprovingId(null);
    if ("error" in result) {
      toast.error(t(result.error ?? "errors.serverError"));
      return;
    }
    setDrawings((prev) =>
      prev.map((d) => (d.id === drawing.id ? { ...d, status: "RELEASED_TO_FACTORY" } : d))
    );
    toast.success(t("tec.drawingReleased"));
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
              const canVerifyThis =
                canVerify && drawing.status === "TEC_APPROVED" && notSelf;
              const canCeoThis =
                canCeoApprove && drawing.status === "INS_VERIFIED" && notSelf;

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
                      {canVerifyThis && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs"
                          disabled={approvingId === drawing.id}
                          onClick={() => handleVerify(drawing)}
                        >
                          {t("tec.verifyDrawing")}
                        </Button>
                      )}
                      {canCeoThis && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs"
                          disabled={approvingId === drawing.id}
                          onClick={() => handleCeoApprove(drawing)}
                        >
                          {t("tec.ceoApproveDrawing")}
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
                      {dateFormat.format(new Date(drawing.createdAt))}
                    </span>
                    {drawing.approvedAt && drawing.approvedByName && (
                      <span className="text-green-600">
                        ✅ {t("tec.approvedBy")} {drawing.approvedByName} —{" "}
                        {dateFormat.format(new Date(drawing.approvedAt))}
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
