import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams?.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">EgyGlass ERP</h1>
        <p className="text-gray-500 text-center mb-6">تسجيل الدخول</p>

        <form action={loginAction} className="space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1">
              البريد الإلكتروني
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              كلمة المرور
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">
              {error === "CredentialsSignin"
                ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
                : "حدث خطأ، يرجى المحاولة مرة أخرى"}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
