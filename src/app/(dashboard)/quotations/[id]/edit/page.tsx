export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPricingFactors, getProductTypes } from "../../../../../../lib/pricing/actions";
import { QuotationBuilder } from "../../new/_components/quotation-builder";
import type { ItemPricingInput } from "../../new/_components/product-recipe-form";

export default async function EditQuotationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // BL-127 (W-01): الحارس = PRICING_ROLES بالضبط. SALES_REP أُزيل (يطلب لا يسعّر)،
  // و TECHNICAL_OFFICE/TEC_APPROVER أُضيفا — كانا محجوبين عن التعديل رغم أن
  // updateQuotation (المستدعى من QuotationBuilder) محروس بـPRICING_ROLES التي تشملهما.
  // TO-26: تعديل العرض جزء من التسعير. ⚠️ حارس L-08 (عرض له عقد) يبقى نافذًا
  // داخل `updateQuotation` ولم يُمس — الفتح هنا لا يمسّ حصانة العقد الموقّع.
  // TO-29: `SALES_MANAGER` أُزيل — تعديل العرض تسعير. ⚠️ أثر معلوم على بيانات قائمة:
  // يفقد تعديل Q-2026-00022 (العرض الوحيد الذي أنشأه). يحتفظ بتغيير الحالة
  // (QUOTATION_STATUS_ROLES) وطلب الخصم (DISCOUNT_ROLES) والعرض والطباعة.
  const roleCheck = await requireRole([
    "ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER", "TEC_LEAD",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [quotation, customers, productTypes, pricingFactors] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    }),
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    getProductTypes(),
    getPricingFactors(),
  ]);

  if (!quotation) notFound();

  // 🔴 TO-36 — كان `initialTitle={quotation.number}`، وأسماء البنود تُشتق من
  // العنوان ⇒ كل حفظ يستبدل اسم المنتج برقم العرض («Q-2026-00039 - 1»)، فيصل
  // العميل مستند بلا معنى. لا عمود `title` على `Quotation` — العنوان عابر يُستعمل
  // وقت الإنشاء فقط — فالمصدر الصادق الوحيد هو اسم أول بند بعد نزع اللاحقة
  // « - رقم». يخدم الأقسام **الجديدة** وحدها؛ القديمة تصون أسماءها المحفوظة.
  const derivedTitle =
    quotation.items[0]?.description.replace(/\s*-\s*\d+\s*$/, "").trim() || quotation.number;

  return (
    <QuotationBuilder
      mode="edit"
      quotationId={quotation.id}
      initialCustomerId={quotation.customerId}
      initialTitle={derivedTitle}
      initialItems={quotation.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        // TO-33: `Json?` يصل كـJsonValue — الواجهة تتعامل معه كمدخلات تسعير أو null.
        // ⚠️ التحقق الصارم يبقى server-side (`parseItemPricing`) عند الحفظ: هذا
        // الحقل بيانات محفوظة لا عقد موثوق، والمحرك يعيد الحساب من القاعدة دائمًا.
        pricingInput: (item.pricingInput as ItemPricingInput | null) ?? null,
      }))}
      customers={customers}
      productTypes={productTypes}
      pricingFactors={pricingFactors.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value.toNumber(),
      }))}
    />
  );
}
