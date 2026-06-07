import { auth } from "./auth";

const roleHierarchy: Record<string, number> = {
  ADMIN: 100,
  SALES_MANAGER: 60,
  SALES_REP: 40,
  INSPECTION_MANAGER: 50,
  VIEWER: 10,
};

export function hasRole(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

export async function requireRole(
  roles: string[]
): Promise<{ authorized: true; userId: string; role: string } | { authorized: false }> {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.role) {
    return { authorized: false };
  }

  if (!roles.includes(session.user.role as string)) {
    return { authorized: false };
  }

  return {
    authorized: true,
    userId: session.user.id as string,
    role: session.user.role as string,
  };
}
