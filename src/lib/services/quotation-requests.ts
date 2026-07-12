import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications/send";
import { generateRequestCode } from "@/lib/finance/document-number";

// دفعة هـ (W-01): المندوب يطلب التسعير — لا يسعّر. الطلب نقطة الدخول لكل سلسلة المكتب الفني.
export class QuotationRequestError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "QuotationRequestError";
  }
}

export interface CreateQuotationRequestInput {
  customerId: string;
  technicalRoute: "PROJECTS" | "SOCIAL_MEDIA";
  summary: string;
}

export async function createQuotationRequest(
  input: CreateQuotationRequestInput,
  actorId: string
) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new QuotationRequestError("errors.notFound");

  const code = await generateRequestCode(prisma, input.technicalRoute);

  const request = await prisma.quotationRequest.create({
    data: {
      code,
      customerId: input.customerId,
      technicalRoute: input.technicalRoute,
      summary: input.summary,
      salesOwnerId: actorId,
      status: "NEW",
      // engineerId يبقى null — التوزيع اليدوي من مدير المكتب الفني (قرار ب)
      // quotationId يبقى null — المكتب الفني ينشئ العرض ويربطه (W-01)
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: "QUOTATION_REQUEST_CREATED",
      entity: "QuotationRequest",
      entityId: request.id,
      details: `طلب تسعير ${code} (${input.technicalRoute}) للعميل ${customer.name}`,
    },
  });

  // إشعار صريح: يحتاج إسنادًا (لا إشعار عام) — البروز الحقيقي في شاشة "غير مُسنَدة"
  await notifyRole("TECHNICAL_OFFICE", {
    title: "notifications.newRequestNeedsAssignmentTitle",
    body: `طلب تسعير جديد ${code} يحتاج إسنادًا — العميل ${customer.name}`,
    type: "QUOTATION_REQUEST_CREATED",
    entityId: request.id,
    entityType: "QuotationRequest",
  });

  return request;
}
