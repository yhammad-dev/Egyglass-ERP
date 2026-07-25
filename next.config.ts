import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // TO-02: سقف جسم الـServer Action صريح بدل الافتراضي الضمني (~1MB) الذي كان
  // يقصّ رفع الرسومات بلا رسالة مفهومة.
  //
  // الحساب (سبب 14 لا 12): base64 يضخّم الحمولة بنسبة 4/3.
  //   ملف 10MB = 10,485,760 بايت ⇒ جسم الطلب ≈ 13,981,016 بايت ≈ 13.33MB.
  // فسقف 12mb كان سيسمح فعليًا بملف 9MB فقط (12,582,912 × 3/4 = 9,437,184)،
  // ويرفض ملفًا سليمًا 9.5MB بخطأ نقل مبهم **قبل** أن يصل حارس الـ10MB.
  // 14mb تغطي 13.33MB + هامش ⇒ سقف الأعمال الحقيقي يبقى 10MB ويُفرض من الـBuffer
  // داخل uploadDrawingAction. هذا السقف طبقة نقل فقط، ليس هو حارس الأعمال.
  experimental: {
    serverActions: {
      bodySizeLimit: "14mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
