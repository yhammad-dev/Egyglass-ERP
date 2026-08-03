export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ContractForm } from "./_components/contract-form";
// BL-199: القراءة عبر الأكشن المحروس نفسه — لا استعلام موازٍ على `prisma.document`.
import { getDocuments } from "../../../../../../lib/documents/actions";

export default async function ContractPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      contract: true,
    },
  });

  if (!quotation) notFound();

  if (quotation.reviewStatus !== "APPROVED") redirect(`/quotations/${id}`);

  /**
   * ── BL-199: السلسلة كانت مقطوعة من طرفين ────────────────────────────────────
   *
   * `getDocuments` كانت **بلا مستدعٍ واحد** في المستودع، و`initialDocs` **بلا
   * ممرِّر** — فالقائمة تبدأ فارغة دائمًا وتمتلئ بما تضيفه الجلسة وحدها، ثم تفرغ
   * مع أول إعادة تحميل. النتيجة: المستند يُرفع ويُخزَّن ويُكتب أثره… ولا يُرى.
   *
   * 🔴 **القراءة تمرّ بالحارس لا حوله:** `getDocuments` تفرض نفس نطاق الملكية
   * الذي فرضه `BL-196` على الكتابة (`assertEntityInScope`). استعلام مباشر على
   * `prisma.document` هنا كان سيفتح مسار قراءة موازيًا بلا حارس — أي إعادة فتح
   * الثغرة التي أُغلقت للتوّ، من باب العرض هذه المرة.
   *
   * 🔴 **المفتاح `id` (معرّف العرض) لا معرّف العقد — عمدًا (BL-198):** `ContractForm`
   * يمرّر `entityId={quotationId}` عند الكتابة، فالقراءة بنفس المفتاح حرفيًا. أي
   * قيمة أخرى هنا كانت ستقرأ بمفتاح غير الذي كُتب به ⇒ قائمة فارغة أبدًا.
   */
  const contractDocs = await getDocuments("contract", id);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">إنشاء عقد</h1>
        <p className="text-sm text-muted-foreground mt-1">
          عرض السعر: {quotation.number} — {quotation.customer.name}
        </p>
      </div>
      <ContractForm
        quotationId={id}
        customerId={quotation.customer.id}
        initialDocs={contractDocs}
        existingContract={
          quotation.contract
            ? {
                signedAt: quotation.contract.signedAt?.toISOString() ?? null,
                notes: quotation.contract.notes ?? "",
              }
            : null
        }
      />
    </div>
  );
}
