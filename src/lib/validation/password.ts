import { z } from "zod";

// SCR-016: سياسة كلمة المرور الموحّدة — طول ≥8 + 3 فئات على الأقل من 4
// (حروف صغيرة/كبيرة/أرقام/رموز). المصدر الوحيد لهذه القاعدة — يستهلكها
// إنشاء/تحديث المستخدم (الأدمن) وتغيير المستخدم كلمة مروره بنفسه.
export const passwordPolicy = z
  .string()
  .min(8, "errors.passwordMinLength8")
  .refine((p) => {
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) =>
      r.test(p)
    ).length;
    return classes >= 3;
  }, "errors.passwordComplexity");
