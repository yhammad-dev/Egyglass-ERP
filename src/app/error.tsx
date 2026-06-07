"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white" style={{ margin: 0 }}>
        <h1 className="text-2xl font-bold text-gray-700">حدث خطأ</h1>
        <p className="text-gray-500 text-sm">
          {error.message || "يرجى المحاولة مرة أخرى"}
        </p>
        <button
          onClick={reset}
          className="text-blue-600 hover:underline text-sm"
        >
          حاول مرة أخرى
        </button>
      </body>
    </html>
  );
}
