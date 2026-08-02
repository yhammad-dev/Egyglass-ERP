"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { uploadDirFor, uploadUrl } from "@/lib/storage/paths";
// BL-196: بصمة البايتات — المصدر الواحد المشترك مع مرفقات المعاينات، لا نسخة ثانية.
import { sniffDocumentMime, UPLOAD_DOCUMENT_EXT } from "@/lib/storage/sniff";
// BL-196: نطاق العرض بالدور — نفس قاعدة `getQuotations` من مصدر واحد.
import { buildQuotationRoleScope } from "@/lib/services/quotation-scope";

/**
 * ══ BL-196 — إغلاق ثغرة كتابة وقراءة في وحدة المستندات ════════════════════════
 *
 * ما كان قائمًا: `requireRole` وحده — **دور بلا ملكية**. و`entityType`/`entityId`
 * نصّان حرّان من العميل بلا أي تحقّق ⇒ أي مستخدم بدور مسموح يُرفق مستندًا بأي كيان
 * في الشركة بمعرّفه، ويقرأ مستندات أي كيان، بلا أثر تدقيقي، و`VIEWER` («قراءة فقط»)
 * يكتب. وجدول `documents` كان **فارغًا تمامًا** وقت الإصلاح ⇒ صفر ترحيل بيانات.
 */

/** 10MB — كما كان. يُفرض على البايتات المقروءة فعلًا لا على رقم يرسله العميل. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const UPLOAD_DIR = uploadDirFor("documents");

/**
 * 🔴 **أنواع الكيانات قائمة مغلقة.** `entityType` عمود نص حر (`VarChar(50)`) و
 * `entityId` بلا مفتاح أجنبي — فلا شيء في القاعدة يمنع قيمة مخترعة. القائمة هنا هي
 * الحدّ الوحيد، وأي نوع خارجها يُرفض قبل أي عمل.
 *
 * ⚠️ **`contract` يحمل معرّف Quotation لا معرّف Contract** — قرار يوسف (2026-08-02)
 * بعد رصد أن موضعَي الرفع كليهما يمرّران `entityId={quotationId}`
 * (`contract-form.tsx:43` و`:73`، والثاني رغم توفّر `contractId` في الـstate).
 * قراءته كمعرّف عقد كانت سترفض **كل** رفع عقد مشروع — أي «تأمين» يكسر الميزة.
 * الربط بلا خسارة: `Contract.quotationId` فريد (1:1). الشذوذ مسجَّل في `BL-198`.
 *
 * ⇒ النوعان يتحوّلان إلى نفس السؤال: **هل يملك الفاعل نطاق هذا العرض؟**
 */
const DOCUMENT_ENTITY_TYPES = ["quotation", "contract"] as const;

function isKnownEntityType(value: string): boolean {
  return (DOCUMENT_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * 🔴 **فشل مغلق: لا وصول لدور بلا قاعدة نطاق مُثبَتة.**
 *
 * `buildQuotationRoleScope` تُرجع `{}` («بلا فلتر») لأي دور خارج فروعها — وهو صحيح
 * لمن أُقرّ له ذلك في `getQuotations` (ADMIN · SALES_MANAGER)، وخطر لمن لم يُقرّ.
 * `INSPECTION_MANAGER` و`REVIEW` كانا في قائمة أدوار هذه الوحدة **ولا يصلان إلى أي
 * شاشة تستعملها**: ليسا في حارس `/quotations/[id]` ولا `/quotations/[id]/contract`.
 * فتمريرهما كان سيمنحهما `{}` = **كل عروض الشركة** — أي إبقاء الثغرة نفسها المُراد
 * إغلاقها، بغلاف جديد.
 *
 * لذلك القائمة هنا **مشتقّة من الشاشات لا مخترعة**: هي بالضبط حارس صفحة العقد
 * (`ADMIN · SALES_MANAGER · SALES_REP`) وهي مجموعة جزئية من حارس صفحة العرض.
 * ⚠️ **تضييق واعٍ يتجاوز حرفية «احذف VIEWER»** — يُسقط صفر وظيفة قابلة للوصول،
 * ومعروض على يوسف صراحةً في التقرير.
 * ⚠️ `TECHNICAL_OFFICE`/`TEC_LEAD` يصلان لصفحة العرض ويريان الأداة، ولم يكونا في
 * القائمة أصلًا (زر ميت لهما) — **لا يُضافان هنا**: توسيع صلاحية لم يطلبه أحد.
 */
const DOCUMENT_ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"];

/**
 * الحارس الحقيقي: الكيان موجود **و**داخل نطاق الفاعل.
 *
 * 🔴 **استعلام واحد للسؤالين عمدًا.** الفصل («موجود؟» ثم «مسموح؟») كان سيُنتج
 * ردَّين متمايزين ⇒ **مِفصَح وجود**: مهاجم يميّز «العرض غير موجود» من «موجود ومحجوب»
 * فيحصي معرّفات الشركة. الردّ واحد للحالتين — نفس مبدأ `notFound()` في الصفحات
 * («لا يكشف الوجود»).
 */
async function assertEntityInScope(
  entityType: string,
  entityId: string,
  userId: string,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!entityId || !isKnownEntityType(entityType))
    return { ok: false, error: "نوع الكيان غير مدعوم" };

  const scope = await buildQuotationRoleScope(userId, role);
  // `null` = صفر وصول (لا «بلا قيد») — يجب ألا يُخلط بـ`{}`.
  if (scope === null) return { ok: false, error: "المستند غير موجود" };

  // النوعان يشيران إلى Quotation (انظر DOCUMENT_ENTITY_TYPES أعلاه).
  const quotation = await prisma.quotation.findFirst({
    where: { id: entityId, ...scope },
    select: { id: true },
  });
  if (!quotation) return { ok: false, error: "المستند غير موجود" };

  return { ok: true };
}

export async function uploadDocument(
  entityType: string,
  entityId: string,
  formData: FormData
) {
  try {
    // 🔴 `VIEWER` أُزيل: دور مُعرَّف بـ«قراءة فقط» كان يكتب — تناقض في التعريف لا
    // قرار سياسة. (رؤيته للعروض قرار منفصل مؤجَّل ولم يُمَس.)
    const roleCheck = await requireRole(DOCUMENT_ROLES);
    if (!roleCheck.authorized) return { error: "غير مخول" };
    const userId = roleCheck.userId;

    const guard = await assertEntityInScope(
      entityType,
      entityId,
      userId,
      roleCheck.role
    );
    if (!guard.ok) return { error: guard.error };

    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "لم يتم اختيار ملف" };

    // 🔴 كل التحقق **قبل** أي كتابة على القرص — رفضٌ بعد الكتابة يترك ملفًا يتيمًا
    // بلا صف يشير إليه، فلا يُنظَّف ولا يُعرف أنه موجود.
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0) return { error: "الملف فارغ" };
    if (bytes.length > MAX_DOCUMENT_BYTES)
      return { error: "حجم الملف يتجاوز 10 ميغابايت" };

    // 🔴 النوع والامتداد من **البايتات** لا من ادعاء العميل. سابقًا كان الامتداد
    // مقتطعًا من `file.name` و`mimeType` من `file.type` — كلاهما بيد المُرسِل.
    // SVG والملفات المكتبية وكل ما عدا (PDF + الصور) يُرفض هنا.
    const mimeType = sniffDocumentMime(bytes);
    if (!mimeType || !(mimeType in UPLOAD_DOCUMENT_EXT))
      return { error: "نوع الملف غير مدعوم — يُقبل PDF والصور فقط" };
    const ext = UPLOAD_DOCUMENT_EXT[mimeType];

    const label = (formData.get("label") as string) || "";

    await mkdir(UPLOAD_DIR, { recursive: true });
    const stored = `${randomUUID()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, stored), bytes);

    const doc = await prisma.document.create({
      data: {
        entityType,
        entityId,
        filename: stored,
        originalName: file.name,
        mimeType,
        sizeBytes: bytes.length,
        url: uploadUrl("documents", stored),
        label: label || null,
        uploadedById: userId,
      },
    });

    // BL-196: كتابة بلا أثر كانت أحد وجوه العيب — مستند عقد يُرفع ولا يُعرف رافعه.
    await prisma.activityLog.create({
      data: {
        userId,
        action: "DOCUMENT_UPLOADED",
        entity: "Document",
        entityId: doc.id,
        details: JSON.stringify({
          entityType,
          targetId: entityId,
          originalName: file.name,
          mimeType,
          sizeBytes: bytes.length,
        }),
      },
    });

    return { success: true, doc };
  } catch (e) {
    console.error("[uploadDocument]", e);
    return { error: "فشل رفع الملف" };
  }
}

export async function getDocuments(entityType: string, entityId: string) {
  try {
    // القراءة تبقى لنفس الأدوار: `VIEWER` أُزيل من **الكتابة** بنصّ التكليف، وقراءته
    // للعروض قرار منفصل مؤجَّل — لكنه هنا خارج القائمة تبعًا لقاعدة «لا وصول بلا
    // قاعدة نطاق مُثبَتة» (انظر DOCUMENT_ROLES). يُراجَع مع قرار رؤية VIEWER.
    const roleCheck = await requireRole(DOCUMENT_ROLES);
    if (!roleCheck.authorized) return [];

    // 🔴 القراءة كانت مُسرِّبة بنفس قدر الكتابة — وأوسع أثرًا: المستندات قد تحمل
    // عقودًا وهويات ومراسلات، لا أرقامًا فقط. نفس الحارس حرفيًا.
    const guard = await assertEntityInScope(
      entityType,
      entityId,
      roleCheck.userId,
      roleCheck.role
    );
    if (!guard.ok) return [];

    return await prisma.document.findMany({
      where: { entityType, entityId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("[getDocuments]", e);
    return [];
  }
}

export async function deleteDocument(id: string) {
  try {
    const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER"]);
    if (!roleCheck.authorized) return { error: "غير مخول" };

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { error: "المستند غير موجود" };

    // 🔴 الملكية تُقرأ من **صفّ المستند نفسه** لا من مُدخل العميل — نفس نمط
    // `getMeasurementAssignee` في المعاينات (BL-105). الدور وحده كان يكفي سابقًا:
    // مستند عقد يُحذف بلا فحص نطاق وبلا أثر لمن حذفه.
    const guard = await assertEntityInScope(
      doc.entityType,
      doc.entityId,
      roleCheck.userId,
      roleCheck.role
    );
    if (!guard.ok) return { error: guard.error };

    await prisma.document.delete({ where: { id } });

    // ⚠️ الأثر يُكتب **بعد** الحذف عمدًا وبقيم مُلتقطة قبله: الصف زال، فلولا هذه
    // اللقطة لضاع اسم الملف وهدفه نهائيًا. `entityId` هنا معرّف المستند المحذوف
    // (كيان الأثر)، والهدف في `details`.
    await prisma.activityLog.create({
      data: {
        userId: roleCheck.userId,
        action: "DOCUMENT_DELETED",
        entity: "Document",
        entityId: doc.id,
        details: JSON.stringify({
          entityType: doc.entityType,
          targetId: doc.entityId,
          originalName: doc.originalName,
          uploadedById: doc.uploadedById,
        }),
      },
    });

    return { success: true };
  } catch (e) {
    console.error("[deleteDocument]", e);
    return { error: "فشل الحذف" };
  }
}
