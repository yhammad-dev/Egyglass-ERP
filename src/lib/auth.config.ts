import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Public paths reachable without a session. "/" only redirects to /login.
      const isPublicPath = pathname === "/login" || pathname === "/";

      if (pathname === "/login") {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (isPublicPath) return true;

      // Everything else (all (dashboard) route groups: /customers, /quotations,
      // /users, /admin, /hr, /accounting, /inspections, /projects, /review,
      // /manufacturing, /installations, /executive, /audit, /dashboard, ...)
      // requires an authenticated session. Unauthenticated → redirect to /login.
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.department = token.department as typeof session.user.department;
      }
      return session;
    },
  },
  providers: [],
};
