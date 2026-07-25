export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/rbac";
import { Unauthorized } from "@/components/unauthorized";
import { getQuotations } from "@/lib/services/quotations";
import { getCustomers } from "@/lib/services/customers";
import { QuotationsClient } from "./quotations-client";

export default async function QuotationsPage() {
  const roleCheck = await requireRole([
    "ADMIN",
    "SALES_MANAGER",
    "SALES_REP",
    "VIEWER",
  ]);
  if (!roleCheck.authorized) return <Unauthorized />;

  const quotations = await getQuotations(roleCheck.userId, roleCheck.role);

  // SF-01: قائمة عملاء المندوب لِمُنتقي التدفّق (عميل→طلب). تُجلب للمندوب فقط —
  // getCustomers مُنطاق ذاتيًا (ownerId/coveredById) بلا أي تغيير RBAC.
  const customers =
    roleCheck.role === "SALES_REP"
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
