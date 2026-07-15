"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  addMeasurementAction,
  deleteMeasurementAction,
  addInspectionAttachment,
  updateInspectionStatus,
  updateSiteReadiness,
} from "../actions";
// تعريف واحد للنوع — مصدره الخدمة (import type يُمحى عند البناء، لا استيراد خادم للعميل)
import type { MeasurementRow } from "@/lib/services/inspection-measurements";

type InspectionStatus = "REQUESTED" | "SCHEDULED" | "DONE" | "OVERDUE";

const STATUS_OPTIONS: InspectionStatus[] = ["REQUESTED", "SCHEDULED", "DONE", "OVERDUE"];

// 1ب (BL-81): وحدات المقاس المهيكل
const UNITS = ["SQM", "CBM"] as const;
type MeasurementUnit = (typeof UNITS)[number];

type InspectionDetail = {
  id: string;
  customer: { id: string; name: string; phone: string };
  location: string;
  address: string;
  phone: string;
  notes: string | null;
  status: InspectionStatus;
  type: string;
  siteReadiness: boolean | null;
  scheduledAt: string | null;
  dueDate: string;
  assignee: { id: string; name: string } | null;
  attachments: {
    id: string;
    fileName: string;
    filePath: string;
    category: "SITE_PHOTO" | "SKETCH" | "OTHER";
    createdAt: string;
  }[];
  measurements: MeasurementRow[];
};

export function InspectionDetailClient({
  inspection: initialInspection,
  currentRole = "",
}: {
  inspection: InspectionDetail;
  currentRole?: string;
}) {
  const t = useTranslations();
  const [inspection, setInspection] = useState(initialInspection);
  const [siteReadiness, setSiteReadiness] = useState<boolean | null>(
    initialInspection.siteReadiness ?? null
  );
  const [updatingSiteReadiness, setUpdatingSiteReadiness] = useState(false);

  // STD-15: هذا إخفاء واجهة فقط — الحارس الحقيقي server-side (MANAGER_ROLES في
  // updateInspectionStatus/updateSiteReadiness) كما هو، لم يُمَس.
  const canManage =
    currentRole === "ADMIN" || currentRole === "INSPECTION_MANAGER";
  const canEditSiteReadiness = canManage;

  async function handleSiteReadiness(value: boolean | null) {
    setUpdatingSiteReadiness(true);
    const result = await updateSiteReadiness({ id: inspection.id, siteReadiness: value });
    setUpdatingSiteReadiness(false);
    if ("error" in result) {
      toast.error(t(result.error ?? "errors.updateFailed"));
      return;
    }
    setSiteReadiness(value);
    toast.success(t("inspections.siteReadinessUpdated"));
  }

  const [descriptionInput, setDescriptionInput] = useState("");
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [unitInput, setUnitInput] = useState<MeasurementUnit>("SQM");
  const [quantityInput, setQuantityInput] = useState("1");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentCategory, setAttachmentCategory] =
    useState<"SITE_PHOTO" | "SKETCH">("SITE_PHOTO");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [savingAttachment, setSavingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  async function handleAddMeasurement() {
    setMeasurementError(null);
    const width = Number(widthInput);
    const height = Number(heightInput);
    const quantity = Number(quantityInput);

    if (!descriptionInput.trim()) {
      setMeasurementError(t("errors.required"));
      return;
    }
    if (
      Number.isNaN(width) ||
      width <= 0 ||
      Number.isNaN(height) ||
      height <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setMeasurementError(t("errors.invalidInput"));
      return;
    }

    setSavingMeasurement(true);
    const response = await addMeasurementAction({
      inspectionRequestId: inspection.id,
      description: descriptionInput.trim(),
      width,
      height,
      unit: unitInput,
      quantity,
      notes: measurementNotes || undefined,
    });
    setSavingMeasurement(false);

    if ("error" in response) {
      setMeasurementError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      measurements: [...prev.measurements, response.data],
    }));
    setDescriptionInput("");
    setWidthInput("");
    setHeightInput("");
    setQuantityInput("1");
    setMeasurementNotes("");
    toast.success(t("inspections.detail.measurementsAdded"));
  }

  async function handleDeleteMeasurement(measurementId: string) {
    setMeasurementError(null);
    setDeletingMeasurementId(measurementId);
    const response = await deleteMeasurementAction({ measurementId });
    setDeletingMeasurementId(null);

    if ("error" in response) {
      setMeasurementError(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.id !== measurementId),
    }));
    toast.success(t("inspections.detail.measurementDeleted"));
  }

  async function handleAddAttachment() {
    setAttachmentError(null);

    if (!attachmentFile) {
      setAttachmentError(t("errors.required"));
      return;
    }
    if (!attachmentFile.type.startsWith("image/")) {
      setAttachmentError(t("errors.invalidFileType"));
      return;
    }

    setSavingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(attachmentFile);
      });

      const response = await addInspectionAttachment({
        id: inspection.id,
        category: attachmentCategory,
        originalName: attachmentFile.name,
        base64,
      });

      if ("error" in response) {
        setAttachmentError(t(response.error ?? "errors.invalidInput"));
        return;
      }

      setInspection((prev) => ({
        ...prev,
        attachments: [response.data, ...prev.attachments],
      }));
      setAttachmentFile(null);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      toast.success(t("inspections.detail.attachmentAdded"));
    } catch {
      setAttachmentError(t("errors.serverError"));
    } finally {
      setSavingAttachment(false);
    }
  }

  async function handleStatusChange(status: InspectionStatus) {
    if (status === inspection.status) return;

    setUpdatingStatus(true);
    const response = await updateInspectionStatus({ id: inspection.id, status });
    setUpdatingStatus(false);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setInspection((prev) => ({ ...prev, status }));
    toast.success(t("inspections.detail.statusUpdated"));
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{inspection.customer.name}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {inspection.customer.phone}
          </p>
          <p className="text-sm">{inspection.address}</p>
        </div>
        <Badge variant="outline">{t(`inspections.status_${inspection.status}`)}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xl text-sm">
        <div>
          <p className="text-muted-foreground">{t("inspections.type")}</p>
          <p>{t(`inspections.type_${inspection.type}`)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.location")}</p>
          <p>
            {t(`inspections.${inspection.location === "OUTSIDE_CAIRO" ? "outsideCairo" : "insideCairo"}`)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.dueDate")}</p>
          <p dir="ltr">{dateFormat.format(new Date(inspection.dueDate))}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.scheduledAt")}</p>
          <p dir="ltr">
            {inspection.scheduledAt
              ? dateFormat.format(new Date(inspection.scheduledAt))
              : t("inspections.dash")}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.assignee")}</p>
          <p>{inspection.assignee?.name ?? t("inspections.dash")}</p>
        </div>
      </div>

      {inspection.notes && (
        <div className="max-w-xl">
          <p className="text-sm text-muted-foreground">{t("inspections.notes")}</p>
          <p className="text-sm">{inspection.notes}</p>
        </div>
      )}

      {canManage && (
        <div className="space-y-2 max-w-xs">
          <Label>{t("inspections.detail.updateStatus")}</Label>
          <Select
            value={inspection.status}
            onValueChange={(value) => handleStatusChange((value as InspectionStatus) ?? inspection.status)}
            disabled={updatingStatus}
          >
            <SelectTrigger>
              <SelectValue>{t(`inspections.status_${inspection.status}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`inspections.status_${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2 max-w-xs">
        <Label>{t("inspections.siteReadiness")}</Label>
        {canEditSiteReadiness ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={siteReadiness === true ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness(true)}
            >
              ✅ {t("inspections.siteReady")}
            </Button>
            <Button
              type="button"
              variant={siteReadiness === false ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness(false)}
            >
              ❌ {t("inspections.siteNotReady")}
            </Button>
            <Button
              type="button"
              variant={siteReadiness === null ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness(null)}
            >
              — {t("inspections.siteReadinessUnknown")}
            </Button>
          </div>
        ) : (
          <p className="text-sm">
            {siteReadiness === true
              ? t("inspections.siteReady")
              : siteReadiness === false
              ? t("inspections.siteNotReady")
              : t("inspections.siteReadinessUnknown")}
          </p>
        )}
      </div>

      <div className="space-y-3 max-w-3xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.measurements")}</h2>

        {/* 1ب (BL-81): جدول الصفوف المهيكلة — المصدر InspectionMeasurement */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-start">{t("inspections.detail.description")}</th>
                <th className="p-2 text-start">{t("inspections.detail.width")}</th>
                <th className="p-2 text-start">{t("inspections.detail.height")}</th>
                <th className="p-2 text-start">{t("inspections.detail.unit")}</th>
                <th className="p-2 text-start">{t("inspections.detail.quantity")}</th>
                <th className="p-2 text-start">{t("inspections.notes")}</th>
                <th className="p-2 text-start">{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {inspection.measurements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    {t("inspections.detail.noMeasurements")}
                  </td>
                </tr>
              ) : (
                inspection.measurements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{m.description}</td>
                    <td className="p-2" dir="ltr">{m.width}</td>
                    <td className="p-2" dir="ltr">{m.height}</td>
                    <td className="p-2">{t(`inspections.detail.unit_${m.unit}`)}</td>
                    <td className="p-2" dir="ltr">{m.quantity}</td>
                    <td className="p-2 text-muted-foreground">{m.notes ?? "—"}</td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingMeasurementId === m.id}
                        onClick={() => handleDeleteMeasurement(m.id)}
                      >
                        {t("app.delete")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* صف جديد */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label htmlFor="description">{t("inspections.detail.description")}</Label>
            <Input
              id="description"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="width">{t("inspections.detail.width")}</Label>
            <Input
              id="width"
              type="number"
              dir="ltr"
              step="0.001"
              value={widthInput}
              onChange={(e) => setWidthInput(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="height">{t("inspections.detail.height")}</Label>
            <Input
              id="height"
              type="number"
              dir="ltr"
              step="0.001"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("inspections.detail.unit")}</Label>
            <Select
              value={unitInput}
              onValueChange={(v) => setUnitInput((v as MeasurementUnit) ?? "SQM")}
            >
              <SelectTrigger>
                <SelectValue>{t(`inspections.detail.unit_${unitInput}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {t(`inspections.detail.unit_${u}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity">{t("inspections.detail.quantity")}</Label>
            <Input
              id="quantity"
              type="number"
              dir="ltr"
              step="1"
              min="1"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="measurementNotes">{t("inspections.notes")}</Label>
          <Textarea
            id="measurementNotes"
            value={measurementNotes}
            onChange={(e) => setMeasurementNotes(e.target.value)}
          />
        </div>
        {measurementError && <p className="text-sm text-red-500">{measurementError}</p>}
        <Button type="button" onClick={handleAddMeasurement} disabled={savingMeasurement}>
          {savingMeasurement ? t("app.loading") : t("inspections.detail.addMeasurements")}
        </Button>
      </div>

      <div className="space-y-3 max-w-xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.attachments")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="attachmentType">
              {t("inspections.detail.attachmentType")}
            </Label>
            <Select
              value={attachmentCategory}
              onValueChange={(v) =>
                setAttachmentCategory(v as "SITE_PHOTO" | "SKETCH")
              }
            >
              <SelectTrigger id="attachmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SITE_PHOTO">
                  {t("inspections.detail.categorySitePhoto")}
                </SelectItem>
                <SelectItem value="SKETCH">
                  {t("inspections.detail.categorySketch")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="attachmentFile">
              {t("inspections.detail.chooseFile")}
            </Label>
            <Input
              id="attachmentFile"
              type="file"
              accept="image/*"
              ref={attachmentInputRef}
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        {attachmentError && <p className="text-sm text-red-500">{attachmentError}</p>}
        <Button
          type="button"
          onClick={handleAddAttachment}
          disabled={savingAttachment || !attachmentFile}
        >
          {savingAttachment ? t("app.loading") : t("inspections.detail.addAttachment")}
        </Button>

        {inspection.attachments.length > 0 && (
          <div className="space-y-4 pt-2">
            {(["SITE_PHOTO", "SKETCH", "OTHER"] as const).map((cat) => {
              const items = inspection.attachments.filter(
                (a) => a.category === cat
              );
              if (items.length === 0) return null;
              const label =
                cat === "SITE_PHOTO"
                  ? t("inspections.detail.categorySitePhotos")
                  : cat === "SKETCH"
                  ? t("inspections.detail.categorySketches")
                  : t("inspections.detail.categoryOther");
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {label}
                  </h3>
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className="text-sm border rounded-md p-2 flex justify-between items-center gap-2"
                    >
                      <span className="truncate">{a.fileName}</span>
                      <a
                        href={a.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="text-blue-600 underline shrink-0"
                      >
                        {t("inspections.detail.viewFile")}
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
