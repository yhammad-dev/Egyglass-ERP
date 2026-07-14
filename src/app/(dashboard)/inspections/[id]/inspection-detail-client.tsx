"use client";

import { useState } from "react";
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
  addMeasurements,
  addInspectionAttachment,
  updateInspectionStatus,
  updateSiteReadiness,
} from "../actions";

type InspectionStatus = "REQUESTED" | "SCHEDULED" | "DONE" | "OVERDUE";

const STATUS_OPTIONS: InspectionStatus[] = ["REQUESTED", "SCHEDULED", "DONE", "OVERDUE"];

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
  attachments: { id: string; fileName: string; filePath: string; createdAt: string }[];
  measurements: {
    id: string;
    details: { width: number; height: number; notes: string | null } | null;
    createdAt: string;
  }[];
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

  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [fileName, setFileName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [savingAttachment, setSavingAttachment] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  async function handleAddMeasurements() {
    setMeasurementError(null);
    const width = Number(widthInput);
    const height = Number(heightInput);

    if (Number.isNaN(width) || width <= 0 || Number.isNaN(height) || height <= 0) {
      setMeasurementError(t("errors.invalidInput"));
      return;
    }

    setSavingMeasurement(true);
    const response = await addMeasurements({
      id: inspection.id,
      width,
      height,
      notes: measurementNotes || undefined,
    });
    setSavingMeasurement(false);

    if ("error" in response) {
      setMeasurementError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      measurements: [
        {
          id: `${Date.now()}`,
          details: { width, height, notes: measurementNotes || null },
          createdAt: new Date().toISOString(),
        },
        ...prev.measurements,
      ],
    }));
    setWidthInput("");
    setHeightInput("");
    setMeasurementNotes("");
    toast.success(t("inspections.detail.measurementsAdded"));
  }

  async function handleAddAttachment() {
    setAttachmentError(null);

    if (!fileName.trim() || !filePath.trim()) {
      setAttachmentError(t("errors.required"));
      return;
    }

    setSavingAttachment(true);
    const response = await addInspectionAttachment({
      id: inspection.id,
      fileName,
      filePath,
    });
    setSavingAttachment(false);

    if ("error" in response) {
      setAttachmentError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      attachments: [response.data, ...prev.attachments],
    }));
    setFileName("");
    setFilePath("");
    toast.success(t("inspections.detail.attachmentAdded"));
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

      <div className="space-y-3 max-w-xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.measurements")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="width">{t("inspections.detail.width")}</Label>
            <Input
              id="width"
              type="number"
              dir="ltr"
              step="0.01"
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
              step="0.01"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
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
        <Button type="button" onClick={handleAddMeasurements} disabled={savingMeasurement}>
          {savingMeasurement ? t("app.loading") : t("inspections.detail.addMeasurements")}
        </Button>

        {inspection.measurements.length > 0 && (
          <div className="space-y-2 pt-2">
            {inspection.measurements.map((m) => (
              <div key={m.id} className="text-sm border rounded-md p-2">
                {m.details && (
                  <p dir="ltr">
                    {m.details.width} × {m.details.height}
                  </p>
                )}
                {m.details?.notes && <p className="text-muted-foreground">{m.details.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  {dateFormat.format(new Date(m.createdAt))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 max-w-xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.attachments")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="fileName">{t("inspections.detail.fileName")}</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filePath">{t("inspections.detail.filePath")}</Label>
            <Input
              id="filePath"
              dir="ltr"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder={t("inspections.detail.filePathPlaceholder")}
            />
          </div>
        </div>
        {attachmentError && <p className="text-sm text-red-500">{attachmentError}</p>}
        <Button type="button" onClick={handleAddAttachment} disabled={savingAttachment}>
          {savingAttachment ? t("app.loading") : t("inspections.detail.addAttachment")}
        </Button>

        {inspection.attachments.length > 0 && (
          <div className="space-y-2 pt-2">
            {inspection.attachments.map((a) => (
              <div key={a.id} className="text-sm border rounded-md p-2 flex justify-between">
                <span>{a.fileName}</span>
                <span dir="ltr" className="text-muted-foreground">
                  {a.filePath}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
