export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { getCustomerById, getSalesReps } from "@/lib/services/customers";
import { getPostInstallReviews } from "@/lib/actions/post-install";
import { CustomerProfileClient } from "./customer-profile-client";

export default async function CustomerProfilePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await props.params;

  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
    "INSTALLATIONS",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [customer, salesReps, reviewsResult] = await Promise.all([
    getCustomerById(id, roleCheck.userId, roleCheck.role),
    getSalesReps(),
    getPostInstallReviews(id),
  ]);

  if (!customer) notFound();

  const postInstallReviews = Array.isArray(reviewsResult) ? reviewsResult : [];

  return (
    <CustomerProfileClient
      customer={customer}
      currentRole={roleCheck.role}
      currentUserId={roleCheck.userId}
      salesReps={salesReps}
      postInstallReviews={postInstallReviews}
    />
  );
}
