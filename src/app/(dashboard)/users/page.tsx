export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getUsers } from "@/lib/services/users";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const users = await getUsers();

  return <UsersClient initialUsers={users} />;
}
