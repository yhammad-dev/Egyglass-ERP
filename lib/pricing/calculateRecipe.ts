import type { ProductRecipe, Material, FactorMode, QtyRule } from "@prisma/client"

interface Dimensions {
  area: number
  length: number
  configCount: number
}

interface RecipeLineResult {
  materialId: string
  notes: string | null
  nameAr: string
  qty: number
  unitCost: number
  lineTotal: number
  factorMode: FactorMode
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
    })
  }

  return {
    lines,
    subtotalBeforeFixed,
    fixedTotal,
    grandTotal: subtotalBeforeFixed + fixedTotal,
  }
}
