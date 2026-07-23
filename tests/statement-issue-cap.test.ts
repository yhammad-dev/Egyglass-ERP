import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { issueStatement, StatementError } from "@/lib/services/statements";

// BL-130 (Q2): حاجز السقف عند issueStatement — لا مُشغِّل اختبارات في المشروع، يُشغَّل بـ tsx.
// نعزل قاعدة البيانات بحقن $transaction وهمي على السنغلتون prisma: issueStatement يستدعي
// prisma.$transaction(cb)، فنمرّر tx وهميًا لنفس الـ callback الحقيقي ⇒ يُختبَر الكود الفعلي
// (بما فيه الحاجز الجديد) دون أي كتابة على قاعدة حقيقية (احترام L-04 + STD-14).
const D = Prisma.Decimal;

type Calls = { updateCalled: boolean; activityCreated: boolean };

interface FakeTx {
  progressStatement: {
    findUnique: (args?: unknown) => Promise<unknown>;
    aggregate: (args?: unknown) => Promise<{ _sum: { progressPct: Prisma.Decimal | null } }>;
    findMany: (args?: unknown) => Promise<unknown[]>;
    update: (args?: unknown) => Promise<{
      id: string;
      status: string;
      documentNumber: string;
      progressPct: Prisma.Decimal;
    }>;
  };
  activityLog: { create: (args?: unknown) => Promise<unknown> };
}

/** tx وهمي قابل للتهيئة: مسودة DRAFT بنسبة draftPct + مجموع الصادر ISSUED+PAID = issuedSum */
function makeFakeTx(opts: {
  draftPct: string;
  issuedSum: string | null;
  calls: Calls;
}): FakeTx {
  return {
    progressStatement: {
      findUnique: async () => ({
        id: "stmt_test",
        status: "DRAFT",
        contractId: "c_test",
        progressPct: new D(opts.draftPct),
        contract: {
          id: "c_test",
          totalValue: new D("100000"),
          // مسار سوشيال يقلّص سطح الوهم: توليد رقم C3_ يحتاج findMany فقط
          quotation: { quotationRequest: { technicalRoute: "SOCIAL_MEDIA" } },
        },
      }),
      aggregate: async () => ({
        _sum: { progressPct: opts.issuedSum === null ? null : new D(opts.issuedSum) },
      }),
      findMany: async () => [], // C3_ document number → لا مستخلصات سوشيال سابقة
      update: async () => {
        opts.calls.updateCalled = true;
        return {
          id: "stmt_test",
          status: "ISSUED",
          documentNumber: "C3_1",
          progressPct: new D(opts.draftPct),
        };
      },
    },
    activityLog: {
      create: async () => {
        opts.calls.activityCreated = true;
        return {};
      },
    },
  };
}

// حد الحقن الوحيد: prisma.$transaction له نوع Prisma مركّب — نحقن عبر خاصية unknown
// (لا @ts-ignore ولا any؛ إسناد لخاصية unknown مسموح ونظيف).
const injectable = prisma as unknown as { $transaction: unknown };
const realTransaction = injectable.$transaction;
function installFakeTx(fakeTx: FakeTx) {
  injectable.$transaction = (fn: (tx: FakeTx) => Promise<unknown>) => fn(fakeTx);
}
function restore() {
  injectable.$transaction = realTransaction;
}

async function main() {
  // (1) مسودة قديمة تتجاوز الحد: صادر 100% + مسودة 60% = 160% → تُرفض عند الإصدار، صفر كتابة.
  {
    const calls: Calls = { updateCalled: false, activityCreated: false };
    installFakeTx(makeFakeTx({ draftPct: "60", issuedSum: "100", calls }));
    let thrown: unknown = null;
    try {
      await issueStatement("stmt_test", "actor_test");
    } catch (e) {
      thrown = e;
    } finally {
      restore();
    }
    assert.ok(
      thrown instanceof StatementError,
      "إصدار مسودة تتجاوز 100% كان يجب أن يُرفض بـ StatementError"
    );
    assert.equal(
      (thrown as StatementError).message,
      "errors.statementProgressExceeds100"
    );
    assert.equal(calls.updateCalled, false, "رفض ⇒ update يجب ألا يُستدعى (صفر كتابة)");
    assert.equal(calls.activityCreated, false, "رفض ⇒ سجل ActivityLog يجب ألا يُكتب");
  }

  // (2) مستخلص عادي ضمن الحد: صادر 40% + مسودة 30% = 70% ≤ 100 → يُصدَر عادي بلا كسر.
  {
    const calls: Calls = { updateCalled: false, activityCreated: false };
    installFakeTx(makeFakeTx({ draftPct: "30", issuedSum: "40", calls }));
    let err: unknown = null;
    let result: { status: string } | null = null;
    try {
      result = (await issueStatement("stmt_test", "actor_test")) as { status: string };
    } catch (e) {
      err = e;
    } finally {
      restore();
    }
    assert.equal(err, null, "مستخلص ضمن الحد يجب ألا يرمي");
    assert.equal(result?.status, "ISSUED", "المستخلص العادي يجب أن يُصدَر (ISSUED)");
    assert.equal(calls.updateCalled, true, "المسار الطبيعي: update يُستدعى");
    assert.equal(calls.activityCreated, true, "المسار الطبيعي: سجل ActivityLog يُكتب");
  }

  // (3) حد فاصل: صادر 40% + مسودة 60% = 100% بالضبط → مسموح (الرفض عند التجاوز لا البلوغ).
  {
    const calls: Calls = { updateCalled: false, activityCreated: false };
    installFakeTx(makeFakeTx({ draftPct: "60", issuedSum: "40", calls }));
    let err: unknown = null;
    try {
      await issueStatement("stmt_test", "actor_test");
    } catch (e) {
      err = e;
    } finally {
      restore();
    }
    assert.equal(err, null, "100% بالضبط مسموح عند الإصدار");
    assert.equal(calls.updateCalled, true, "100% بالضبط: يُصدَر فعلًا");
  }

  console.log(
    "PASS statement-issue-cap: إصدار متجاوز 100% مرفوض (صفر كتابة) · عادي يُصدَر · 100% بالضبط مقبول"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
