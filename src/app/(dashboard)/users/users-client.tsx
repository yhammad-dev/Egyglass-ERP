"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
  reactivateUserAction,
  listUsersAction,
} from "./actions";
import type { UserRow } from "@/lib/services/users";

type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
};

const ROLES = [
  "ADMIN",
  "SALES_MANAGER",
  "SALES_REP",
  "INSPECTION_MANAGER",
  "VIEWER",
] as const;

const DEPARTMENTS = [
  "EXECUTIVE",
  "SALES",
  "INSPECTIONS",
  "TECHNICAL_OFFICE",
  "PROJECTS",
] as const;

function buildFormSchema(requirePassword: boolean) {
  return z.object({
    name: z.string().min(1, "errors.required"),
    email: z.string().email("errors.emailInvalid"),
    password: requirePassword
      ? z.string().min(6, "errors.passwordMinLength")
      : z.string().optional(),
    role: z.string().min(1, "errors.required"),
    department: z.string().min(1, "errors.required"),
  });
}

const columnHelper = createColumnHelper<UserRow>();

export function UsersClient({
  initialUsers,
}: {
  initialUsers: UserRow[];
}) {
  const t = useTranslations();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editingUser;
  const fe = (err: { message?: string } | undefined) =>
    err?.message ? t(err.message) : undefined;
  const formSchema = buildFormSchema(!isEditing);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
  });

  function openCreate() {
    setEditingUser(null);
    reset({ name: "", email: "", password: "", role: "", department: "" });
    setOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    reset({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department,
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingUser(null);
    reset();
  }

  async function refreshUsers() {
    try {
      const fresh = await listUsersAction();
      setUsers(fresh);
    } catch {
      toast.error(t("errors.refreshFailed"));
    }
  }

  async function onSubmit(formData: UserFormData) {
    setSubmitting(true);
    try {
      if (isEditing) {
        const result = await updateUserAction({
          id: editingUser!.id,
          ...formData,
        });
        if (!result.success) {
          toast.error(
            typeof result.error === "string"
              ? t(result.error)
              : Object.values(result.error).flat().map(k => t(k)).join("، ")
          );
          return;
        }
        toast.success(t("users.updated"));
      } else {
        const result = await createUserAction(formData);
        if (!result.success) {
          toast.error(
            typeof result.error === "string"
              ? t(result.error)
              : Object.values(result.error).flat().map(k => t(k)).join("، ")
          );
          return;
        }
        toast.success(t("users.created"));
      }
      closeDialog();
      await refreshUsers();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteUserAction(deleteTarget.id);
    if (!result.success) {
      toast.error(t(result.error));
    } else {
      toast.success(t("users.deletedMsg"));
    }
    setDeleteTarget(null);
    await refreshUsers();
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return;
    const result = await reactivateUserAction(reactivateTarget.id);
    if (!result.success) {
      toast.error(t(result.error));
    } else {
      toast.success(t("users.reactivatedMsg"));
    }
    setReactivateTarget(null);
    await refreshUsers();
  }

  const columns = [
    columnHelper.accessor("name", {
      header: t("users.name"),
    }),
    columnHelper.accessor("email", {
      header: t("users.email"),
    }),
    columnHelper.accessor("role", {
      header: t("users.role"),
      cell: (info) => t(`roles.${info.getValue()}`),
    }),
    columnHelper.accessor("department", {
      header: t("users.department"),
      cell: (info) => t(`departments.${info.getValue()}`),
    }),
    columnHelper.accessor("isActive", {
      header: t("users.status"),
      cell: (info) => {
        const row = info.row.original;
        if (row.deletedAt) return <Badge variant="destructive">{t("users.deleted")}</Badge>;
        return info.getValue() ? (
          <Badge variant="default">{t("users.active")}</Badge>
        ) : (
          <Badge variant="secondary">{t("users.suspended")}</Badge>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: t("app.actions"),
      cell: (info) => {
        const row = info.row.original;
        if (row.deletedAt) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReactivateTarget(row)}
            >
              {t("users.reactivate")}
            </Button>
          );
        }
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row)}
            >
              {t("app.edit")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget(row)}
            >
              {t("app.delete")}
            </Button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Button onClick={openCreate}>{t("users.newUser")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-gray-500 py-8"
                >
                  {t("app.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("users.editUser") : t("users.newUser")}
            </DialogTitle>
          </DialogHeader>
          <form key={editingUser?.id ?? "create"} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">{t("users.name")}</Label>
              <Input id="name" {...register("name")} />
              <FieldError message={fe(errors.name)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">{t("users.email")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                {...register("email")}
              />
              <FieldError message={fe(errors.email)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                {t("auth.password")}
                {isEditing && (
                  <span className="text-xs text-gray-400 mr-2">
                    {t("users.passwordHintEmpty")}
                  </span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                {...register("password")}
              />
              <FieldError message={fe(errors.password)} />
            </div>

            <div className="space-y-1">
              <Label>{t("users.role")}</Label>
              <Select
                onValueChange={(v) => setValue("role", v)}
                defaultValue={editingUser?.role}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("users.role")} />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fe(errors.role)} />
            </div>

            <div className="space-y-1">
              <Label>{t("users.department")}</Label>
              <Select
                onValueChange={(v) => setValue("department", v)}
                defaultValue={editingUser?.department}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("users.department")} />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`departments.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fe(errors.department)} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
                {t("app.cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? `${t("app.save")}...` : t("app.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.confirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            {t("users.confirmDelete", { name: deleteTarget?.name })}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              {t("app.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("app.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reactivate Confirmation Dialog */}
      <Dialog
        open={!!reactivateTarget}
        onOpenChange={(open) => !open && setReactivateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.confirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            {t("users.confirmReactivate", { name: reactivateTarget?.name })}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setReactivateTarget(null)}
            >
              {t("app.cancel")}
            </Button>
            <Button variant="default" onClick={confirmReactivate}>
              {t("users.reactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
