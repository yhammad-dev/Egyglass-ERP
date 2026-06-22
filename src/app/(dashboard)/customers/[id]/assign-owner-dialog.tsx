"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { SalesRepOption } from "@/lib/services/customers";

export function AssignOwnerDialog({
  customerId,
  currentOwnerId,
  currentOwnerName,
  salesReps,
  onAssigned,
}: {
  customerId: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  salesReps: SalesRepOption[];
  onAssigned: () => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(currentOwnerId ?? "none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const { assignCustomer } = await import("@/lib/actions/customers");

    const result = await assignCustomer({
      customerId,
      ownerId: ownerId === "none" ? null : ownerId,
    });

    setSubmitting(false);

    if ("error" in result) {
      setError(t(result.error));
      return;
    }

    setOpen(false);
    onAssigned();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {t("customers.assignOwner")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("customers.assignOwner")}</DialogTitle>
          <DialogDescription>
            {currentOwnerName
              ? `${t("customers.currentOwner")}: ${currentOwnerName}`
              : t("customers.currentOwner")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("customers.selectOwner")}</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue>
                  {ownerId === "none"
                    ? "—"
                    : salesReps.find((r) => r.id === ownerId)?.name ?? "—"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("customers.cancel")}
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("app.loading") : t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
