"use server";

import * as XLSX from "xlsx";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { MaterialCategory, MaterialUnit } from "@prisma/client";
import { randomUUID } from "crypto";

const MATERIAL_CATEGORIES = new Set<string>([
  "GLASS","GLASS_ADDON_AREA","CHAMFER","SECTION","DOOR_SET","MACHINE",
  "HANDLE","OPEN_CLOSE","ACCESSORY","TENSION","ELBOW","CEILING_STRIP",
  "LATCH","SPIDER","OTHER",
]);

const MATERIAL_UNITS = new Set<string>(["SQM","LINEAR_M","PIECE","SET"]);

export async function importPriceListAction(formData: FormData) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const file = formData.get("file") as File | null;
    if (!file) return { error: "errors.required" as const };

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const rows: {
      category: string;
      spec: string;
      unit: string;
      price: number;
      isActive: boolean;
      updatedById: string;
    }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      for (const row of data) {
        const spec = String(row["spec"] ?? row["المواصفة"] ?? "").trim();
        const unit = String(row["unit"] ?? row["الوحدة"] ?? "").trim();
        const rawPrice = row["price"] ?? row["السعر"];
        const price = parseFloat(String(rawPrice));

        if (!spec || !unit || isNaN(price) || price < 0) continue;

        rows.push({
          category: sheetName.trim(),
          spec,
          unit,
          price,
          isActive: true,
          updatedById: auth.userId,
        });
      }
    }

    if (rows.length === 0) return { error: "import.noValidRows" as const };

    const result = await prisma.priceListItem.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { success: true as const, count: result.count };
  } catch (err) {
    console.error("[importPriceListAction]", err);
    return { error: "errors.serverError" as const };
  }
}

export async function importMaterialsAction(formData: FormData) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if (!auth.authorized) return { error: "errors.notAuthorized" as const };

    const file = formData.get("file") as File | null;
    if (!file) return { error: "errors.required" as const };

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let count = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      for (const row of data) {
        const code    = String(row["code"]    ?? row["الكود"]     ?? "").trim();
        const nameAr  = String(row["nameAr"]  ?? row["الاسم"]     ?? "").trim();
        const catRaw  = String(row["category"]?? row["التصنيف"]   ?? "").trim().toUpperCase();
        const unitRaw = String(row["unit"]    ?? row["الوحدة"]    ?? "").trim().toUpperCase();
        const rawCost = row["cost"] ?? row["التكلفة"];
        const cost    = parseFloat(String(rawCost));

        if (!code || !nameAr || !MATERIAL_CATEGORIES.has(catRaw) || !MATERIAL_UNITS.has(unitRaw) || isNaN(cost)) continue;

        await prisma.material.upsert({
          where: { code },
          create: {
            id: randomUUID(),
            code,
            nameAr,
            category: catRaw as MaterialCategory,
            cost,
            unit: unitRaw as MaterialUnit,
            isActive: true,
            updatedAt: new Date(),
          },
          update: {
            nameAr,
            category: catRaw as MaterialCategory,
            cost,
            unit: unitRaw as MaterialUnit,
          },
        });

        count++;
      }
    }

    if (count === 0) return { error: "import.noValidRows" as const };

    return { success: true as const, count };
  } catch (err) {
    console.error("[importMaterialsAction]", err);
    return { error: "errors.serverError" as const };
  }
}
