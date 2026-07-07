"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument, deleteDocument } from "../../lib/documents/actions";

type Doc = {
  id: string;
  originalName: string;
  mimeType: string;
  label: string | null;
  url: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { name: string };
};

export function DocumentUpload({
  entityType,
  entityId,
  initialDocs = [],
}: {
  entityType: string;
  entityId: string;
  initialDocs?: Doc[];
}) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", label);

    startTransition(async () => {
      const result = await uploadDocument(entityType, entityId, fd);
      if ("error" in result) {
        setError(result.error ?? "حدث خطأ");
      } else {
        setDocs((prev) => [result.doc as unknown as Doc, ...prev]);
        setLabel("");
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteDocument(id);
      if ("success" in result) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            تسمية المستند (اختياري)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثال: عقد موقع، صورة هوية"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            الملف
          </label>
          <input
            ref={inputRef}
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
            className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "جاري الرفع..." : "رفع الملف"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          لا توجد مستندات مرفوعة
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <span className="text-lg">{doc.mimeType?.includes("pdf") ? "📄" : doc.mimeType?.includes("image") ? "🖼️" : "📎"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {doc.label || doc.originalName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {doc.originalName} · {formatSize(doc.sizeBytes)} · {doc.uploadedBy?.name}
                </p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                عرض
              </a>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 shrink-0"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
