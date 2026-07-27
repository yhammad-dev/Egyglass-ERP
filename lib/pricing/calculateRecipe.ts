import type { ProductRecipe, Material, FactorMode, QtyRule } from "@prisma/client"

interface Dimensions {
  area: number
  length: number
  configCount: number
  /**
   * TO-40: عدد ألواح الواجهة. مدخل بشري لا مُشتق — التقسيم الفعلي قرار تصميم
   * لا يُستنتج من العرض وحده (القيمة المقترحة في الواجهة اقتراح قابل للتعديل).
   * 0 = المنتج لا يستعمل قواعد الألواح، أو لم يُدخَل بعد ⇒ القاعدتان تُرجعان 0.
   */
  panelCount: number
}

interface RecipeLineResult {
  materialId: string
  notes: string | null
  nameAr: string
  qty: number
  unitCost: number
  lineTotal: number
  factorMode: FactorMode
  /**
   * TO-40: قاعدة الكمية ومُعاملها — تُعرضان في جدول النتيجة لأسطر الألواح كي
   * يفهم المهندس مصدر الرقم بدل أن يثق به عميًا. **بيانات عرض فقط**: لا تدخل
   * أي حساب ولا تُحفظ، والحقلان مضافان في آخر النوع بلا مساس بالقائم.
   */
  qtyRule: QtyRule
  qtyMultiplier: number
}

interface CalculationResult {
  lines: RecipeLineResult[]
  subtotalBeforeFixed: number
  fixedTotal: number
  grandTotal: number
}

function resolveQty(qtyRule: QtyRule, defaultQty: number | null, dimensions: Dimensions): number {
  switch (qtyRule) {
    case "FIXED":
      return defaultQty ?? 1
    case "BY_AREA":
      return (defaultQty ?? 0) * dimensions.area
    case "BY_LENGTH":
      return (defaultQty ?? 0) * dimensions.length
    case "BY_CONFIG":
      return (defaultQty ?? 0) * dimensions.configCount
    case "MANUAL":
      return defaultQty ?? 0
    // TO-40 — القاعدتان الجديدتان. الحالات الخمس أعلاه لم تُمس بحرف.
    // `panelCount = 0` ⇒ صفر لا تخمين: كمية مُلفّقة أخطر من صفر ظاهر.
    case "BY_PANEL":
      return (defaultQty ?? 0) * dimensions.panelCount
    case "BY_PANEL_JOINT":
      // الخطوط الرأسية = الألواح + 1 (بين كل لوحين وعلى الطرفين). عند صفر ألواح
      // لا واجهة أصلًا، فلا يصح أن تُنتج القاعدة خطًّا واحدًا من العدم.
      return dimensions.panelCount > 0
        ? (defaultQty ?? 0) * (dimensions.panelCount + 1)
        : 0
  }
}

export function calculateRecipe(
  recipes: (ProductRecipe & { Material: Material | null })[],
  dimensions: Dimensions,
  globalFactor: number
): CalculationResult {
  const lines: RecipeLineResult[] = []
  let subtotalBeforeFixed = 0
  let fixedTotal = 0

  for (const recipe of recipes) {
    const material = recipe.Material
    if (!material || material.isActive === false) continue

    const defaultQty = recipe.defaultQty ? recipe.defaultQty.toNumber() : null
    const qty = resolveQty(recipe.qtyRule, defaultQty, dimensions)
    const unitCost = material.cost.toNumber()
    const customFactor = recipe.customFactor ? recipe.customFactor.toNumber() : null

    let lineTotal: number
    switch (recipe.factorMode) {
      case "STANDARD":
        lineTotal = qty * unitCost * globalFactor
        subtotalBeforeFixed += lineTotal
        break
      case "FIXED_AFTER":
        lineTotal = qty * unitCost
        fixedTotal += lineTotal
        break
      case "CUSTOM_FACTOR":
        lineTotal = qty * unitCost * (customFactor ?? 1)
        subtotalBeforeFixed += lineTotal
        break
    }

    lines.push({
      materialId: material.id,
      notes: recipe.notes,
      nameAr: material.nameAr,
      qty,
      unitCost,
      lineTotal,
      factorMode: recipe.factorMode,
      qtyRule: recipe.qtyRule,
      qtyMultiplier: defaultQty ?? 0,
    })
  }

  return {
    lines,
    subtotalBeforeFixed,
    fixedTotal,
    grandTotal: subtotalBeforeFixed + fixedTotal,
  }
}
