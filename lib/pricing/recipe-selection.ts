// TO-05 — قاعدة اختيار أسطر الوصفة، مصدر واحد للواجهة والسيرفر.
//
// لماذا ملف مستقل: `calculateRecipe` يُرجع **كل** خيارات الوصفة (كل أنواع الزجاج،
// كل القطاعات...)، والمستخدم يختار واحدًا لكل فئة في الواجهة. السعر المحفوظ
// (`QuotationItem.unitPrice`) ناتج عن ذلك الاختيار، فلا يمكن حساب تكلفة الكتالوج
// المقابلة له على السيرفر دون إعادة إنتاج **نفس** قاعدة الاختيار حرفيًا.
// نسخة ثانية من القاعدة = انحراف صامت بين السعر والتكلفة ⇒ هامش كاذب.
//
// الملف نقي عمدًا: بلا `"use server"`، وبلا استيراد من `@prisma/client`، ليعمل
// على الطرفين (مكوّن كلاينت + server action) بلا حِزم إضافية في الـbundle.

/** الحد الأدنى الذي تحتاجه قاعدة الاختيار — يقبل سطر `calculateRecipe` وأي شكل مطابق. */
export type SelectableLine = {
  materialId: string;
  notes: string | null;
};

/** مدخلات إعادة حساب التكلفة على السيرفر — ما يكفي بالضبط لإعادة إنتاج أسطر الوصفة المختارة. */
export type ItemPricingInput = {
  productTypeCode: string;
  height: number;
  width: number;
  configTypeId?: string;
  pricingFactorId: string;
  /** فئة الوصفة (`ProductRecipe.notes`) → `materialId` المختار. نفس شكل حالة الواجهة. */
  selections: Record<string, string>;
};

/** تجميع أسطر الوصفة بالفئة (`notes`). سطر بلا فئة ⇒ `"OTHER"`. */
export function groupRecipeLines<T extends SelectableLine>(lines: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const line of lines) {
    const key = line.notes ?? "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(line);
  }
  return groups;
}

/**
 * القاعدة: فئة بخيار واحد أو أقل ⇒ تُضم تلقائيًا (سيليكون مثلًا).
 * فئة بأكثر من خيار ⇒ الخيار المختار فقط، ولا شيء إن لم يُختر (بند ناقص عمدًا — لا تخمين بديل).
 *
 * الترتيب مقصود (التلقائي أولًا ثم المختار) لأن الواجهة تعرض هذه القائمة كما هي.
 */
export function selectRecipeLines<T extends SelectableLine>(
  groups: Record<string, T[]>,
  selections: Readonly<Record<string, string>>
): T[] {
  const categories = Object.keys(groups);

  const autoIncluded = categories
    .filter((category) => groups[category].length <= 1)
    .flatMap((category) => groups[category]);

  const chosen: T[] = [];
  for (const category of categories) {
    if (groups[category].length <= 1) continue;
    const materialId = selections[category];
    if (!materialId) continue;
    const line = groups[category].find((l) => l.materialId === materialId);
    if (line) chosen.push(line);
  }

  return [...autoIncluded, ...chosen];
}
