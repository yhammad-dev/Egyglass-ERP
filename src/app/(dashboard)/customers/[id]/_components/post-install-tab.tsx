"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PostInstallReviewRow } from "@/lib/actions/post-install";

const STATUSES = ["PENDING", "CONTACTED", "RESOLVED", "CLOSED"] as const;
type PostInstallStatus = (typeof STATUSES)[number];

const STATUS_VARIANT: Record<
  PostInstallStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "secondary",
  CONTACTED: "outline",
  RESOLVED: "default",
  CLOSED: "destructive",
};

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={cn(
            "text-2xl transition-colors",
            (hovered || value) >= star
              ? "text-yellow-400"
              : "text-gray-300",
            onChange ? "cursor-pointer" : "cursor-default"
          )}
          disabled={!onChange}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function PostInstallTab({
  reviews,
  customerId,
  currentRole,
}: {
  reviews: PostInstallReviewRow[];
  customerId: string;
  currentRole: string;
}) {
  const t = useTranslations();
  const canDecide =
    currentRole === "ADMIN" || currentRole === "SALES_MANAGER";
  const canCreate =
    currentRole === "ADMIN" ||
    currentRole === "SALES_MANAGER" ||
    currentRole === "SALES_REP" ||
    currentRole === "INSTALLATIONS";

  const router = useRouter();
  const [localReviews, setLocalReviews] =
    useState<PostInstallReviewRow[]>(reviews);

  // Form state
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  async function handleSubmit() {
    if (rating === 0) {
      setRatingError(true);
      return;
    }
    setRatingError(false);
    setSubmitting(true);
    try {
      const { createPostInstallReview } = await import(
        "@/lib/actions/post-install"
      );
      const result = await createPostInstallReview({
        customerId,
        rating,
        notes: notes.trim() || undefined,
        issues: issues.trim() || undefined,
      });
      if ("error" in result) {
        toast.error(t(result.error));
        return;
      }
      toast.success(t("postInstall.reviewAdded"));
      setRating(0);
      setNotes("");
      setIssues("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(reviewId: string, status: string) {
    const { updatePostInstallStatus } = await import(
      "@/lib/actions/post-install"
    );
    const result = await updatePostInstallStatus({
      reviewId,
      status: status as PostInstallStatus,
    });
    if ("error" in result) {
      toast.error(t(result.error));
      return;
    }
    setLocalReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, status: status as PostInstallStatus } : r
      )
    );
    toast.success(t("postInstall.statusUpdated"));
  }

  return (
    <div className="space-y-6">
      {/* Add Review Form */}
      {canCreate && (
        <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
          <h3 className="text-sm font-semibold">{t("postInstall.addReview")}</h3>

          <div className="space-y-1">
            <Label>{t("postInstall.rating")}</Label>
            <StarRating value={rating} onChange={setRating} />
            {ratingError && (
              <p className="text-xs text-red-500">{t("postInstall.ratingRequired")}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pi-notes">{t("postInstall.notes")}</Label>
            <Textarea
              id="pi-notes"
              placeholder={t("postInstall.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pi-issues">{t("postInstall.issues")}</Label>
            <Textarea
              id="pi-issues"
              placeholder={t("postInstall.issuesPlaceholder")}
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t("app.loading") : t("postInstall.addReview")}
            </Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {localReviews.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{t("postInstall.noReviews")}</p>
      ) : (
        <div className="space-y-4">
          {localReviews.map((review) => (
            <div
              key={review.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <StarRating value={review.rating} />
                  <p className="text-xs text-gray-500">
                    {t("postInstall.createdBy")} {review.createdByName} —{" "}
                    {new Date(review.createdAt).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[review.status as PostInstallStatus]}>
                  {t(`postInstall.status_${review.status}`)}
                </Badge>
              </div>

              {review.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t("postInstall.notes")}</p>
                  <p className="text-sm whitespace-pre-wrap">{review.notes}</p>
                </div>
              )}

              {review.issues && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t("postInstall.issues")}</p>
                  <p className="text-sm whitespace-pre-wrap text-red-700">{review.issues}</p>
                </div>
              )}

              {canDecide && (
                <div className="flex items-center gap-2 pt-1">
                  <Label className="text-xs shrink-0">{t("postInstall.changeStatus")}</Label>
                  <Select
                    value={review.status}
                    onValueChange={(v) => handleStatusChange(review.id, v)}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue>
                        {t(`postInstall.status_${review.status}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`postInstall.status_${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
