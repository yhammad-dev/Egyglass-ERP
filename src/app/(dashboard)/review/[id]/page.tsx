export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getReviewQuotationDetail } from "../../../../../lib/review/actions";
import { ReviewDetail } from "./review-detail";

export default async function ReviewDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "TEC_APPROVER"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotation = await getReviewQuotationDetail(id);
  if (!quotation) notFound();

  return <ReviewDetail quotation={quotation} />;
}
