"use client";

export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white" style={{ margin: 0 }}>
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl text-gray-600">الصفحة غير موجودة</p>
        <a
          href="/dashboard"
          className="text-blue-600 hover:underline text-sm"
        >
          العودة للوحة التحكم
        </a>
      </body>
    </html>
  );
}
