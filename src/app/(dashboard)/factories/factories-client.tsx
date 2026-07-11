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
import { FieldError } from "@/components/ui/field-error";
import {
  createFactoryAction,
  updateFactoryAction,
  setFactoryActiveAction,
} from "./actions";

type FactoryRow = {
  id: string;
  name: string;
  code: string;
  contact: string | null;
  notes: string | null;
  isActive: boolean;
};

export function FactoriesClient({
  initialFactories,
}: {
  initialFactories: FactoryRow[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FactoryRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setContact("");
    setNotes("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: FactoryRow) {
    setEditing(row);
    setName(row.name);
    setCode(row.code);
    setContact(row.contact ?? "");
    setNotes(row.notes ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!name.trim() || !code.trim()) {
      setFormError(t("errors.required"));
      return;
    }
    setSubmitting(true);
    const payload = { name, code, contact: contact || undefined, notes: notes || undefined };
    const result = editing
      ? await updateFactoryAction({ id: editing.id, ...payload })
      : await createFactoryAction(payload);
    setSubmitting(false);
    if ("error" in result) {
      setFormError(t(result.error));
      return;
    }
    toast.success(t(editing ? "factories.updated" : "factories.created"));
    setDialogOpen(false);
    router.refresh();
  }

  async function handleToggle(row: FactoryRow) {
    setTogglingId(row.id);
    const result = await setFactoryActiveAction({ id: row.id, isActive: !row.isActive });
    setTogglingId(null);
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    toast.success(t(row.isActive ? "factories.deactivated" : "factories.reactivated"));
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("factories.title")}</h1>
        <Button onClick={openCreate}>{t("factories.newFactory")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("factories.code")}</TableHead>
              <TableHead>{t("factories.name")}</TableHead>
              <TableHead>{t("factories.contact")}</TableHead>
              <TableHead>{t("factories.statusLabel")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialFactories.length ? (
              initialFactories.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <span dir="ltr">{f.code}</span>
                  </TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>{f.contact ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.isActive ? "default" : "secondary"}>
                      {t(f.isActive ? "factories.active" : "factories.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(f)}
                      >
                        {t("app.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={togglingId === f.id}
                        onClick={() => handleToggle(f)}
                      >
                        {t(f.isActive ? "factories.deactivate" : "factories.reactivate")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("factories.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(editing ? "factories.editFactory" : "factories.newFactory")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="f-code">{t("factories.code")}</Label>
              <Input id="f-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-name">{t("factories.name")}</Label>
              <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-contact">{t("factories.contact")}</Label>
              <Input id="f-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-notes">{t("factories.notes")}</Label>
              <Input id="f-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <FieldError message={formError ?? undefined} />
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {t("app.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
