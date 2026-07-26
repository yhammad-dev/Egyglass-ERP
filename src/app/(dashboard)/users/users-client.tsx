"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
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
  unlockUserAction,
  listUsersAction,
} from "./actions";
import type { UserRow } from "@/lib/services/users";

type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  // TO-23-B: مسار تيم ليدر المكتب الفني — "" = لم يُختر. يتحوّل إلى null قبل الإرسال.
  leadRoute: string;
  // TO-25: تيم ليدر المهندس — "" = بلا تيم ليدر (حالة صالحة، ليست خطأ).
  teamLeadId: string;
};

const ROLES = [
  "ADMIN",
  "SALES_MANAGER",
  "SALES_REP",
  "INSPECTION_MANAGER",
  "INSPECTION_REP",
  "VIEWER",
  "REVIEW",
  "PROCUREMENT",
  "INSTALLATIONS",
  "ACCOUNTING",
  "HR",
  "PROJECTS",
  "TECHNICAL_OFFICE",
  "TEC_APPROVER",
  "TEC_LEAD",
] as const;

// TO-23-B: قيم `enum TechnicalRoute` كما هي في السكيما — لا قيم مخترعة.
const LEAD_ROUTES = ["PROJECTS", "SOCIAL_MEDIA"] as const;
const TEC_LEAD_ROLE = "TEC_LEAD";
// TO-25: دور المهندس الذي يُربط بتيم ليدر.
const TEC_ENGINEER_ROLE = "TECHNICAL_OFFICE";

const DEPARTMENTS = [
  "EXECUTIVE",
  "SALES",
  "INSPECTIONS",
  "TECHNICAL_OFFICE",
  "PROJECTS",
  "PROCUREMENT",
  "INSTALLATIONS",
  "ACCOUNTING",
  "HR",
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
    leadRoute: z.string().optional(),
    // TO-25: اختياري بلا refine — مهندس بلا تيم ليدر حالة صالحة (SCR-022).
    teamLeadId: z.string().optional(),
  })
  // TO-23-B: مرآة للتحقق الخادمي (users/actions.ts) — راحة للمستخدم لا بديلًا عنه.
  .superRefine((v, ctx) => {
    if (v.role === TEC_LEAD_ROLE && !v.leadRoute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leadRoute"],
        message: "errors.leadRouteRequired",
      });
    }
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
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(formSchema) as Resolver<UserFormData>,
  });

  // TO-23-B: الدور مُراقَب ليظهر حقل المسار **شرطيًا** — لا حقل دائم يربك بقية الأدوار.
  const selectedRole = watch("role");
  const isTecLead = selectedRole === TEC_LEAD_ROLE;
  // TO-25: حقل التيم ليدر يظهر للمهندس فقط، وقائمته = مستخدمو TEC_LEAD النشطون.
  // مشتقّة من `users` المحمّلة سلفًا — بلا استعلام إضافي.
  const isTecEngineer = selectedRole === TEC_ENGINEER_ROLE;
  const teamLeadOptions = useMemo(
    () => users.filter((u) => u.role === TEC_LEAD_ROLE && u.isActive && !u.deletedAt),
    [users]
  );

  function openCreate() {
    setEditingUser(null);
    reset({
      name: "", email: "", password: "", role: "", department: "",
      leadRoute: "", teamLeadId: "",
    });
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
      leadRoute: user.leadRoute ?? "",
      teamLeadId: user.teamLeadId ?? "",
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
      // TO-23-B: "" ليست قيمة صالحة في enum — تتحوّل إلى null. ودور غير TEC_LEAD
      // يُرسَل بـnull دائمًا فلا تبقى قيمة قديمة. (السيرفر يعيد فرض هذا — لا يثق بنا.)
      const payload = {
        ...formData,
        leadRoute: formData.role === TEC_LEAD_ROLE ? formData.leadRoute || null : null,
        // TO-25: نفس القاعدة — "" ⇒ null، ودور غير المهندس ⇒ null دائمًا.
        teamLeadId:
          formData.role === TEC_ENGINEER_ROLE ? formData.teamLeadId || null : null,
      };
      if (isEditing) {
        const result = await updateUserAction({
          id: editingUser!.id,
          ...payload,
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
        const result = await createUserAction(payload);
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

  // SCR-016: فك القفل التلقائي (أدمن)
  async function handleUnlock(row: UserRow) {
    const result = await unlockUserAction(row.id);
    if (!result.success) {
      toast.error(t(result.error));
    } else {
      toast.success(t("users.unlocked"));
    }
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
      // TO-23-B: المسار وسم بجوار الدور — يُرى بلا فتح الفورم. تيم ليدر بلا مسار
      // يظهر بوسم تحذيري لأنه حساب لا يرى شيئًا (لا يُخفى الخلل بصمت).
      cell: (info) => {
        const row = info.row.original;
        const roleLabel = t(`roles.${info.getValue()}`);
        if (info.getValue() !== TEC_LEAD_ROLE) return roleLabel;
        return (
          <span className="flex items-center gap-2">
            {roleLabel}
            {row.leadRoute ? (
              <Badge variant="secondary">{t(`quotationRequest.route_${row.leadRoute}`)}</Badge>
            ) : (
              <Badge variant="destructive">{t("users.leadRouteMissing")}</Badge>
            )}
          </span>
        );
      },
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
        // SCR-016: شارة القفل التلقائي (منفصلة عن التعطيل الإداري)
        if (row.lockedUntil && new Date(row.lockedUntil) > new Date())
          return <Badge variant="destructive">{t("users.locked")}</Badge>;
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
            {row.lockedUntil && new Date(row.lockedUntil) > new Date() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlock(row)}
              >
                {t("users.unlock")}
              </Button>
            )}
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
                onValueChange={(v) => setValue("role", v ?? "")}
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

            {/* TO-23-B: يظهر **فقط** لـTEC_LEAD. بلا مسار لا يرى الليدر أي عرض
                (فشل TO-23 المغلق) — لذلك الحقل إلزامي هنا وعلى السيرفر معًا. */}
            {isTecLead && (
              <div className="space-y-1">
                <Label>{t("users.leadRoute")}</Label>
                <Select
                  onValueChange={(v) => setValue("leadRoute", v ?? "")}
                  defaultValue={editingUser?.leadRoute ?? undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("users.leadRoute")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_ROUTES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`quotationRequest.route_${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fe(errors.leadRoute)} />
              </div>
            )}

            {/* TO-25: يظهر للمهندس فقط. اختياري — مهندس بلا تيم ليدر حالة صالحة،
                يظل مرئيًا للمدير الذي يرى كل المهندسين. */}
            {isTecEngineer && (
              <div className="space-y-1">
                <Label>{t("users.teamLead")}</Label>
                {teamLeadOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("users.noTeamLeadsYet")}
                  </p>
                ) : (
                  <Select
                    onValueChange={(v) => setValue("teamLeadId", v ?? "")}
                    defaultValue={editingUser?.teamLeadId ?? undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("users.teamLead")} />
                    </SelectTrigger>
                    <SelectContent>
                      {teamLeadOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                          {u.leadRoute ? ` — ${t(`quotationRequest.route_${u.leadRoute}`)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FieldError message={fe(errors.teamLeadId)} />
              </div>
            )}

            <div className="space-y-1">
              <Label>{t("users.department")}</Label>
              <Select
                onValueChange={(v) => setValue("department", v ?? "")}
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
            {t("users.confirmDelete", { name: deleteTarget?.name ?? "" })}
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
            {t("users.confirmReactivate", { name: reactivateTarget?.name ?? "" })}
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
