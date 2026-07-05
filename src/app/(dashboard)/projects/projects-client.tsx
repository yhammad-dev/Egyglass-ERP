"use client";

import { useState } from "react";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import {
  createProject,
  updateProject,
  linkQuotationToProject,
  getUnlinkedQuotations,
} from "../../../../lib/projects/actions";

type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

const STATUS_OPTIONS: ProjectStatus[] = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  ON_HOLD: "secondary",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

type Person = { id: string; name: string };

type ProjectRow = {
  id: string;
  nameAr: string;
  customerId: string;
  customerName: string;
  manager: Person | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  quotationsCount: number;
};

type UnlinkedQuotation = { id: string; number: string; customerName: string };

export function ProjectsClient({
  initialProjects,
  managers,
  customers,
}: {
  initialProjects: ProjectRow[];
  managers: Person[];
  customers: Person[];
}) {
  const t = useTranslations();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [customerIdInput, setCustomerIdInput] = useState("");
  const [managerIdInput, setManagerIdInput] = useState("");
  const [statusInput, setStatusInput] = useState<ProjectStatus>("ACTIVE");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkTarget, setLinkTarget] = useState<ProjectRow | null>(null);
  const [unlinkedQuotations, setUnlinkedQuotations] = useState<UnlinkedQuotation[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function openCreate() {
    setEditingProject(null);
    setNameInput("");
    setCustomerIdInput(customers[0]?.id ?? "");
    setManagerIdInput("");
    setStatusInput("ACTIVE");
    setStartDateInput("");
    setEndDateInput("");
    setNotesInput("");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(project: ProjectRow) {
    setEditingProject(project);
    setNameInput(project.nameAr);
    setCustomerIdInput(project.customerId);
    setManagerIdInput(project.manager?.id ?? "");
    setStatusInput(project.status);
    setStartDateInput(project.startDate ? project.startDate.slice(0, 10) : "");
    setEndDateInput(project.endDate ? project.endDate.slice(0, 10) : "");
    setNotesInput(project.notes ?? "");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);

    if (!nameInput.trim() || !customerIdInput) {
      setError(t("errors.required"));
      return;
    }

    setSubmitting(true);

    if (editingProject) {
      const response = await updateProject({
        id: editingProject.id,
        nameAr: nameInput,
        customerId: customerIdInput,
        managerId: managerIdInput || undefined,
        status: statusInput,
        startDate: startDateInput || undefined,
        endDate: endDateInput || undefined,
        notes: notesInput || undefined,
      });
      setSubmitting(false);

      if ("error" in response) {
        setError(t(response.error ?? "errors.invalidInput"));
        return;
      }

      const customerName =
        customers.find((c) => c.id === customerIdInput)?.name ?? editingProject.customerName;
      const manager = managers.find((m) => m.id === managerIdInput) ?? null;

      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                nameAr: nameInput,
                customerId: customerIdInput,
                customerName,
                manager,
                status: statusInput,
                startDate: startDateInput ? new Date(startDateInput).toISOString() : null,
                endDate: endDateInput ? new Date(endDateInput).toISOString() : null,
                notes: notesInput || null,
              }
            : p
        )
      );
      toast.success(t("projects.updated"));
    } else {
      const response = await createProject({
        nameAr: nameInput,
        customerId: customerIdInput,
        managerId: managerIdInput || undefined,
        status: statusInput,
        startDate: startDateInput || undefined,
        endDate: endDateInput || undefined,
        notes: notesInput || undefined,
      });
      setSubmitting(false);

      if ("error" in response) {
        setError(t(response.error ?? "errors.invalidInput"));
        return;
      }

      const customerName = customers.find((c) => c.id === customerIdInput)?.name ?? "";
      const manager = managers.find((m) => m.id === managerIdInput) ?? null;

      setProjects((prev) => [
        {
          id: response.data.id,
          nameAr: nameInput,
          customerId: customerIdInput,
          customerName,
          manager,
          status: statusInput,
          startDate: startDateInput ? new Date(startDateInput).toISOString() : null,
          endDate: endDateInput ? new Date(endDateInput).toISOString() : null,
          notes: notesInput || null,
          quotationsCount: 0,
        },
        ...prev,
      ]);
      toast.success(t("projects.created"));
    }

    setDialogOpen(false);
  }

  async function openLinkDialog(project: ProjectRow) {
    setLinkTarget(project);
    setSelectedQuotationId("");
    setLinkError(null);
    const quotations = await getUnlinkedQuotations(project.customerId);
    setUnlinkedQuotations(quotations);
  }

  async function handleLinkQuotation() {
    if (!linkTarget || !selectedQuotationId) {
      setLinkError(t("errors.required"));
      return;
    }

    setLinking(true);
    const response = await linkQuotationToProject({
      projectId: linkTarget.id,
      quotationId: selectedQuotationId,
    });
    setLinking(false);

    if ("error" in response) {
      setLinkError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === linkTarget.id ? { ...p, quotationsCount: p.quotationsCount + 1 } : p
      )
    );
    toast.success(t("projects.quotationLinked"));
    setLinkTarget(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("projects.title")}</h1>
        <Button type="button" onClick={openCreate}>
          {t("projects.addProject")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("projects.name")}</TableHead>
              <TableHead>{t("projects.customer")}</TableHead>
              <TableHead>{t("projects.manager")}</TableHead>
              <TableHead>{t("projects.status")}</TableHead>
              <TableHead>{t("projects.quotationsCount")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length ? (
              projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>{project.nameAr}</TableCell>
                  <TableCell>{project.customerName}</TableCell>
                  <TableCell>{project.manager?.name ?? t("projects.dash")}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status]}>
                      {t(`projects.status_${project.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{project.quotationsCount}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(project)}
                      >
                        {t("app.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openLinkDialog(project)}
                      >
                        {t("projects.linkQuotation")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? t("projects.editProject") : t("projects.addProject")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nameAr">{t("projects.name")}</Label>
              <Input
                id="nameAr"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("projects.customer")}</Label>
              <Select
                value={customerIdInput}
                onValueChange={(value) => setCustomerIdInput(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {customers.find((c) => c.id === customerIdInput)?.name ??
                      t("projects.selectCustomer")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("projects.manager")}</Label>
              <Select
                value={managerIdInput}
                onValueChange={(value) => setManagerIdInput(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {managers.find((m) => m.id === managerIdInput)?.name ??
                      t("projects.selectManager")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("projects.status")}</Label>
              <Select
                value={statusInput}
                onValueChange={(value) => setStatusInput((value as ProjectStatus) ?? "ACTIVE")}
              >
                <SelectTrigger>
                  <SelectValue>{t(`projects.status_${statusInput}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`projects.status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="startDate">{t("projects.startDate")}</Label>
              <Input
                id="startDate"
                type="date"
                dir="ltr"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">{t("projects.endDate")}</Label>
              <Input
                id="endDate"
                type="date"
                dir="ltr"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">{t("projects.notes")}</Label>
              <Input
                id="notes"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
            <FieldError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleSave} disabled={submitting}>
                {submitting ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link quotation dialog */}
      <Dialog
        open={!!linkTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setLinkTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projects.linkQuotation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("projects.quotation")}</Label>
              <Select
                value={selectedQuotationId}
                onValueChange={(value) => setSelectedQuotationId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {unlinkedQuotations.find((q) => q.id === selectedQuotationId)?.number ??
                      t("projects.selectQuotation")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {unlinkedQuotations.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      <span dir="ltr">{q.number}</span> — {q.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError message={linkError ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLinkTarget(null)}>
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleLinkQuotation} disabled={linking}>
                {linking ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
