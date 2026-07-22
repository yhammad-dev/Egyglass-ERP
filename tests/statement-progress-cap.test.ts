import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  assertProgressWithinContractCap,
  StatementError,
} from "@/lib/services/statements";

// اختبار الحاجز الاحترازي المؤقت لسقف نسبة المستخلصات (لا مُشغِّل اختبارات في المشروع — يُشغَّل بـ tsx).
const D = Prisma.Decimal;

// الحالة المُثبَتة حيًا: مستخلصات صادرة بمجموع 100% ثم مستخلص جديد بـ 60% → المجموع 160%.
let thrown: unknown = null;
try {
  assertProgressWithinContractCap(new D("100"), new D("60"));
} catch (e) {
  thrown = e;
}

assert.ok(thrown instanceof StatementError, "المجموع التراكمي 160% كان يجب أن يُرفض بـ StatementError");
assert.equal((thrown as StatementError).message, "errors.statementProgressExceeds100");

// حالة الحد الفاصل: 100% بالضبط مسموحة — الرفض عند التجاوز لا عند البلوغ.
assert.doesNotThrow(() => assertProgressWithinContractCap(new D("40"), new D("60")));

// تجاوز بكسر عشري صغير يُرفض أيضًا (Decimal لا float).
assert.throws(
  () => assertProgressWithinContractCap(new D("99.99"), new D("0.02")),
  StatementError
);

console.log("PASS statement-progress-cap: مجموع تراكمي > 100% مرفوض · 100% بالضبط مقبول");
