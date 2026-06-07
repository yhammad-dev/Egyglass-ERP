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
    name: z.string().min(1, "الاسم مطلوب"),
    email: z.string().email("بريد إلكتروني غير صالح"),
    password: requirePassword
      ? z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
      : z.string().optional(),
    role: z.string().min(1, "الدور مطلوب"),
    department: z.string().min(1, "القسم مطلوب"),
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
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editingUser;
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
      toast.error("فشل تحديث قائمة المستخدمين");
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
              ? result.error
              : Object.values(result.error).flat().join("، ")
          );
          return;
        }
        toast.success("تم تحديث المستخدم بنجاح");
      } else {
        const result = await createUserAction(formData);
        if (!result.success) {
          toast.error(
            typeof result.error === "string"
              ? result.error
              : Object.values(result.error).flat().join("، ")
          );
          return;
        }
        toast.success("تم إنشاء المستخدم بنجاح");
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
      toast.error(result.error);
    } else {
      toast.success("تم حذف المستخدم بنجاح");
    }
    setDeleteTarget(null);
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
      cell: (info) =>
        info.getValue() ? (
          <Badge variant="default">{t("users.active")}</Badge>
        ) : (
          <Badge variant="secondary">{t("users.suspended")}</Badge>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: t("app.actions"),
      cell: (info) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEdit(info.row.original)}
          >
            {t("app.edit")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget(info.row.original)}
          >
            {t("app.delete")}
          </Button>
        </div>
      ),
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
              {isEditing ? "تعديل مستخدم" : t("users.newUser")}
            </DialogTitle>
          </DialogHeader>
          <form key={editingUser?.id ?? "create"} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">{t("users.name")}</Label>
              <Input id="name" {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">{t("users.email")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                {t("auth.password")}
                {isEditing && (
                  <span className="text-xs text-gray-400 mr-2">
                    (اتركه فارغاً إن لم ترد التغيير)
                  </span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
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
              <FieldError message={errors.role?.message} />
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
              <FieldError message={errors.department?.message} />
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
            هل أنت متأكد من حذف المستخدم &ldquo;{deleteTarget?.name}&rdquo;؟
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
    </div>
  );
}
