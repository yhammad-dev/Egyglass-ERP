"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
import { getAuditLogs } from "../../../../lib/audit/actions";

type AuditLogRow = {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

type AuditResult = {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

type Person = { id: string; name: string };

export function AuditClient({
  initialResult,
  users,
  entityTypes,
}: {
  initialResult: AuditResult;
  users: Person[];
  entityTypes: string[];
}) {
  const t = useTranslations();
  const [result, setResult] = useState<AuditResult>(initialResult);
  const [userId, setUserId] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPending, startTransition] = useTransition();

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function refetch(page: number, overrides?: Partial<{ userId: string; entityType: string; dateFrom: string; dateTo: string }>) {
    const effective = {
      userId: overrides?.userId ?? userId,
      entityType: overrides?.entityType ?? entityType,
      dateFrom: overrides?.dateFrom ?? dateFrom,
      dateTo: overrides?.dateTo ?? dateTo,
    };

    startTransition(async () => {
      const next = await getAuditLogs(
        {
          userId: effective.userId !== "all" ? effective.userId : undefined,
          entityType: effective.entityType !== "all" ? effective.entityType : undefined,
          dateFrom: effective.dateFrom || undefined,
          dateTo: effective.dateTo || undefined,
        },
        page
      );
      setResult(next);
    });
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t("audit.title")}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48 space-y-1">
          <Label>{t("audit.filterByUser")}</Label>
          <Select
            value={userId}
            onValueChange={(v) => {
              const next = v ?? "all";
              setUserId(next);
              refetch(1, { userId: next });
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {userId === "all"
                  ? t("audit.allUsers")
                  : users.find((u) => u.id === userId)?.name ?? t("audit.allUsers")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("audit.allUsers")}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48 space-y-1">
          <Label>{t("audit.filterByEntityType")}</Label>
          <Select
            value={entityType}
            onValueChange={(v) => {
              const next = v ?? "all";
              setEntityType(next);
              refetch(1, { entityType: next });
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {entityType === "all" ? t("audit.allEntityTypes") : entityType}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("audit.allEntityTypes")}</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44 space-y-1">
          <Label htmlFor="dateFrom">{t("audit.dateFrom")}</Label>
          <Input
            id="dateFrom"
            type="date"
            dir="ltr"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              refetch(1, { dateFrom: e.target.value });
            }}
          />
        </div>

        <div className="w-44 space-y-1">
          <Label htmlFor="dateTo">{t("audit.dateTo")}</Label>
          <Input
            id="dateTo"
            type="date"
            dir="ltr"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              refetch(1, { dateTo: e.target.value });
            }}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("audit.user")}</TableHead>
              <TableHead>{t("audit.action")}</TableHead>
              <TableHead>{t("audit.entityType")}</TableHead>
              <TableHead>{t("audit.entityId")}</TableHead>
              <TableHead>{t("audit.date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.logs.length ? (
              result.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.userName}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell>
                    <span dir="ltr">{log.entityId}</span>
                  </TableCell>
                  <TableCell>{dateFormat.format(new Date(log.createdAt))}</TableCell>
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

      {result.logs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("audit.pageInfo", { current: result.page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || result.page <= 1}
              onClick={() => refetch(result.page - 1)}
            >
              {t("audit.prevPage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || result.page >= totalPages}
              onClick={() => refetch(result.page + 1)}
            >
              {t("audit.nextPage")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
