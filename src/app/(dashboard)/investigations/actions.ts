"use server";

import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  openFaultInvestigation,
  saveEvidenceNotes,
  judgeFaultInvestigation,
  FAULT_TYPES,
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

// PHASE 2: ملاحظات الأثر — REVIEW تجمّع، النظام يعرض فقط (D-25: لا استنتاج آليًا)
const notesSchema = z.object({
  investigationId: z.string().min(1, "errors.invalidInput"),
  notes: z.string().max(10000, "errors.invalidInput"),
});

export async function saveEvidenceNotesAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["REVIEW", "ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = notesSchema.safeParse(input);
    if (!parsed.success) return { error: "errors.invalidInput" as const };

    await saveEvidenceNotes(parsed.data.investigationId, parsed.data.notes, roleCheck.userId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof FaultInvestigationError) return { error: e.message };
    console.error("[saveEvidenceNotesAction]", e);
    return { error: "errors.serverError" as const };
  }
}

// PHASE 3 (D-25): الحُكم — ADMIN وحده. REVIEW طرف في السلسلة فلا تحكم على نفسها.
const judgeSchema = z.object({
  investigationId: z.string().min(1, "errors.invalidInput"),
  verdictFault: z.enum(FAULT_TYPES),
  verdictNotes: z.string().trim().min(1, "errors.verdictNotesRequired").max(10000),
});

export async function judgeFaultInvestigationAction(input: unknown) {
  try {
    const roleCheck = await requireRole(["ADMIN"]);
    if (!roleCheck.authorized) return { error: "errors.notAuthorized" as const };

    const parsed = judgeSchema.safeParse(input);
    if (!parsed.success) {
      const notesIssue = parsed.error.issues.some((i) => i.path[0] === "verdictNotes");
      return {
        error: (notesIssue ? "errors.verdictNotesRequired" : "errors.invalidInput") as string,
      };
    }

    await judgeFaultInvestigation(
      parsed.data.investigationId,
      parsed.data.verdictFault,
      parsed.data.verdictNotes,
      roleCheck.userId
    );
    return { success: true as const };
  } catch (e) {
    if (e instanceof FaultInvestigationError) return { error: e.message };
    console.error("[judgeFaultInvestigationAction]", e);
    return { error: "errors.serverError" as const };
  }
}
