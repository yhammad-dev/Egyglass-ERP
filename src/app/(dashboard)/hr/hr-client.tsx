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
  createEmployee,
  updateEmployee,
  createLeaveRequest,
  updateLeaveStatus,
} from "../../../../lib/hr/actions";

type Department =
  | "EXECUTIVE"
  | "SALES"
  | "INSPECTIONS"
  | "TECHNICAL_OFFICE"
  | "PROJECTS";

const DEPARTMENTS: Department[] = [
  "EXECUTIVE",
  "SALES",
  "INSPECTIONS",
  "TECHNICAL_OFFICE",
  "PROJECTS",
];

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

const LEAVE_STATUS_VARIANT: Record<LeaveStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

type EmployeeRow = {
  id: string;
  nameAr: string;
  department: Department;
  position: string;
  hireDate: string;
  salary: number | null;
  isActive: boolean;
};

type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  notes: string | null;
};

export function HrClient({
  initialEmployees,
  initialLeaveRequests,
}: {
  initialEmployees: EmployeeRow[];
  initialLeaveRequests: LeaveRequestRow[];
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<"employees" | "leave">("employees");

  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>(initialLeaveRequests);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [departmentInput, setDepartmentInput] = useState<Department>("SALES");
  const [positionInput, setPositionInput] = useState("");
  const [hireDateInput, setHireDateInput] = useState("");
  const [salaryInput, setSalaryInput] = useState("");
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);

  const dateFormat = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function openCreateEmployee() {
    setEditingEmployee(null);
    setNameInput("");
    setDepartmentInput("SALES");
    setPositionInput("");
    setHireDateInput(new Date().toISOString().slice(0, 10));
    setSalaryInput("");
    setIsActiveInput(true);
    setEmployeeError(null);
    setEmployeeDialogOpen(true);
  }

  function openEditEmployee(employee: EmployeeRow) {
    setEditingEmployee(employee);
    setNameInput(employee.nameAr);
    setDepartmentInput(employee.department);
    setPositionInput(employee.position);
    setHireDateInput(employee.hireDate.slice(0, 10));
    setSalaryInput(employee.salary != null ? String(employee.salary) : "");
    setIsActiveInput(employee.isActive);
    setEmployeeError(null);
    setEmployeeDialogOpen(true);
  }

  async function handleSaveEmployee() {
    setEmployeeError(null);

    if (!nameInput.trim() || !positionInput.trim() || !hireDateInput) {
      setEmployeeError(t("errors.required"));
      return;
    }

    setSubmitting(true);
    const salary = salaryInput ? Number(salaryInput) : undefined;

    if (editingEmployee) {
      const response = await updateEmployee({
        id: editingEmployee.id,
        nameAr: nameInput,
        department: departmentInput,
        position: positionInput,
        hireDate: hireDateInput,
        salary,
        isActive: isActiveInput,
      });
      setSubmitting(false);

      if ("error" in response) {
        setEmployeeError(t(response.error ?? "errors.invalidInput"));
        return;
      }

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                nameAr: nameInput,
                department: departmentInput,
                position: positionInput,
                hireDate: new Date(hireDateInput).toISOString(),
                salary: salary ?? null,
                isActive: isActiveInput,
              }
            : e
        )
      );
      toast.success(t("hr.employeeUpdated"));
    } else {
      const response = await createEmployee({
        nameAr: nameInput,
        department: departmentInput,
        position: positionInput,
        hireDate: hireDateInput,
        salary,
      });
      setSubmitting(false);

      if ("error" in response) {
        setEmployeeError(t(response.error ?? "errors.invalidInput"));
        return;
      }

      setEmployees((prev) => [
        {
          id: response.data.id,
          nameAr: nameInput,
          department: departmentInput,
          position: positionInput,
          hireDate: new Date(hireDateInput).toISOString(),
          salary: salary ?? null,
          isActive: true,
        },
        ...prev,
      ]);
      toast.success(t("hr.employeeCreated"));
    }

    setEmployeeDialogOpen(false);
  }

  function openCreateLeave() {
    setLeaveEmployeeId(employees[0]?.id ?? "");
    setLeaveType("");
    setLeaveStart(new Date().toISOString().slice(0, 10));
    setLeaveEnd(new Date().toISOString().slice(0, 10));
    setLeaveNotes("");
    setLeaveError(null);
    setLeaveDialogOpen(true);
  }

  async function handleCreateLeave() {
    setLeaveError(null);

    if (!leaveEmployeeId || !leaveType.trim() || !leaveStart || !leaveEnd) {
      setLeaveError(t("errors.required"));
      return;
    }

    setSubmitting(true);
    const response = await createLeaveRequest({
      employeeId: leaveEmployeeId,
      type: leaveType,
      startDate: leaveStart,
      endDate: leaveEnd,
      notes: leaveNotes || undefined,
    });
    setSubmitting(false);

    if ("error" in response) {
      setLeaveError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    const employee = employees.find((e) => e.id === leaveEmployeeId);
    setLeaveRequests((prev) => [
      {
        id: response.data.id,
        employeeId: leaveEmployeeId,
        employeeName: employee?.nameAr ?? "",
        type: leaveType,
        startDate: new Date(leaveStart).toISOString(),
        endDate: new Date(leaveEnd).toISOString(),
        status: "PENDING",
        notes: leaveNotes || null,
      },
      ...prev,
    ]);
    toast.success(t("hr.leaveRequested"));
    setLeaveDialogOpen(false);
  }

  async function handleLeaveStatusChange(request: LeaveRequestRow, status: LeaveStatus) {
    if (status === request.status) return;

    setUpdatingLeaveId(request.id);
    const response = await updateLeaveStatus({ id: request.id, status });
    setUpdatingLeaveId(null);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status } : r))
    );
    toast.success(t("hr.leaveStatusUpdated"));
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("hr.title")}</h1>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("employees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "employees"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          {t("hr.employeesTab")}
        </button>
        <button
          type="button"
          onClick={() => setTab("leave")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "leave"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          {t("hr.leaveTab")}
        </button>
      </div>

      {tab === "employees" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreateEmployee}>
              {t("hr.addEmployee")}
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.name")}</TableHead>
                  <TableHead>{t("hr.department")}</TableHead>
                  <TableHead>{t("hr.position")}</TableHead>
                  <TableHead>{t("hr.hireDate")}</TableHead>
                  <TableHead>{t("hr.salary")}</TableHead>
                  <TableHead>{t("hr.status")}</TableHead>
                  <TableHead>{t("app.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length ? (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.nameAr}</TableCell>
                      <TableCell>{t(`departments.${employee.department}`)}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{dateFormat.format(new Date(employee.hireDate))}</TableCell>
                      <TableCell>
                        {employee.salary != null ? (
                          <span dir="ltr">{numberFormat.format(employee.salary)}</span>
                        ) : (
                          t("hr.dash")
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? "default" : "secondary"}>
                          {employee.isActive ? t("hr.active") : t("hr.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditEmployee(employee)}
                        >
                          {t("app.edit")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("app.noResults")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreateLeave} disabled={!employees.length}>
              {t("hr.addLeaveRequest")}
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.employee")}</TableHead>
                  <TableHead>{t("hr.leaveType")}</TableHead>
                  <TableHead>{t("hr.startDate")}</TableHead>
                  <TableHead>{t("hr.endDate")}</TableHead>
                  <TableHead>{t("hr.status")}</TableHead>
                  <TableHead>{t("app.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.length ? (
                  leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.type}</TableCell>
                      <TableCell>{dateFormat.format(new Date(request.startDate))}</TableCell>
                      <TableCell>{dateFormat.format(new Date(request.endDate))}</TableCell>
                      <TableCell>
                        <Badge variant={LEAVE_STATUS_VARIANT[request.status]}>
                          {t(`hr.leaveStatus_${request.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              request.status === "APPROVED" ||
                              updatingLeaveId === request.id
                            }
                            onClick={() => handleLeaveStatusChange(request, "APPROVED")}
                          >
                            {t("hr.approve")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={
                              request.status === "REJECTED" ||
                              updatingLeaveId === request.id
                            }
                            onClick={() => handleLeaveStatusChange(request, "REJECTED")}
                          >
                            {t("hr.reject")}
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
        </div>
      )}

      {/* Employee dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? t("hr.editEmployee") : t("hr.addEmployee")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nameAr">{t("hr.name")}</Label>
              <Input
                id="nameAr"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("hr.department")}</Label>
              <Select
                value={departmentInput}
                onValueChange={(value) =>
                  setDepartmentInput((value as Department) ?? "SALES")
                }
              >
                <SelectTrigger>
                  <SelectValue>{t(`departments.${departmentInput}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`departments.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="position">{t("hr.position")}</Label>
              <Input
                id="position"
                value={positionInput}
                onChange={(e) => setPositionInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hireDate">{t("hr.hireDate")}</Label>
              <Input
                id="hireDate"
                type="date"
                dir="ltr"
                value={hireDateInput}
                onChange={(e) => setHireDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="salary">{t("hr.salary")}</Label>
              <Input
                id="salary"
                dir="ltr"
                type="number"
                step="0.01"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
              />
            </div>
            {editingEmployee && (
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActiveInput}
                  onChange={(e) => setIsActiveInput(e.target.checked)}
                />
                <Label htmlFor="isActive">{t("hr.active")}</Label>
              </div>
            )}
            <FieldError message={employeeError ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmployeeDialogOpen(false)}
              >
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleSaveEmployee} disabled={submitting}>
                {submitting ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave request dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("hr.addLeaveRequest")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("hr.employee")}</Label>
              <Select
                value={leaveEmployeeId}
                onValueChange={(value) => setLeaveEmployeeId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {employees.find((e) => e.id === leaveEmployeeId)?.nameAr ??
                      t("hr.selectEmployee")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="leaveType">{t("hr.leaveType")}</Label>
              <Input
                id="leaveType"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                placeholder={t("hr.leaveTypePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startDate">{t("hr.startDate")}</Label>
              <Input
                id="startDate"
                type="date"
                dir="ltr"
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">{t("hr.endDate")}</Label>
              <Input
                id="endDate"
                type="date"
                dir="ltr"
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="leaveNotes">{t("hr.notes")}</Label>
              <Input
                id="leaveNotes"
                value={leaveNotes}
                onChange={(e) => setLeaveNotes(e.target.value)}
              />
            </div>
            <FieldError message={leaveError ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLeaveDialogOpen(false)}
              >
                {t("app.cancel")}
              </Button>
              <Button type="button" onClick={handleCreateLeave} disabled={submitting}>
                {submitting ? t("app.loading") : t("app.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
