"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "../../../../../../../lib/contracts/actions";
import { DocumentUpload } from "@/components/document-upload";

export function ContractForm({
  quotationId,
  customerId,
  existingContract,
}: {
  quotationId: string;
  customerId: string;
  existingContract: { signedAt: string | null; notes: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState(
    existingContract?.signedAt?.substring(0, 10) ?? new Date().toISOString().substring(0, 10)
  );
  const [notes, setNotes] = useState(existingContract?.notes ?? "");
  const [contractId, setContractId] = useState<string | null>(null);

  if (existingContract) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">✅ العقد مُنشأ</p>
          {existingContract.signedAt && (
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              تاريخ التوقيع: {new Intl.DateTimeFormat("ar-EG").format(new Date(existingContract.signedAt))}
            </p>
          )}
          {existingContract.notes && (
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">{existingContract.notes}</p>
          )}
        </div>

        <div className="space-y-3 border rounded-md p-4">
          <h2 className="text-sm font-semibold">مستندات العقد</h2>
          <DocumentUpload entityType="contract" entityId={quotationId} />
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createContract({ customerId, quotationId, signedAt, notes });
      if ("error" in result) {
        setError(result.error ?? "حدث خطأ");
        return;
      }
      setContractId(result.contract.id ?? null);
      router.refresh();
    });
  }

  if (contractId) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">✅ تم إنشاء العقد بنجاح</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">تم نقل العميل إلى مرحلة التعاقد</p>
        </div>

        <div className="space-y-3 border rounded-md p-4">
          <h2 className="text-sm font-semibold">رفع مستندات العقد</h2>
          <DocumentUpload entityType="contract" entityId={quotationId} />
        </div>

        <button
          type="button"
          onClick={() => router.push(`/quotations/${quotationId}`)}
          className="text-sm text-blue-600 hover:underline"
        >
          العودة لعرض السعر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">تاريخ التوقيع</label>
        <input
          type="date"
          value={signedAt}
          onChange={(e) => setSignedAt(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">ملاحظات (اختياري)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="شروط خاصة، ملاحظات التعاقد..."
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "جاري الحفظ..." : "إنشاء العقد"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
