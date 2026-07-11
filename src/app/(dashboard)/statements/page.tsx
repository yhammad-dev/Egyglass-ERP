export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { StatementsClient } from "./statements-client";

// SCR-015 دفعة 2: شاشة إدارة المستخلصات — قراءة القائمة هنا، الـ mutations عبر actions دفعة 1
export default async function StatementsPage() {
  const roleCheck = await requireRole(["ACCOUNTING", "ADMIN"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [statements, contracts] = await Promise.all([
    prisma.progressStatement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          select: {
            id: true,
            customer: { select: { name: true } },
            quotation: { select: { number: true } },
          },
        },
      },
    }),
    prisma.contract.findMany({
      where: { totalValue: { not: null } },
      select: {
        id: true,
        totalValue: true,
        customer: { select: { name: true } },
        quotation: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <StatementsClient
      initialStatements={statements.map((s) => ({
        id: s.id,
        documentNumber: s.documentNumber,
        contractLabel: `${s.contract.customer.name} — ${s.contract.quotation.number}`,
        progressPct: s.progressPct.toNumber(),
        statementValue: s.statementValue.toNumber(),
        status: s.status,
        issuedAt: s.issuedAt?.toISOString() ?? null,
        notes: s.notes,
      }))}
      contracts={contracts.map((c) => ({
        id: c.id,
        label: `${c.customer.name} — ${c.quotation.number} (${c.totalValue})`,
      }))}
    />
  );
}
