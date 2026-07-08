export const PIPELINE_STAGE_COLORS: Record<string, string> = {
  NEW:                    "bg-gray-100 text-gray-700 border-gray-200",
  PRICED:                 "bg-blue-100 text-blue-700 border-blue-200",
  FOLLOW_UP:              "bg-amber-100 text-amber-700 border-amber-200",
  INSPECTION:             "bg-purple-100 text-purple-700 border-purple-200",
  CONTRACT:               "bg-emerald-100 text-emerald-700 border-emerald-200",
  EXECUTION:              "bg-green-100 text-green-700 border-green-200",
  RE_INSPECTION_FOLLOWUP: "bg-orange-100 text-orange-700 border-orange-200",
  REJECTED:               "bg-red-100 text-red-700 border-red-200",
};

export const INSPECTION_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-700 border-blue-200",
  SCHEDULED: "bg-amber-100 text-amber-700 border-amber-200",
  DONE:      "bg-green-100 text-green-700 border-green-200",
  OVERDUE:   "bg-red-100 text-red-700 border-red-200",
};

export const TEC_STATUS_COLORS: Record<string, string> = {
  NEW:         "bg-gray-100 text-gray-700 border-gray-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  ON_HOLD:     "bg-amber-100 text-amber-700 border-amber-200",
  DONE:        "bg-green-100 text-green-700 border-green-200",
};

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED:       "bg-green-100 text-green-700 border-green-200",
  RETURNED:       "bg-red-100 text-red-700 border-red-200",
};

export const QUOTATION_STATUS_COLORS: Record<string, string> = {
  DRAFT:            "bg-gray-100 text-gray-700 border-gray-200",
  SENT:             "bg-blue-100 text-blue-700 border-blue-200",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED:         "bg-green-100 text-green-700 border-green-200",
  EXPIRED:          "bg-red-100 text-red-700 border-red-200",
};
