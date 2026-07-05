import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getEmployees, getLeaveRequests } from "../../../../lib/hr/actions";
import { HrClient } from "./hr-client";

export default async function HrPage() {
  const roleCheck = await requireRole(["ADMIN", "HR"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [employees, leaveRequests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);

  return <HrClient initialEmployees={employees} initialLeaveRequests={leaveRequests} />;
}
