export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { Unauthorized } from "@/components/unauthorized";
import { getQuotations } from "@/lib/services/quotations";
import { getCustomers } from "@/lib/services/customers";
import { QuotationsClient } from "./quotations-client";

export default async function QuotationsPage() {
  // TO-23: المكتب الفني كان **ينشئ** عروضًا ولا يملك أي شاشة تعرضها (`/quotations/new`
  // مسموحة له، وهذه لم تكن). الوصول يُفتح هنا، و**النطاق** يفرضه `getQuotations`:
  // TECHNICAL_OFFICE → عروضه · TEC_LEAD → عروض مساره. فتح الحارس وحده لا يكفي.
  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
    "TECHNICAL_OFFICE",
    "TEC_LEAD",
  ]);
  if (!roleCheck.authorized) return <Unauthorized />;

  const quotations = await getQuotations(roleCheck.userId, roleCheck.role);

  // SF-01: قائمة عملاء المندوب لِمُنتقي التدفّق (عميل→طلب). تُجلب للمندوب فقط —
  // getCustomers مُنطاق ذاتيًا (ownerId/coveredById) بلا أي تغيير RBAC.
  // TO-29: أُضيف SALES_MANAGER لأنه صار يرى مُنتقي الطلب بدل زر الباني — ودياله
  // بلا قائمة عملاء = حوار فارغ لا يفعل شيئًا. **صفر تغيير RBAC:** `getCustomers`
  // مُنطاق ذاتيًا ولا يضيّق إلا لـSALES_REP (customers.ts:46)، فالمدير يحصل على
  // نفس ما يراه في /customers اليوم بالضبط.
  const customers =
    ["SALES_REP", "SALES_MANAGER"].includes(roleCheck.role)
      ? (await getCustomers(roleCheck.userId, roleCheck.role)).map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))
      : [];

  return (
    <QuotationsClient
      initialQuotations={quotations}
      currentRole={roleCheck.role}
      customers={customers}
    />
  );
}
