export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/config";
import { QuotationDetail } from "./_components/quotation-detail";
// TO-34: نوع مدخلات التسعير المحفوظة (TO-33) — يُقرأ للعرض فقط.
import type { ItemPricingInput } from "../new/_components/product-recipe-form";

export default async function QuotationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // TO-23: يُفتح للمكتب الفني — لكن **الوصول ليس الرؤية**. الحارس يقول «الدور مسموح»،
  // والنطاق أدناه يقول «هذا العرض بالذات مسموح». بلا الثاني يصير فتح الحارس ثغرة IDOR:
  // أي عنوان `/quotations/<id>` يُظهر أي عرض في الشركة.
  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
    "TECHNICAL_OFFICE",
    "TEC_LEAD",
  ]);
  if (!roleCheck.authorized) redirect("/dashboard");

  // نطاق المورد للدورين الجديدين فقط. نفس قاعدة `getQuotations` حرفيًا، مطبَّقة على
  // عرض واحد. ⚠️ أدوار المبيعات **لم تُمس** (نطاقها القائم خارج نطاق TO-23).
  const scope: Record<string, unknown> = { id };
  if (roleCheck.role === "TECHNICAL_OFFICE") {
    scope.createdById = roleCheck.userId;
  } else if (roleCheck.role === "TEC_LEAD") {
    const lead = await prisma.user.findUnique({
      where: { id: roleCheck.userId },
      select: { leadRoute: true },
    });
    if (!lead?.leadRoute) notFound();
    scope.quotationRequest = { technicalRoute: lead.leadRoute };
  }

  const [quotation, discountRequest, settings] = await Promise.all([
    prisma.quotation.findFirst({
      where: scope,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
        items: true,
        // TO-24: وجود الطلب هو ما يحدّد أن العرض داخل بوابة الاعتماد المبدئي.
        quotationRequest: { select: { id: true, technicalRoute: true } },
      },
    }),
    prisma.discountRequest.findFirst({
      where: { quotationId: id, status: "PENDING" },
      select: { id: true, requestedPct: true, reason: true, createdAt: true },
    }),
    getSystemSettings(),
  ]);

  if (!quotation) notFound();

  // TO-23: `updatedById` عمود scalar بلا relation (SCR-021) — الاسم باستعلام منفصل،
  // نفس نمط approvedById في قالب الطباعة (print/page.tsx:56-59).
  // 🔴 TO-34 — تفاصيل البند للقراءة من `pricingInput` (TO-33). `selections` تحمل
  // **معرّفات** خامات، والمستخدم يحتاج أسماءها العربية.
  // ⚠️ استعلام **واحد** لكل الأسماء عبر كل البنود (`id: { in: [...] }`) — لا N+1:
  // عرض بعشرة بنود × خمس خامات كان سيصير 50 استعلامًا على فتح شاشة واحدة.
  const itemPricings = quotation.items.map(
    (item) => item.pricingInput as ItemPricingInput | null
  );
  const materialIds = [
    ...new Set(
      itemPricings.flatMap((p) => (p ? Object.values(p.selections ?? {}) : [])).filter(Boolean)
    ),
  ];
  const factorIds = [...new Set(itemPricings.map((p) => p?.pricingFactorId).filter(Boolean))];
  const typeCodes = [...new Set(itemPricings.map((p) => p?.productTypeCode).filter(Boolean))];

  const [materials, factors, productTypes] = await Promise.all([
    materialIds.length
      ? prisma.material.findMany({
          where: { id: { in: materialIds as string[] } },
          select: { id: true, nameAr: true },
        })
      : Promise.resolve([]),
    factorIds.length
      ? prisma.pricingFactor.findMany({
          where: { id: { in: factorIds as string[] } },
          select: { id: true, label: true },
        })
      : Promise.resolve([]),
    typeCodes.length
      ? prisma.productType.findMany({
          where: { code: { in: typeCodes as string[] } },
          select: { code: true, nameAr: true },
        })
      : Promise.resolve([]),
  ]);

  const materialNames = Object.fromEntries(materials.map((m) => [m.id, m.nameAr]));
  const factorLabels = Object.fromEntries(factors.map((f) => [f.id, f.label]));
  const typeNames = Object.fromEntries(productTypes.map((p) => [p.code, p.nameAr]));

  const lastUpdater = quotation.updatedById
    ? await prisma.user.findUnique({
        where: { id: quotation.updatedById },
        select: { name: true },
      })
    : null;

  return (
    <QuotationDetail
      quotation={{
        id: quotation.id,
        number: quotation.number,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        validUntil: quotation.validUntil.toISOString(),
        subtotal: quotation.subtotal.toNumber(),
        // TO-39-B: كتلة الإجماليات كانت تعرض المجموع والضريبة والإجمالي بلا سطر
        // خصم، فبعد TO-39 صارت لا تجمع أمام المستخدم. الحقلان يصلان الآن لتُعرض
        // نفس أسطر المستند المطبوع بنفس شرطه.
        discountPct: quotation.discountPct.toNumber(),
        discountAmount: quotation.discountAmount.toNumber(),
        taxPct: quotation.taxPct.toNumber(),
        taxAmount: quotation.taxAmount.toNumber(),
        total: quotation.total.toNumber(),
        customer: quotation.customer,
        createdBy: quotation.createdBy,
        lastUpdatedBy: lastUpdater?.name ?? null,
        lastUpdatedAt: quotation.updatedAt.toISOString(),
        // TO-24: حالة البوابة + ما تحتاجه الواجهة لاشتقاق الأزرار والوسوم.
        // `isSelfLeadApproved` مُشتق هنا لا عمود (قرار المالك) — المقارنة server-side
        // كي لا تُسرَّب معرّفات المستخدمين للواجهة بلا داعٍ.
        isGatedByLead: Boolean(quotation.quotationRequest),
        leadApprovalStatus: quotation.leadApprovalStatus,
        leadNote: quotation.leadNote,
        isSelfLeadApproved:
          quotation.leadDecidedById !== null &&
          quotation.leadDecidedById === quotation.createdById,
        isCreator: quotation.createdById === roleCheck.userId,
        items: quotation.items.map((item, i) => {
          const p = itemPricings[i];
          return {
            id: item.id,
            description: item.description,
            quantity: item.quantity.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
            lineTotal: item.lineTotal.toNumber(),
            // TO-34: تفاصيل جاهزة للعرض — الأسماء مُحلّة هنا server-side.
            // 🔴 **صفر `costSnapshot`**: بيانات تكلفة لا تُعرض في هذه الشاشة إطلاقًا،
            // ولا أي اشتقاق منها (هامش/ربح). مكانها الداشبورد بقرار منفصل.
            // null = بند يدوي أو سابق لـTO-33 ⇒ الواجهة تقول ذلك صراحةً.
            details: p
              ? {
                  productTypeName: typeNames[p.productTypeCode] ?? p.productTypeCode,
                  height: p.height,
                  width: p.width,
                  factorLabel: factorLabels[p.pricingFactorId] ?? null,
                  panelCount: p.panelCount ?? null,
                  materials: Object.values(p.selections ?? {})
                    .map((id) => materialNames[id])
                    .filter(Boolean) as string[],
                }
              : null,
          };
        }),
      }}
      currentRole={roleCheck.role}
      discountRequest={
        discountRequest
          ? {
              id: discountRequest.id,
              requestedPct: discountRequest.requestedPct.toNumber(),
              reason: discountRequest.reason,
              createdAt: discountRequest.createdAt.toISOString(),
            }
          : null
      }
      discountMaxReqPct={settings?.discountMaxReqPct.toNumber() ?? 25}
    />
  );
}
