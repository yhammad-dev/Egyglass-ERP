"use client";

import { useRef, useState, useTransition } from "react";
import { uploadCompanyLogo, updateCompanyName } from "../../lib/admin/actions";
import Image from "next/image";

export function CompanySettingsPanel({
  initialName,
  initialLogoUrl,
}: {
  initialName: string;
  initialLogoUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [name, setName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);

    const fd = new FormData();
    fd.append("logo", file);

    startTransition(async () => {
      const result = await uploadCompanyLogo(fd);
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "حدث خطأ");
      } else {
        setLogoUrl(result.url + "?t=" + Date.now());
        setSuccess("تم تحديث اللوجو بنجاح");
      }
    });
  }

  function handleNameSave() {
    if (!nameInput.trim()) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateCompanyName({ name: nameInput.trim() });
      if ("error" in result) {
        setError("فشل تحديث الاسم");
      } else {
        setName(nameInput.trim());
        setEditingName(false);
        setSuccess("تم تحديث اسم الشركة");
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">هوية الشركة</h2>
        <span className="text-xs text-gray-400">تؤثر على طباعة عروض الأسعار والعقود</span>
      </div>

      {/* Logo Section */}
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          {logoUrl ? (
            <div className="relative w-28 h-20 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
              <Image
                src={logoUrl}
                alt="لوجو الشركة"
                fill
                className="object-contain p-2"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-28 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <span className="text-3xl">🏢</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">لوجو الشركة</p>
          <p className="text-xs text-gray-400">PNG أو JPG — حد أقصى 2 ميغابايت — يُستخدم في طباعة عروض الأسعار والعقود</p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "جاري الرفع..." : logoUrl ? "تغيير اللوجو" : "رفع لوجو"}
            </button>
            {logoUrl && (
              <a
                href={logoUrl.split("?")[0]}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                عرض
              </a>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم الشركة</p>
        {editingName ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
            />
            <button
              type="button"
              onClick={handleNameSave}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => { setEditingName(false); setNameInput(name); }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-gray-800 dark:text-gray-200 font-medium">{name}</span>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              تعديل
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">✓ {success}</p>}
    </div>
  );
}
