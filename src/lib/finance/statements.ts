"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  createStatement,
  issueStatement,
  StatementError,
} from "@/lib/services/statements";

// SCR-015 دفعة 1: server actions للمستخلصات — الحراسة هنا، المنطق في services/statements.ts
const STATEMENT_ROLES = ["ACCOUNTING", "ADMIN"];

const createStatementSchema = z.object({
  contractId: z.string().min(1, "errors.invalidInput"),
  progressPct: z.coerce
    .number()
    .positive("errors.invalidInput")
    .max(100, "errors.invalidInput"),
  milestoneId: z.string().optional(),
  notes: z.string().optional(),
});

export async function createStatementAction(input: unknown) {
  try {
    const roleCheck = await requireRole(STATEMENT_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = createStatementSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const statement = await createStatement(parsed.data, roleCheck.userId);
    return { success: true as const, id: statement.id };
  } catch (e) {
    if (e instanceof StatementError) return { error: e.message };
    console.error("[createStatementAction]", e);
    return { error: "errors.serverError" as const };
  }
}

const issueStatementSchema = z.object({ id: z.string().min(1, "errors.invalidInput") });

export async function issueStatementAction(input: unknown) {
  try {
    const roleCheck = await requireRole(STATEMENT_ROLES);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = issueStatementSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const statement = await issueStatement(parsed.data.id, roleCheck.userId);
    return {
      success: true as const,
      id: statement.id,
      documentNumber: statement.documentNumber,
    };
  } catch (e) {
    if (e instanceof StatementError) return { error: e.message };
    console.error("[issueStatementAction]", e);
    return { error: "errors.serverError" as const };
  }
}
