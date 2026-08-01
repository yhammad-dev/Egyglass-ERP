"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  addMeasurementAction,
  deleteMeasurementAction,
  addInspectionAttachment,
  updateInspectionStatus,
  updateSiteReadiness,
  submitInspectionForApproval,
  approveInspection,
  returnInspection,
  declareMatchResult,
  recordDeviation,
  requestRemeasure,
} from "../actions";
// تعريف واحد للنوع — مصدره الخدمة (import type يُمحى عند البناء، لا استيراد خادم للعميل)
import type { MeasurementRow } from "@/lib/services/inspection-measurements";
// C1-fix: المصدر الوحيد لتنسيق التواريخ — يوم عمل (UTC) ولحظة حقيقية (القاهرة)
import {
  formatInstantDate,
  formatInstantDateTime,
} from "@/lib/format/dates";

// OVERDUE تبقى في نوع **العرض**: صفوف قديمة كُتبت يدويًا قبل IN-07 يجب أن تُعرَض
// مترجمةً لا كقيمة خام.
// SCR-INS-D (C2): `POSTPONED` قيمة عرض — تُكتب بإجراء `recordDeviation` وحده
// SCR-INS-I (C2-fix): `CANCELLED` قيمة **عرض** — تُكتب بالتتالي من رفض العميل وحده
type InspectionStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "POSTPONED"
  | "DONE"
  | "CANCELLED"
  | "OVERDUE";

/** ✅ BL-160 (C2): ثلاثي صريح. `null` = لم يُسأل أصلًا (صفّ تاريخي) — قيمة رابعة. */
type SiteReadinessValue = "READY" | "NOT_READY" | "UNCONFIRMED";

/** SCR-INS-D: الأسباب السبعة — مرآة `DEVIATION_REASONS` في `../actions.ts` (STD-15) */
const DEVIATION_REASONS = [
  "CUSTOMER_POSTPONED",
  "CUSTOMER_REJECTED",
  "CUSTOMER_CANCELLED",
  "UNSUITABLE_TIME",
  "NO_STAFF_AVAILABLE",
  "REMEASURE_REQUIRED",
  "OTHER",
] as const;
type DeviationReason = (typeof DEVIATION_REASONS)[number];

/** SCR-INS-E: أسباب الإرجاع المقنَّنة — مرآة `RETURN_REASON_CODES` (D-IN-17) */
const RETURN_REASON_CODES = [
  "MEASUREMENTS_INCOMPLETE",
  "MEASUREMENTS_UNCLEAR",
  "PHOTOS_MISSING",
  "WRONG_LOCATION",
  "OTHER",
] as const;
type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

// IN-07: القيم **القابلة للكتابة** — بلا OVERDUE. التأخير مشتقّ من dueDate لا
// يُختار من قائمة. مرآة لـ`statusEnum` في `../actions.ts`؛ الحارس النافذ هناك.
type SettableStatus = Exclude<InspectionStatus, "OVERDUE">;

const STATUS_OPTIONS: SettableStatus[] = ["REQUESTED", "SCHEDULED", "DONE"];

// D-40/BL-109: تلوين شارة حالة اعتماد المعاينة
const APPROVAL_BADGE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  RETURNED: "destructive",
};

// 1ب (BL-81): وحدات المقاس المهيكل
const UNITS = ["SQM", "CBM"] as const;
type MeasurementUnit = (typeof UNITS)[number];

/**
 * SCR-INS-A (D-IN-8): القيم الثلاث **بنصّ حسن حرفيًا** — لا رابعة ولا إعادة صياغة.
 * مرآة لـ`MATCH_RESULTS` في `../actions.ts`؛ الحارس النافذ هناك (STD-15).
 */
const MATCH_RESULTS = [
  "MATCHED",
  "ACCEPTABLE_DEVIATION",
  "REQUIRES_REPRICING",
] as const;
type MatchResult = (typeof MATCH_RESULTS)[number];

/** تلوين الحكم: الاختلاف الموجب لإعادة التسعير يلفت لأنه يستدعي عملًا من قسم آخر. */
const MATCH_BADGE: Record<MatchResult, "default" | "secondary" | "destructive"> = {
  MATCHED: "default",
  ACCEPTABLE_DEVIATION: "secondary",
  REQUIRES_REPRICING: "destructive",
};

/**
 * IN-45 (موجة B3): الأفعال المعروفة التي تُكتب على `entity = "InspectionRequest"`
 * (مُتحقَّق بالجرد: `inspections/actions.ts` · `services/inspections.ts` ·
 * `services/inspection-measurements.ts`).
 *
 * 🔴 لماذا قائمة صريحة لا `t()` مباشرة على `action`: `action` عمود **نص حر** في
 * `ActivityLog`، فأي قيمة قديمة أو مكتوبة من مسار آخر كانت ستنتج مفتاح ترجمة غير
 * موجود — وهو ضجيج في الكونسول ونصّ مفتاح خام أمام المستخدم. المجهول يُعرَض بكوده
 * الخام (قيمة بيانات لا نصّ واجهة) ولا يُسقِط الصف أبدًا.
 */
const KNOWN_ACTIVITY_ACTIONS = new Set([
  "INSPECTION_CREATED",
  "INSPECTION_SCHEDULED",
  "INSPECTION_RESCHEDULED",
  "UPDATE_STATUS",
  "SITE_READINESS_UPDATED",
  "ATTACHMENT_ADDED",
  "MEASUREMENT_ADDED",
  "MEASUREMENT_DELETED",
  "INSPECTION_SUBMITTED_FOR_APPROVAL",
  "INSPECTION_APPROVED",
  "INSPECTION_RETURNED",
  // SCR-INS-A (موجة C1)
  "MATCH_RESULT_DECLARED",
  "MATCH_RESULT_CORRECTED",
  // SCR-INS-D/H (موجة C2)
  "INSPECTION_DEVIATION_RECORDED",
  "INSPECTION_REMEASURE_REQUESTED",
]);

/**
 * IN-22 (موجة B3): فحص الدقة على **النص المُدخَل** لا على `Number` — لأن
 * `Number("1.0001")` يفقد التمييز بين «أربع خانات» و«ثلاث»، و`% 0.001` على العائم
 * يُنتج نتائج كاذبة (خطأ التمثيل الثنائي). مرآة دقيقة لـ`multipleOf(0.001)` الخادمي.
 */
function hasAtMostThreeDecimals(raw: string): boolean {
  const decimals = raw.trim().split(".")[1];
  return decimals === undefined || decimals.length <= 3;
}

/**
 * IN-22: كبح تدرّج الحقل الرقمي **بلا حذفه**.
 *
 * `type="number" step="0.001"` يجعل كل نقرة سهم أو خطوة عجلة = **مليمتر واحد** —
 * أي أن الأداة تُغري بحركة لا تُنتج شيئًا مفيدًا، وتُغيّر مقاسًا مسجَّلًا بالخطأ عند
 * تمرير الصفحة والمؤشر فوق الحقل. الحقل يبقى رقميًا (لوحة أرقام على الموبايل
 * وتحقق المتصفح) — الممنوع هو التدرّج وحده.
 */
const numberInputGuards = {
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  },
};

/**
 * IN-45: عرض `details` **بلا افتراض شكل**. العمود يحمل أحيانًا JSON مهيكلًا
 * (`{assigneeId:{from,to}, …}` من الجدولة) وأحيانًا نصًّا عربيًا حرًّا
 * (`"الموقع جاهز"`)، وأحيانًا `null`.
 *
 * 🔴 القاعدة الحاكمة: **لا يُسقَط الصف مهما كان المحتوى.** فشل التحليل يعني عرض
 * النص كما هو، لا اختفاء حدث من سجل تدقيقي — سجل ينقص صفًّا أسوأ من سجل قبيح.
 */
function formatActivityDetails(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // نصّ حر: لا يبدأ بقوس JSON ⇒ يُعرض حرفيًا بلا محاولة تحليل
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [trimmed];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") return [trimmed];
    return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
      // شكل الانتقال `{from, to}` هو الأشيع (جدولة/إعادة جدولة) — يُقرأ كسهم
      if (value !== null && typeof value === "object" && "to" in value) {
        const pair = value as { from?: unknown; to?: unknown };
        return `${key}: ${String(pair.from ?? "—")} ← ${String(pair.to ?? "—")}`;
      }
      return `${key}: ${value === null ? "—" : String(value)}`;
    });
  } catch {
    // JSON مكسور أو نصّ يبدأ بقوس مصادفةً — يُعرض خامًا ولا يختفي
    return [trimmed];
  }
}

type InspectionDetail = {
  id: string;
  customer: { id: string; name: string; phone: string };
  location: string;
  address: string;
  phone: string;
  notes: string | null;
  /** الحالة **المخزَّنة** — تكتبها قائمة تغيير الحالة (بلا OVERDUE، IN-07) */
  status: InspectionStatus;
  /**
   * IN-17 (موجة B3): الحالة **المعروضة** بعد اشتقاق التأخير في الخادم. كانت هذه
   * الشاشة تعرض الخام وحده بينما القائمة تشتقّ ⇒ نفس المعاينة «متأخرة» في القائمة
   * و«مجدولة» في تفاصيلها. الشارة تقرأ هذه، وقائمة الكتابة تقرأ `status`.
   */
  effectiveStatus: InspectionStatus;
  type: string;
  siteReadiness: SiteReadinessValue | null;
  // SCR-INS-D (C2): الانحراف — `null` في الكل = مسار مستقيم لم ينحرف
  deviationReason: DeviationReason | null;
  deviationNote: string | null;
  deviationRequestedBy: "CUSTOMER" | "INTERNAL" | null;
  deviationAt: string | null;
  deviationByName: string | null;
  // SCR-INS-E: التصنيف بجوار `returnReason` النصّي القائم
  returnReasonCode: ReturnReasonCode | null;
  // SCR-INS-H: أثر إعادة القياس — يبقى ظاهرًا بعد إعادة الفتح فيُعرف سببها
  remeasureRequestedAt: string | null;
  remeasureReason: string | null;
  remeasureRequestedByName: string | null;
  /** SCR-INS-B (IN-33): الطوابع التشغيلية — `null` = لم تقع اللحظة بعد */
  assignedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  /** SCR-INS-A: `null` = **لم تُعلَن** — حالة مغايرة لـ«مطابق» */
  matchResult: MatchResult | null;
  matchReason: string | null;
  matchDeclaredByName: string | null;
  matchDeclaredAt: string | null;
  scheduledAt: string | null;
  /** SCR-INS-B2: `null` = لم تُجدوَل بعد فلا مهلة تنفيذ */
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  attachments: {
    id: string;
    fileName: string;
    filePath: string;
    category: "SITE_PHOTO" | "SKETCH" | "OTHER";
    createdAt: string;
  }[];
  measurements: MeasurementRow[];
  approvalStatus: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "RETURNED";
  returnReason: string | null;
  /** IN-45: أثر المعاينة الزمني — أحدث أولًا. عرض فقط، لا يُشتق منه منطق (BL-81). */
  activity: {
    id: string;
    action: string;
    details: string | null;
    actorName: string;
    createdAt: string;
  }[];
  /**
   * IN-49: صلاحية الكتابة **من الخادم** (مشتقّة من ALLOWED_ROLES نفسها التي تحرس
   * الأكشنات) لا من `currentRole` في العميل. المبيعات والمكتب الفني يقرأان فقط،
   * فلا يُعرض لهما زر كتابة واحد. الحارس النافذ سيرفر-سايد ولم يُمَس (STD-15).
   */
  canWrite: boolean;
  /** IN-06/IN-49: false = المكتب الفني قبل الاعتماد — يُعرض السبب لا جدول فارغ */
  measurementsVisible: boolean;
  /**
   * IN-48: هل يملك المستخدم الحالي تصحيح جاهزية الموقع؟ (ADMIN · SALES_MANAGER ·
   * مندوب المبيعات المالك/المغطّي). يُقرَّر خادميًا لأنه مشروط بملكية العميل.
   */
  canEditSiteReadiness: boolean;
  /** IN-39: سياق الطلب المرتبط — المندوب كان يعاين بلا معرفة مساره ولا ملخّصه */
  request: {
    id: string;
    code: string;
    technicalRoute: string;
    salesRequestType: string;
    summary: string | null;
  } | null;
};

export function InspectionDetailClient({
  inspection: initialInspection,
  currentRole = "",
}: {
  inspection: InspectionDetail;
  currentRole?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [inspection, setInspection] = useState(initialInspection);
  const [siteReadiness, setSiteReadiness] = useState<SiteReadinessValue | null>(
    initialInspection.siteReadiness ?? null
  );
  const [updatingSiteReadiness, setUpdatingSiteReadiness] = useState(false);

  // STD-15: هذا إخفاء واجهة فقط — الحارس الحقيقي server-side (MANAGER_ROLES في
  // updateInspectionStatus/updateSiteReadiness) كما هو، لم يُمَس.
  // IN-49: كل كتلة كتابة تُشترط بـ`canWrite` القادم من الخادم. `canManage` يبقى
  // للتمييز الإداري داخل أدوار الكتابة (اعتماد/إرجاع/حالة/جاهزية).
  const canWrite = inspection.canWrite;
  const canManage =
    canWrite &&
    (currentRole === "ADMIN" || currentRole === "INSPECTION_MANAGER");
  // IN-13: بعد الاعتماد تُقفَل الجدولة والحالة وجاهزية الموقع سيرفر-سايد. هذا
  // المتغيّر مرآة واجهة لذلك القفل فقط — لا حارس (STD-15).
  const approvalLocked = inspection.approvalStatus === "APPROVED";
  // IN-48 (D-IN-15): جاهزية الموقع **للقراءة فقط لأدوار المعاينة** — المدير يستهلك
  // ولا يُدخل. لكن **المبيعات تصحّح**: هي صاحبة الحقيقة (العميل مصدرها)، وبلا مسار
  // تصحيح كانت «لم يؤكّد العميل» تصير طريقًا مسدودًا لا يُجدوَل أبدًا.
  // القرار من الخادم (`canEditSiteReadiness`) لا من `currentRole`، لأن صلاحية المندوب
  // مشروطة بملكية العميل — وهي معلومة لا تُسلَّم للعميل (IN-49).
  const canEditSiteReadiness =
    inspection.canEditSiteReadiness && !approvalLocked;

  async function handleSiteReadiness(value: SiteReadinessValue | null) {
    setUpdatingSiteReadiness(true);
    const result = await updateSiteReadiness({ id: inspection.id, siteReadiness: value });
    setUpdatingSiteReadiness(false);
    if ("error" in result) {
      toast.error(t(result.error ?? "errors.updateFailed"));
      return;
    }
    setSiteReadiness(value);
    toast.success(t("inspections.siteReadinessUpdated"));
  }

  // ── SCR-INS-D (C2): تسجيل الانحراف ──
  const [deviationInput, setDeviationInput] = useState<DeviationReason | "">(
    initialInspection.deviationReason ?? ""
  );
  const [deviationNoteInput, setDeviationNoteInput] = useState(
    initialInspection.deviationNote ?? ""
  );
  const [recordingDeviation, setRecordingDeviation] = useState(false);
  const [deviationError, setDeviationError] = useState<string | null>(null);

  async function handleRecordDeviation() {
    if (!deviationInput) return;
    setDeviationError(null);
    setRecordingDeviation(true);
    const res = await recordDeviation({
      id: inspection.id,
      reason: deviationInput,
      note: deviationNoteInput.trim() || undefined,
    });
    setRecordingDeviation(false);
    if ("error" in res) {
      setDeviationError(t(res.error ?? "errors.updateFailed"));
      return;
    }
    // الحالة قد تصير `POSTPONED` والمصدر يُفرض خادميًا — يُعاد الجلب بدل تخمينهما
    router.refresh();
    toast.success(t("inspections.deviation.recorded"));
  }

  // ── SCR-INS-H (C2): إعادة القياس ──
  const [remeasureInput, setRemeasureInput] = useState("");
  const [requestingRemeasure, setRequestingRemeasure] = useState(false);
  const [remeasureError, setRemeasureError] = useState<string | null>(null);

  async function handleRequestRemeasure() {
    setRemeasureError(null);
    setRequestingRemeasure(true);
    const res = await requestRemeasure({
      id: inspection.id,
      reason: remeasureInput.trim(),
    });
    setRequestingRemeasure(false);
    if ("error" in res) {
      setRemeasureError(t(res.error ?? "errors.updateFailed"));
      return;
    }
    // الإجراء يقلب أربعة حقول (القفل · الحكم · الحالة · الطابع) — `refresh` لا مرآة
    router.refresh();
    toast.success(t("inspections.remeasure.requested"));
  }

  // ── SCR-INS-A (IN-03): إعلان نتيجة المطابقة ──
  const [matchInput, setMatchInput] = useState<MatchResult | "">(
    initialInspection.matchResult ?? ""
  );
  const [matchReasonInput, setMatchReasonInput] = useState(
    initialInspection.matchReason ?? ""
  );
  const [declaringMatch, setDeclaringMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function handleDeclareMatch() {
    if (!matchInput) return;
    setMatchError(null);
    setDeclaringMatch(true);
    const res = await declareMatchResult({
      id: inspection.id,
      matchResult: matchInput,
      reason: matchReasonInput.trim() || undefined,
    });
    setDeclaringMatch(false);
    if ("error" in res) {
      setMatchError(t(res.error ?? "errors.updateFailed"));
      return;
    }
    // الاسم والوقت يأتيان من الخادم — `refresh` بدل تلفيقهما محليًا (نفس نمط IN-17)
    router.refresh();
    toast.success(t("inspections.match.declared"));
  }

  // ── D-40/BL-109: بوابة اعتماد المعاينة ──
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [returnReasonInput, setReturnReasonInput] = useState("");
  // SCR-INS-E (D-IN-17): التصنيف **بجوار** النصّ لا بدلًا منه — النصّ يبقى إلزاميًا
  const [returnCodeInput, setReturnCodeInput] = useState<ReturnReasonCode | "">("");

  async function handleSubmitForApproval() {
    setSubmitting(true);
    const res = await submitInspectionForApproval({ id: inspection.id });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(t(res.error ?? "errors.updateFailed"));
      return;
    }
    setInspection((prev) => ({ ...prev, approvalStatus: "PENDING_APPROVAL" }));
    toast.success(t("inspections.approval.submitted"));
  }

  async function handleApprove() {
    setApproving(true);
    const res = await approveInspection({ id: inspection.id });
    setApproving(false);
    if ("error" in res) {
      toast.error(t(res.error ?? "errors.updateFailed"));
      return;
    }
    // IN-50: الخادم يكتب `status: "DONE"` مع الاعتماد في نفس الـupdate، فالمرآة
    // المحلية لازم تحمل الاثنين. بدون `status` كانت شارة الترويسة وقائمة الحالة
    // تبقيان على القيمة القديمة (SCHEDULED) جوار شارة «معتمدة» — شاشة تناقض نفسها.
    setInspection((prev) => ({
      ...prev,
      approvalStatus: "APPROVED",
      status: "DONE",
      // IN-17: `DONE` لا تكون متأخرة أبدًا بنصّ القاعدة (`status !== "DONE"`)،
      // فالمرآة المحلية هنا مطابقة للاشتقاق الخادمي يقينًا لا تخمينًا.
      effectiveStatus: "DONE",
    }));
    toast.success(t("inspections.approval.approved"));
  }

  async function handleReturn() {
    setReturning(true);
    const res = await returnInspection({
      id: inspection.id,
      reason: returnReasonInput,
      reasonCode: returnCodeInput || undefined,
    });
    setReturning(false);
    if ("error" in res) {
      toast.error(t(res.error ?? "errors.updateFailed"));
      return;
    }
    setInspection((prev) => ({
      ...prev,
      approvalStatus: "RETURNED",
      returnReason: returnReasonInput,
    }));
    setShowReturn(false);
    setReturnReasonInput("");
    toast.success(t("inspections.approval.returned"));
  }

  const [descriptionInput, setDescriptionInput] = useState("");
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [unitInput, setUnitInput] = useState<MeasurementUnit>("SQM");
  const [quantityInput, setQuantityInput] = useState("1");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentCategory, setAttachmentCategory] =
    useState<"SITE_PHOTO" | "SKETCH">("SITE_PHOTO");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [savingAttachment, setSavingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  /**
   * C1-fix: `Intl.DateTimeFormat("ar-EG", …)` المحلي **حُذف**. كان يستعمل المنطقة
   * الزمنية للبيئة، فأظهر نفس `dueDate` بيوم مختلف عن القائمة (تفصيل الجذر في
   * `lib/format/dates.ts`). التنسيق كله عبر المصدر الواحد الآن.
   *
   * 🔴 **ملاحظة مطلوبة لأي قارئ:** الطوابع التشغيلية **لا** تُنسَّق كأيام العمل —
   * هي لحظات حقيقية، وتنسيقها بـUTC كان سيُظهر حدثًا وقع 01:00 بالقاهرة على أنه
   * اليوم السابق. دالتان لا واحدة، والتمييز مقصود.
   *
   * SCR-INS-B (موجة C1): الطابع الفارغ له **معنيان مختلفان**، والتمييز بينهما
   * **مشتقّ من البيانات نفسها لا من تاريخ صلب في الكود** (تجنّبًا لتكرار علّة
   * BL-160): إن كانت الواقعة قد حدثت فعلًا (مُسنَدة/مُقدَّمة/منتهية) والطابع فارغ ⇒
   * صفّ أقدم من الهجرة ⇒ «غير مسجَّل». وإلا فاللحظة لم تقع بعد ⇒ «—».
   */
  function renderTimestamp(value: string | null, factHappened: boolean) {
    const formatted = formatInstantDate(value);
    if (formatted) return formatted;
    return factHappened
      ? t("inspections.notRecordedLegacy")
      : t("inspections.dash");
  }

  async function handleAddMeasurement() {
    setMeasurementError(null);
    const width = Number(widthInput);
    const height = Number(heightInput);
    const quantity = Number(quantityInput);

    if (!descriptionInput.trim()) {
      setMeasurementError(t("errors.required"));
      return;
    }
    if (
      Number.isNaN(width) ||
      width <= 0 ||
      Number.isNaN(height) ||
      height <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setMeasurementError(t("errors.invalidInput"));
      return;
    }
    // IN-22 (موجة B3): الدقة تُرفض برسالتها الخاصة لا بـ«بيانات غير صالحة» العامة.
    // 🔴 القيد نفسه لم يُمَس: `multipleOf(0.001)` في `addMeasurementSchema` هو
    // القاعدة الصحيحة (العمود Decimal(12,3) — أي دقة أعلى تُقرَّب بصمت وتغذّي
    // المطابقة الثلاثية). المُصلَح هو **الرسالة**: المندوب كان يُرفض بلا معرفة السبب
    // فيظن العطل في الرقم نفسه. الفحص هنا يسبق النداء فيصل السبب فورًا.
    if (!hasAtMostThreeDecimals(widthInput) || !hasAtMostThreeDecimals(heightInput)) {
      setMeasurementError(t("errors.measurementPrecision"));
      return;
    }

    setSavingMeasurement(true);
    const response = await addMeasurementAction({
      inspectionRequestId: inspection.id,
      description: descriptionInput.trim(),
      width,
      height,
      unit: unitInput,
      quantity,
      notes: measurementNotes || undefined,
    });
    setSavingMeasurement(false);

    if ("error" in response) {
      setMeasurementError(t(response.error ?? "errors.invalidInput"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      measurements: [...prev.measurements, response.data],
    }));
    setDescriptionInput("");
    setWidthInput("");
    setHeightInput("");
    setQuantityInput("1");
    setMeasurementNotes("");
    toast.success(t("inspections.detail.measurementsAdded"));
  }

  async function handleDeleteMeasurement(measurementId: string) {
    setMeasurementError(null);
    setDeletingMeasurementId(measurementId);
    const response = await deleteMeasurementAction({ measurementId });
    setDeletingMeasurementId(null);

    if ("error" in response) {
      setMeasurementError(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setInspection((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.id !== measurementId),
    }));
    toast.success(t("inspections.detail.measurementDeleted"));
  }

  async function handleAddAttachment() {
    setAttachmentError(null);

    if (!attachmentFile) {
      setAttachmentError(t("errors.required"));
      return;
    }
    // ── BL-186: الرفض كان يُكتب ولا يُرى ────────────────────────────────────────
    // مسار **النجاح** في هذه الدالة يُنهي بـ`toast.success`، بينما كل مسارات الرفض
    // كانت تكتفي بفقرة `attachmentError` أسفل اللوحة (السطر ~1450) — وهي أسفل صفحة
    // طويلة، غالبًا خارج المجال المرئي وقت الضغط، وبلا أي حركة تلفت النظر. النتيجة
    // عمليًا: المستخدم يضغط «إضافة» فلا يحدث شيء ظاهر، فيعيد المحاولة بنفس الملف.
    // العلاج توست **إضافةً إلى** الفقرة لا بدلًا منها (الفقرة تبقى للمرجعية بعد
    // اختفاء التوست). الرفض نفسه — بصمة المحتوى السحرية على الخادم — لا يُمَس.
    // ⚠️ هذا الفرع تحديدًا يقع طبيعيًا: `accept="image/*"` **لا يفلتر SVG** لأن نوعه
    // `image/svg+xml`، فيمرّ من هنا ويُرفض على الخادم بالبصمة.
    if (!attachmentFile.type.startsWith("image/")) {
      setAttachmentError(t("errors.invalidFileType"));
      toast.error(t("errors.invalidFileType"));
      return;
    }

    setSavingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(attachmentFile);
      });

      const response = await addInspectionAttachment({
        id: inspection.id,
        category: attachmentCategory,
        originalName: attachmentFile.name,
        base64,
      });

      // BL-186: يغطّي كل رفض من الخادم لا نوع الملف وحده — الحجم، الملكية (BL-105)،
      // القفل بعد الاعتماد (D-38). كلها كانت تصل وتُكتب بلا أثر مرئي.
      if ("error" in response) {
        setAttachmentError(t(response.error ?? "errors.invalidInput"));
        toast.error(t(response.error ?? "errors.invalidInput"));
        return;
      }

      setInspection((prev) => ({
        ...prev,
        attachments: [response.data, ...prev.attachments],
      }));
      setAttachmentFile(null);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      toast.success(t("inspections.detail.attachmentAdded"));
    } catch {
      // BL-186: آخر مخرج فشل في الدالة — تركه صامتًا يعني إصلاحًا نصفيًا
      // (فشل قراءة الملف يبدو للمستخدم كضغطة بلا نتيجة، تمامًا كالرفض)
      setAttachmentError(t("errors.serverError"));
      toast.error(t("errors.serverError"));
    } finally {
      setSavingAttachment(false);
    }
  }

  async function handleStatusChange(status: SettableStatus) {
    if (status === inspection.status) return;

    setUpdatingStatus(true);
    const response = await updateInspectionStatus({ id: inspection.id, status });
    setUpdatingStatus(false);

    if ("error" in response) {
      toast.error(t(response.error ?? "errors.updateFailed"));
      return;
    }

    setInspection((prev) => ({ ...prev, status }));
    // IN-17: الحالة المشتقّة تُعاد من الخادم لا تُحسب هنا — نسخة ثانية من الشرط في
    // العميل هي بالضبط ما يمنعه هذا البند. `refresh` يُعيد جلب الـDTO فتتسق الشارة.
    router.refresh();
    toast.success(t("inspections.detail.statusUpdated"));
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{inspection.customer.name}</h1>
          {/* ── محاذاة (C2-fix-2b) ──
              `dir="ltr"` كانت على الـ**بلوك**، وقيمة `text-align` الابتدائية `start`
              تُحسم **باتجاه العنصر نفسه** ⇒ البلوك يُحاذي **يسارًا** داخل صفحة RTL،
              بينما عنوانه فوقه يمينًا: القيمة تبدو مقطوعة عن عنوانها.
              🔴 و`text-start` **لا تُصلحها** — ستُحسم يسارًا للسبب نفسه.
              الحل: `dir` تنتقل للـ**span الداخلي** — الترتيب محفوظ (وهو كل ما يلزم
              للأرقام)، والبلوك يعود يرث RTL فيُحاذي يمينًا بلا فئة محاذاة ولا CSS
              فيزيائي. **يعمل في الاتجاهين** (المشروع ثنائي اللغة ar/en). */}
          <p className="text-sm text-muted-foreground">
            <span dir="ltr">{inspection.customer.phone}</span>
          </p>
          <p className="text-sm">{inspection.address}</p>
        </div>
        {/* IN-17: الشارة تعرض الحالة **المشتقّة** (المصدر الواحد في الخادم)، بينما
            قائمة تغيير الحالة أدناه تظل على `status` المخزَّن — `OVERDUE` لا تُكتب. */}
        <Badge variant="outline">
          {t(`inspections.status_${inspection.effectiveStatus}`)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xl text-sm">
        <div>
          <p className="text-muted-foreground">{t("inspections.type")}</p>
          <p>{t(`inspections.type_${inspection.type}`)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.location")}</p>
          <p>
            {t(`inspections.${inspection.location === "OUTSIDE_CAIRO" ? "outsideCairo" : "insideCairo"}`)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.dueDate")}</p>
          {/* SCR-INS-B2: `null` = لم تُجدوَل ⇒ نصّ صريح لا تاريخ 1970 ولا فراغ صامت */}
          {/* محاذاة: `dir` على الـspan لا البلوك. والشرط سقط — لم يعد لازمًا لأن
              نصّ «لم تُجدوَل بعد» عربي خارج الـspan أصلًا.
              ✅ D-IN-26(ج): التوقيت القاهري — سقط استثناء UTC بعد تصحيح الصفوف. */}
          <p>
            {inspection.dueDate ? (
              <span dir="ltr">{formatInstantDate(inspection.dueDate)}</span>
            ) : (
              t("inspections.notScheduledYet")
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.scheduledAt")}</p>
          {/* محاذاة: `dir` على الـspan لا البلوك (الشرح الكامل عند هاتف العميل أعلاه) */}
          <p>
            <span dir="ltr">
              {/* D-IN-24: لحظة حقيقية بتوقيت القاهرة — لا يوم عمل بـUTC */}
              {formatInstantDateTime(inspection.scheduledAt) ?? t("inspections.dash")}
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.assignee")}</p>
          <p>{inspection.assignee?.name ?? t("inspections.dash")}</p>
        </div>
        {/* SCR-INS-B (IN-33): الطوابع التشغيلية — أساس K2/K3 لاحقًا.
            الفراغ يُقرأ بمعنييه: «لم تقع بعد» (—) أو «غير مسجَّل» لصفّ أقدم من
            الهجرة — الفراغ الصامت الواحد كان يُقرأ كعطل عرض (BL-81 يمنع الملء). */}
        <div>
          <p className="text-muted-foreground">{t("inspections.assignedAt")}</p>
          <p>
            <span dir="ltr">
              {renderTimestamp(inspection.assignedAt, inspection.assignee !== null)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.submittedAt")}</p>
          <p>
            <span dir="ltr">
            {renderTimestamp(
              inspection.submittedAt,
              // التقديم وقع فعلًا إن غادرت المعاينة `DRAFT` في بُعد الاعتماد
              inspection.approvalStatus !== "DRAFT"
            )}
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("inspections.completedAt")}</p>
          <p>
            <span dir="ltr">
            {renderTimestamp(
              inspection.completedAt,
              // القاعدة النافذة: `completedAt` مليان ⟺ `DONE` ⇒ فارغ مع DONE = صفّ قديم
              inspection.status === "DONE"
            )}
            </span>
          </p>
        </div>
      </div>

      {/* ── SCR-INS-A (IN-03 · D-IN-8 · D-IN-9): نتيجة المطابقة ──
          🔴 النظام لا يقارن — يسجّل حكم إنسان. لا يوجد «مقاس مفترض» في القاعدة،
          فالمقارنة تحدث عند المدير وهذه اللوحة توثّق نتيجتها.
          الإعلان بعد الاعتماد حصرًا (D-IN-9)، ولمديري المعاينات وADMIN (D-IN-1). */}
      <div className="max-w-xl space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("inspections.match.title")}</Label>
          {inspection.matchResult ? (
            <Badge variant={MATCH_BADGE[inspection.matchResult]}>
              {t(`inspections.match.result_${inspection.matchResult}`)}
            </Badge>
          ) : (
            <Badge variant="outline">{t("inspections.match.notDeclared")}</Badge>
          )}
        </div>

        {inspection.matchResult && (
          <div className="space-y-1 text-sm">
            {inspection.matchReason && (
              <p className="whitespace-pre-wrap">
                <span className="text-muted-foreground">
                  {t("inspections.match.reason")}:{" "}
                </span>
                {inspection.matchReason}
              </p>
            )}
            {inspection.matchDeclaredByName && (
              <p className="text-xs text-muted-foreground">
                {t("inspections.match.declaredBy")} {inspection.matchDeclaredByName}
                {inspection.matchDeclaredAt && (
                  <>
                    {" — "}
                    <span dir="ltr">
                      {formatInstantDate(inspection.matchDeclaredAt)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* D-IN-9 mirror: قبل الاعتماد تُشرح البوابة ولا يُعرض فورم يعمل ثم يفشل */}
        {canManage && !approvalLocked && (
          <p className="text-xs text-amber-600">
            {t("inspections.match.requiresApproval")}
          </p>
        )}

        {canManage && approvalLocked && (
          <div className="space-y-2">
            <Select
              value={matchInput}
              onValueChange={(v) => setMatchInput((v as MatchResult) ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("inspections.match.selectResult")}>
                  {matchInput
                    ? t(`inspections.match.result_${matchInput}`)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MATCH_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`inspections.match.result_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* D-IN-8: السبب إلزامي للاختلافين — الإلزام النافذ server-side */}
            {matchInput && matchInput !== "MATCHED" && (
              <div className="space-y-1">
                <Label htmlFor="match-reason">{t("inspections.match.reason")}</Label>
                <Textarea
                  id="match-reason"
                  value={matchReasonInput}
                  onChange={(e) => setMatchReasonInput(e.target.value)}
                  placeholder={t("inspections.match.reasonPlaceholder")}
                  rows={2}
                />
              </div>
            )}

            {matchError && <p className="text-sm text-red-500">{matchError}</p>}

            <Button
              type="button"
              size="sm"
              disabled={
                declaringMatch ||
                !matchInput ||
                (matchInput !== "MATCHED" && matchReasonInput.trim().length === 0)
              }
              onClick={handleDeclareMatch}
            >
              {declaringMatch
                ? t("app.loading")
                : inspection.matchResult
                  ? t("inspections.match.correct")
                  : t("inspections.match.declare")}
            </Button>
          </div>
        )}
      </div>

      {/* ── IN-39: سياق الطلب المرتبط ──
          المندوب كان يذهب للموقع بلا معرفة كود الطلب ولا مساره ولا ملخّصه، و
          `QuotationRequest.summary` موجود ولا تقرؤه أي شاشة معاينة (IN-20).
          `salesRequestType` أُضيف في موجة المبيعات C وهذه أول نقطة استهلاك له. */}
      {inspection.request && (
        <div className="max-w-xl space-y-2 rounded-md border p-4">
          <p className="text-sm font-medium">{t("inspections.detail.requestContext")}</p>
          {/* ثلاثة حقول: grid-cols-3 لا 2 — في RTL كان الثالث يبقى وحده في صف
              نصفه فارغ فيُقرأ كتخطيط ناقص. ينهار لعمود واحد على الموبايل. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t("inspections.detail.requestCode")}</p>
              <p><span dir="ltr">{inspection.request.code}</span></p>
            </div>
            {/* المفاتيح قائمة سلفًا: route_* يستعملها ملف العميل وحوار طلب المعاينة،
                و salesType_* يستعملها داشبورد المبيعات — صفر مفتاح enum جديد */}
            <div>
              <p className="text-muted-foreground">{t("quotationRequest.route")}</p>
              <p>{t(`quotationRequest.route_${inspection.request.technicalRoute}`)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("quotationRequest.salesType")}</p>
              <p>{t(`quotationRequest.salesType_${inspection.request.salesRequestType}`)}</p>
            </div>
          </div>
          {inspection.request.summary && (
            <div>
              <p className="text-muted-foreground text-sm">
                {t("inspections.detail.requestSummary")}
              </p>
              <p className="text-sm">{inspection.request.summary}</p>
            </div>
          )}
        </div>
      )}

      {inspection.notes && (
        <div className="max-w-xl">
          <p className="text-sm text-muted-foreground">{t("inspections.notes")}</p>
          <p className="text-sm">{inspection.notes}</p>
        </div>
      )}

      {/* ── D-40/BL-109: بوابة اعتماد المعاينة ── */}
      <div className="max-w-xl space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("inspections.approval.title")}</Label>
          <Badge variant={APPROVAL_BADGE[inspection.approvalStatus] ?? "outline"}>
            {t(`inspections.approval.status_${inspection.approvalStatus}`)}
          </Badge>
        </div>

        {inspection.approvalStatus === "RETURNED" && inspection.returnReason && (
          <p className="text-sm text-destructive">
            {t("inspections.approval.returnedReason")}: {inspection.returnReason}
          </p>
        )}

        {canWrite &&
          (inspection.approvalStatus === "DRAFT" ||
            inspection.approvalStatus === "RETURNED") && (
          <div className="space-y-1">
            <Button
              type="button"
              size="sm"
              disabled={submitting || inspection.measurements.length === 0}
              onClick={handleSubmitForApproval}
            >
              {t("inspections.approval.submit")}
            </Button>
            {inspection.measurements.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("inspections.approval.needMeasurement")}
              </p>
            )}
          </div>
        )}

        {canManage && inspection.approvalStatus === "PENDING_APPROVAL" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={approving || returning}
                onClick={handleApprove}
              >
                {t("inspections.approval.approve")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={approving || returning}
                onClick={() => setShowReturn((v) => !v)}
              >
                {t("inspections.approval.return")}
              </Button>
            </div>
            {showReturn && (
              <div className="space-y-2">
                {/* SCR-INS-E (IN-23 · D-IN-17): تصنيف مقنَّن **بجوار** النصّ.
                    النصّ يبقى إلزاميًا (الزر معطَّل بدونه) لأن التصنيف يُقاس والنصّ
                    يشرح — نفس علّة SF-18 في المبيعات وبنفس علاجها. */}
                <Select
                  value={returnCodeInput}
                  onValueChange={(v) =>
                    setReturnCodeInput((v as ReturnReasonCode) ?? "")
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("inspections.approval.selectReasonCode")}
                    >
                      {returnCodeInput
                        ? t(`inspections.returnReason_${returnCodeInput}`)
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASON_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`inspections.returnReason_${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={returnReasonInput}
                  onChange={(e) => setReturnReasonInput(e.target.value)}
                  placeholder={t("inspections.approval.reasonPlaceholder")}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={returning || returnReasonInput.trim().length === 0}
                  onClick={handleReturn}
                >
                  {t("inspections.approval.confirmReturn")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {canManage && (
        <div className="space-y-2 max-w-xs">
          <Label>{t("inspections.detail.updateStatus")}</Label>
          <Select
            value={inspection.status}
            onValueChange={(value) => {
              if (!value) return;
              handleStatusChange(value as SettableStatus);
            }}
            disabled={updatingStatus || approvalLocked}
          >
            <SelectTrigger>
              <SelectValue>{t(`inspections.status_${inspection.status}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`inspections.status_${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* IN-13: مرآة الحارس الخادمي (STD-15) — بدونها القائمة تبدو فعّالة ثم
              ترتدّ القيمة بعد نداء فاشل بـtoast وحده. الرفض الحقيقي server-side. */}
          {approvalLocked && (
            <p className="text-xs text-muted-foreground">
              {t("errors.inspectionApprovedNoChange")}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 max-w-xs">
        <Label>{t("inspections.siteReadiness")}</Label>
        {/* ✅ BL-160 (C2): أربعة أزرار لا ثلاثة. «العميل لم يؤكّد» صارت قيمة صريحة
            (`UNCONFIRMED`، تحجب الجدولة) منفصلة عن «لم يُسأل» (`null`، لا تحجب) —
            وهما ما كان العمود البولياني يطويهما في `null` واحدة فاستلزم حدًّا زمنيًا. */}
        {canEditSiteReadiness ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={siteReadiness === "READY" ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness("READY")}
            >
              ✅ {t("inspections.siteReady")}
            </Button>
            <Button
              type="button"
              variant={siteReadiness === "NOT_READY" ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness("NOT_READY")}
            >
              ❌ {t("inspections.siteNotReady")}
            </Button>
            <Button
              type="button"
              variant={siteReadiness === "UNCONFIRMED" ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness("UNCONFIRMED")}
            >
              ❓ {t("inspections.siteReadiness_UNCONFIRMED")}
            </Button>
            <Button
              type="button"
              variant={siteReadiness === null ? "default" : "outline"}
              size="sm"
              disabled={updatingSiteReadiness}
              onClick={() => handleSiteReadiness(null)}
            >
              — {t("inspections.siteReadinessNeverAsked")}
            </Button>
          </div>
        ) : (
          <p className="text-sm">
            {siteReadiness === null
              ? t("inspections.siteReadinessNeverAsked")
              : t(`inspections.siteReadiness_${siteReadiness}`)}
          </p>
        )}
      </div>

      {/* ── SCR-INS-D (C2): انحراف المعاينة ──
          🔴 **الحقيقة 1 من نصّ حسن:** التأجيل والرفض والإلغاء **مصدرها العميل**.
          `deviationRequestedBy` يُفرض خادميًا للأسباب `CUSTOMER_*` ولا يُترك للاختيار —
          وبدونه تُحمَّل مؤشرات أداء القسم قراراتِ عملاء لا يملكها. */}
      <div className="max-w-xl space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("inspections.deviation.title")}</Label>
          {inspection.deviationReason ? (
            <Badge variant="secondary">
              {t(`inspections.deviation.reason_${inspection.deviationReason}`)}
            </Badge>
          ) : (
            <Badge variant="outline">{t("inspections.deviation.none")}</Badge>
          )}
        </div>

        {inspection.deviationReason && (
          <div className="space-y-1 text-sm">
            {inspection.deviationRequestedBy && (
              <p>
                <span className="text-muted-foreground">
                  {t("inspections.deviation.source")}:{" "}
                </span>
                {t(`inspections.deviation.source_${inspection.deviationRequestedBy}`)}
              </p>
            )}
            {inspection.deviationNote && (
              <p className="whitespace-pre-wrap">{inspection.deviationNote}</p>
            )}
            {inspection.deviationByName && (
              <p className="text-xs text-muted-foreground">
                {t("inspections.deviation.recordedBy")} {inspection.deviationByName}
                {inspection.deviationAt && (
                  <>
                    {" — "}
                    <span dir="ltr">{formatInstantDate(inspection.deviationAt)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {canManage && !approvalLocked && (
          <div className="space-y-2">
            <Select
              value={deviationInput}
              onValueChange={(v) => setDeviationInput((v as DeviationReason) ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("inspections.deviation.selectReason")}>
                  {deviationInput
                    ? t(`inspections.deviation.reason_${deviationInput}`)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEVIATION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`inspections.deviation.reason_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* القاعدة 1: `OTHER` تستلزم ملاحظة — الإلزام النافذ server-side */}
            <Textarea
              value={deviationNoteInput}
              onChange={(e) => setDeviationNoteInput(e.target.value)}
              placeholder={
                deviationInput === "OTHER"
                  ? t("inspections.deviation.noteRequired")
                  : t("inspections.deviation.notePlaceholder")
              }
              rows={2}
            />
            {deviationError && <p className="text-sm text-red-500">{deviationError}</p>}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                recordingDeviation ||
                !deviationInput ||
                (deviationInput === "OTHER" && deviationNoteInput.trim().length === 0)
              }
              onClick={handleRecordDeviation}
            >
              {recordingDeviation
                ? t("app.loading")
                : t("inspections.deviation.record")}
            </Button>
          </div>
        )}
      </div>

      {/* ── SCR-INS-H (C2): إعادة القياس — مخرج IN-04 قبل التعاقد ──
          🔴 فتح مُقنَّن لا إلغاء للقفل: الإجراء يعيد `approvalStatus` إلى
          `PENDING_APPROVAL` فينفتح القفل تلقائيًا، وحرّاس IN-13 لم تُمَس.
          ⚠️ D-IN-18: يُرفض بوجود عقد — بمفتاح صريح لا برسالة عامة. */}
      {canManage && approvalLocked && (
        <div className="max-w-xl space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4">
          <Label>{t("inspections.remeasure.title")}</Label>
          <p className="text-xs text-amber-700">{t("inspections.remeasure.hint")}</p>
          <Textarea
            value={remeasureInput}
            onChange={(e) => setRemeasureInput(e.target.value)}
            placeholder={t("inspections.remeasure.reasonPlaceholder")}
            rows={2}
          />
          {remeasureError && <p className="text-sm text-red-500">{remeasureError}</p>}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={requestingRemeasure || remeasureInput.trim().length === 0}
            onClick={handleRequestRemeasure}
          >
            {requestingRemeasure ? t("app.loading") : t("inspections.remeasure.request")}
          </Button>
        </div>
      )}

      {/* أثر إعادة قياس سابقة — يبقى ظاهرًا بعد إعادة الفتح فيُعرف سببها */}
      {inspection.remeasureRequestedAt && (
        <div className="max-w-xl rounded-md border p-3 text-sm space-y-1">
          <p className="font-medium">{t("inspections.remeasure.previous")}</p>
          {inspection.remeasureReason && (
            <p className="whitespace-pre-wrap">{inspection.remeasureReason}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {inspection.remeasureRequestedByName}
            {" — "}
            <span dir="ltr">
              {formatInstantDate(inspection.remeasureRequestedAt)}
            </span>
          </p>
        </div>
      )}

      <div className="space-y-3 max-w-3xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.measurements")}</h2>

        {/* 1ب (BL-81): جدول الصفوف المهيكلة — المصدر InspectionMeasurement */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-start">{t("inspections.detail.description")}</th>
                <th className="p-2 text-start">{t("inspections.detail.width")}</th>
                <th className="p-2 text-start">{t("inspections.detail.height")}</th>
                <th className="p-2 text-start">{t("inspections.detail.unit")}</th>
                <th className="p-2 text-start">{t("inspections.detail.quantity")}</th>
                <th className="p-2 text-start">{t("inspections.notes")}</th>
                {/* IN-49: عمود الإجراءات يختفي كليًا لأدوار القراءة — لا عمود فارغ */}
                {canWrite && (
                  <th className="p-2 text-start">{t("app.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* ترتيب الفروع مقصود: «محجوبة» تُفحَص **قبل** «فارغة». المكتب الفني
                  قبل الاعتماد تصله المقاسات مصفوفةً فارغة (حُجبت عند المصدر)، فلو
                  فُحص الفراغ أولًا لرأى «لا مقاسات» — وهي كذبة: المقاسات موجودة
                  لكنها ليست له بعد. */}
              {!inspection.measurementsVisible ? (
                <tr>
                  <td
                    colSpan={canWrite ? 7 : 6}
                    className="p-4 text-center text-amber-600"
                  >
                    {t("tec.inspectionNotApproved")}
                  </td>
                </tr>
              ) : inspection.measurements.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 7 : 6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    {t("inspections.detail.noMeasurements")}
                  </td>
                </tr>
              ) : (
                inspection.measurements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{m.description}</td>
                    {/* محاذاة: الرؤوس `text-start` (⇒ يمين في RTL) وكانت الخلايا
                        `dir="ltr"` بلا محاذاة ⇒ يسار. `dir` انتقلت للـspan فعادت
                        الخلية ترث RTL وتطابق رأسها — بلا لمس رؤوس ولا فئات جديدة. */}
                    <td className="p-2"><span dir="ltr">{m.width}</span></td>
                    <td className="p-2"><span dir="ltr">{m.height}</span></td>
                    <td className="p-2">{t(`inspections.detail.unit_${m.unit}`)}</td>
                    <td className="p-2"><span dir="ltr">{m.quantity}</span></td>
                    <td className="p-2 text-muted-foreground">{m.notes ?? "—"}</td>
                    {canWrite && (
                      <td className="p-2">
                        {/* IN-13 mirror: بعد الاعتماد الخادم يرفض الحذف — زر يبدو
                            فعّالًا ثم يفشل بـtoast هو ما تمنعه قاعدة STD-15. */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            deletingMeasurementId === m.id || approvalLocked
                          }
                          onClick={() => handleDeleteMeasurement(m.id)}
                        >
                          {t("app.delete")}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* صف جديد — IN-49: لأدوار الكتابة فقط · IN-13 mirror: ويختفي بعد الاعتماد
            (الخادم يرفض الإضافة، فإظهار فورم كامل يعمل ثم يفشل خدعة لا خدمة) */}
        {canWrite && !approvalLocked && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label htmlFor="description">{t("inspections.detail.description")}</Label>
            <Input
              id="description"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="width">{t("inspections.detail.width")}</Label>
            {/* IN-22: لوحة أرقام عشرية على اللمس + كبح التدرّج (السهم/العجلة) */}
            <Input
              id="width"
              type="number"
              inputMode="decimal"
              dir="ltr"
              step="0.001"
              value={widthInput}
              onChange={(e) => setWidthInput(e.target.value)}
              {...numberInputGuards}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="height">{t("inspections.detail.height")}</Label>
            {/* IN-22: لوحة أرقام عشرية على اللمس + كبح التدرّج (السهم/العجلة) */}
            <Input
              id="height"
              type="number"
              inputMode="decimal"
              dir="ltr"
              step="0.001"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              {...numberInputGuards}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("inspections.detail.unit")}</Label>
            <Select
              value={unitInput}
              onValueChange={(v) => setUnitInput((v as MeasurementUnit) ?? "SQM")}
            >
              <SelectTrigger>
                <SelectValue>{t(`inspections.detail.unit_${unitInput}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {t(`inspections.detail.unit_${u}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity">{t("inspections.detail.quantity")}</Label>
            <Input
              id="quantity"
              type="number"
              dir="ltr"
              step="1"
              min="1"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="measurementNotes">{t("inspections.notes")}</Label>
          <Textarea
            id="measurementNotes"
            value={measurementNotes}
            onChange={(e) => setMeasurementNotes(e.target.value)}
          />
        </div>
        {measurementError && <p className="text-sm text-red-500">{measurementError}</p>}
        <Button type="button" onClick={handleAddMeasurement} disabled={savingMeasurement}>
          {savingMeasurement ? t("app.loading") : t("inspections.detail.addMeasurements")}
        </Button>
        </>
        )}
      </div>

      <div className="space-y-3 max-w-xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.detail.attachments")}</h2>
        {/* IN-49: الرفع لأدوار الكتابة فقط — العرض أدناه للجميع.
            IN-13 mirror: والرفع يُقفَل بعد الاعتماد كالمقاسات (نفس حارس الخادم). */}
        {canWrite && !approvalLocked && (
        <>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="attachmentType">
              {t("inspections.detail.attachmentType")}
            </Label>
            <Select
              value={attachmentCategory}
              onValueChange={(v) =>
                setAttachmentCategory(v as "SITE_PHOTO" | "SKETCH")
              }
            >
              <SelectTrigger id="attachmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SITE_PHOTO">
                  {t("inspections.detail.categorySitePhoto")}
                </SelectItem>
                <SelectItem value="SKETCH">
                  {t("inspections.detail.categorySketch")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="attachmentFile">
              {t("inspections.detail.chooseFile")}
            </Label>
            <Input
              id="attachmentFile"
              type="file"
              accept="image/*"
              ref={attachmentInputRef}
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        {attachmentError && <p className="text-sm text-red-500">{attachmentError}</p>}
        <Button
          type="button"
          onClick={handleAddAttachment}
          disabled={savingAttachment || !attachmentFile}
        >
          {savingAttachment ? t("app.loading") : t("inspections.detail.addAttachment")}
        </Button>
        </>
        )}

        {inspection.attachments.length > 0 && (
          <div className="space-y-4 pt-2">
            {(["SITE_PHOTO", "SKETCH", "OTHER"] as const).map((cat) => {
              const items = inspection.attachments.filter(
                (a) => a.category === cat
              );
              if (items.length === 0) return null;
              const label =
                cat === "SITE_PHOTO"
                  ? t("inspections.detail.categorySitePhotos")
                  : cat === "SKETCH"
                  ? t("inspections.detail.categorySketches")
                  : t("inspections.detail.categoryOther");
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {label}
                  </h3>
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className="text-sm border rounded-md p-2 flex justify-between items-center gap-2"
                    >
                      <span className="truncate">{a.fileName}</span>
                      <a
                        href={a.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="text-blue-600 underline shrink-0"
                      >
                        {t("inspections.detail.viewFile")}
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── IN-45 (موجة B3): سجل الأحداث ──
          القسم كان يكتب أحد عشر انتقالًا ولا يقرؤها أحد: «تم الحفظ» ثم صمت.
          🔴 **قراءة فقط** — لا زر ولا إجراء، ولنفس أدوار `DETAIL_READ_ROLES`
          ونطاقها (وُرِثا من `getInspectionDetail`، بلا حارس جديد).
          🔴 **BL-81** — أثر يُعرَض لا مصدر حقيقة: لا شيء يُشتق منه.
          🔴 **IN-25** — سجلات `entity = "QuotationRequest"` مُستثناة عمدًا (السبب
             موثَّق عند الاستعلام في `actions.ts`: حدّ الكيان + منع توسيع النطاق). */}
      <div className="space-y-3 max-w-3xl border-t pt-6">
        <h2 className="font-semibold">{t("inspections.activity.title")}</h2>
        {inspection.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("inspections.activity.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {inspection.activity.map((event) => {
              const lines = formatActivityDetails(event.details);
              return (
                <li
                  key={event.id}
                  className="rounded-md border p-3 text-sm space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {/* المجهول يُعرض بكوده الخام — قيمة بيانات لا نصّ واجهة */}
                      {KNOWN_ACTIVITY_ACTIONS.has(event.action)
                        ? t(`inspections.activity.action_${event.action}`)
                        : event.action}
                    </span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {/* C1-fix: لحظة حقيقية بتوقيت القاهرة المثبَّت — لا منطقة البيئة */}
                      {formatInstantDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("inspections.activity.by")} {event.actorName}
                  </p>
                  {lines.length > 0 && (
                    <div className="space-y-0.5">
                      {lines.map((line, i) => (
                        <p
                          key={i}
                          className="text-xs text-muted-foreground break-words whitespace-pre-wrap"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
