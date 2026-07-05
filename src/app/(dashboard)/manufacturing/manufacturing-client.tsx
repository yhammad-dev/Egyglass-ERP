"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { updateMfgStatus } from "../../../../lib/manufacturing/actions";

type MfgStatus = "PENDING" | "IN_PRODUCTION" | "READY" | "DELIVERED";

const STATUS_OPTIONS: MfgStatus[] = [
  "PENDING",
  "IN_PRODUCTION",
  "READY",
  "DELIVERED",
];

const STATUS_VARIANT: Record<MfgStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  IN_PRODUCTION: "secondary",
  READY: "default",
  DELIVERED: "default",
};

type MfgOrderRow = {
  id: string;
  quotationId: string;
  number: string;
  customerName: string;
  status: MfgStatus;
  expectedAt: string | null;
  createdAt: string;
};

export function ManufacturingClient({
  initialOrders,
}: {
  initialOrders: MfgOrderRow[];
}) {
  const t = useTranslations();
  const [orders, setOrders] = useState<MfgOrderRow[]>(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  async function handleStatusChange(order: MfgOrderRow, status: MfgStatus) {
    if (status === order.status) return;

    setUpdatingId(order.id);
    const response = await updateMfgStatus({ id: order.id, status });
    setUpdatingId(null);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status } : o))
    );
    toast.success(t("manufacturing.statusUpdated"));
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("manufacturing.title")}</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("manufacturing.number")}</TableHead>
              <TableHead>{t("manufacturing.customer")}</TableHead>
              <TableHead>{t("manufacturing.status")}</TableHead>
              <TableHead>{t("manufacturing.expectedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length ? (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <span dir="ltr">{order.number}</span>
                  </TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[order.status]}>
                        {t(`manufacturing.status_${order.status}`)}
                      </Badge>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order, value as MfgStatus)
                        }
                        disabled={updatingId === order.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue>
                            {t(`manufacturing.status_${order.status}`)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(`manufacturing.status_${option}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.expectedAt
                      ? dateFormat.format(new Date(order.expectedAt))
                      : t("manufacturing.dash")}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
