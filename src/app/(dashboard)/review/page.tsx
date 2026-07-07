export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getPendingReviewQuotations } from "../../../../lib/review/actions";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const roleCheck = await requireRole(["ADMIN", "REVIEW"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotations = await getPendingReviewQuotations();

  return <ReviewClient initialQuotations={quotations} />;
}
