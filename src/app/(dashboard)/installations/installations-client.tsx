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
  scheduleInstallation,
  updateInstStatus,
} from "../../../../lib/installations/actions";

type InstStatus = "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const STATUS_OPTIONS: InstStatus[] = [
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_VARIANT: Record<InstStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

type TeamLead = { id: string; name: string };

type InstallationOrderRow = {
  id: string;
  quotationNumber: string;
  customerName: string;
  teamLead: TeamLead | null;
  scheduledAt: string | null;
  status: InstStatus;
};

export function InstallationsClient({
  initialOrders,
  teamLeads,
}: {
  initialOrders: InstallationOrderRow[];
  teamLeads: TeamLead[];
}) {
  const t = useTranslations();
  const [orders, setOrders] = useState<InstallationOrderRow[]>(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [scheduleTarget, setScheduleTarget] = useState<InstallationOrderRow | null>(null);
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [teamLeadId, setTeamLeadId] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function openSchedule(order: InstallationOrderRow) {
    setScheduleTarget(order);
    setScheduledAtInput(order.scheduledAt ? order.scheduledAt.slice(0, 10) : "");
    setTeamLeadId(order.teamLead?.id ?? "");
    setScheduleError(null);
  }

  async function handleScheduleSubmit() {
    if (!scheduleTarget) return;
    setScheduleError(null);

    if (!scheduledAtInput || !teamLeadId) {
      setScheduleError(t("errors.required"));
      return;
    }

    setSubmitting(true);
    const response = await scheduleInstallation({
      id: scheduleTarget.id,
      teamLeadId,
      scheduledAt: scheduledAtInput,
    });
    setSubmitting(false);

    if ("error" in response) {
      setScheduleError(t(response.error ?? "errors.updateFailed"));
      return;
    }

    const teamLead = teamLeads.find((u) => u.id === teamLeadId) ?? null;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === scheduleTarget.id
          ? {
              ...o,
              teamLead,
              scheduledAt: new Date(scheduledAtInput).toISOString(),
              status: "SCHEDULED",
            }
          : o
      )
    );
    toast.success(t("installations.scheduled"));
    setScheduleTarget(null);
  }

  async function handleStatusChange(order: InstallationOrderRow, status: InstStatus) {
    if (status === order.status) return;

    setUpdatingId(order.id);
    const response = await updateInstStatus({ id: order.id, status });
    setUpdatingId(null);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status } : o))
    );
    toast.success(t("installations.statusUpdated"));
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("installations.title")}</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("installations.customer")}</TableHead>
              <TableHead>{t("installations.scheduledAt")}</TableHead>
              <TableHead>{t("installations.teamLead")}</TableHead>
              <TableHead>{t("installations.status")}</TableHead>
              <TableHead>{t("app.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length ? (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    {/* دفعة ج: صفحة الأمر (بنود/صور/فريق) */}
                    <a href={`/installations/${order.id}`} className="underline underline-offset-2">
                      {order.customerName}
                    </a>
                  </TableCell>
                  <TableCell>
                    {order.scheduledAt
                      ? dateFormat.format(new Date(order.scheduledAt))
                      : t("installations.dash")}
                  </TableCell>
                  <TableCell>{order.teamLead?.name ?? t("installations.dash")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[order.status]}>
                        {t(`installations.status_${order.status}`)}
                      </Badge>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order, value as InstStatus)
                        }
                        disabled={updatingId === order.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue>
                            {t(`installations.status_${order.status}`)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(`installations.status_${option}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openSchedule(order)}
                    >
                      {t("installations.schedule")}
                    </Button>
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

      <Dialog
        open={!!scheduleTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setScheduleTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("installations.schedule")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="scheduledAt">{t("installations.scheduledAt")}</Label>
              <Input
                id="scheduledAt"
                type="date"
                dir="ltr"
                value={scheduledAtInput}
                onChange={(e) => setScheduledAtInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("installations.teamLead")}</Label>
              <Select
                value={teamLeadId}
                onValueChange={(value) => setTeamLeadId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {teamLeads.find((u) => u.id === teamLeadId)?.name ??
                      t("installations.selectTeamLead")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teamLeads.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError message={scheduleError ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleTarget(null)}
              >
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleScheduleSubmit} disabled={submitting}>
                {submitting ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
