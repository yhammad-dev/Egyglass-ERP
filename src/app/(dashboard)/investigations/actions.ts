"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  openFaultInvestigation,
  FaultInvestigationError,
} from "@/lib/services/fault-investigations";

// SCR-017 PHASE 1 (D-25): REVIEW تفتح التحقيق — ADMIN يحكم لاحقًا (PHASE 3)
const openSchema = z.object({
  installationItemId: z.string().min(1, "errors.invalidInput"),
});

export async function openFaultInvestigationAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["REVIEW", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = openSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    const investigation = await openFaultInvestigation(
      parsed.data.installationItemId,
      roleCheck.userId
    );
    return { success: true as const, id: investigation.id };
  } catch (e) {
    if (e instanceof FaultInvestigationError) return { error: e.message };
    console.error("[openFaultInvestigationAction]", e);
    return { error: "errors.serverError" as const };
  }
}
