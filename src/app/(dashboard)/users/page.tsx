import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getUsers } from "@/lib/services/users";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.authorized) redirect("/dashboard");

  const users = await getUsers();

  return <UsersClient initialUsers={users} />;
}
