export interface NavItem {
  labelKey: string;
  href: string;
  icon?: string;
  roles?: string[];
}

export const navRegistry: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: "dashboard" },
  { labelKey: "nav.customers", href: "/customers", icon: "people" },
  { labelKey: "nav.quotations", href: "/quotations", icon: "receipt" },
  { labelKey: "nav.inspections", href: "/inspections", icon: "search" },
  { labelKey: "nav.users", href: "/users", icon: "admin", roles: ["ADMIN"] },
  { labelKey: "nav.reports", href: "/reports", icon: "bar_chart" },
];

export function getNavItems(role?: string): NavItem[] {
  return navRegistry.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );
}
