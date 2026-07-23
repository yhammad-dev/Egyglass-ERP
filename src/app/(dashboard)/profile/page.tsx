export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac";
import { getOwnProfile } from "@/lib/services/users";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const auth = await requireAuth();
  if (!auth.authorized) redirect("/login");

  const user = await getOwnProfile(auth.userId);
  if (!user) redirect("/login");

  return (
    <ProfileClient
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      }}
    />
  );
}
