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
  {
    labelKey: "nav.manufacturing",
    href: "/manufacturing",
    icon: "factory",
    roles: ["ADMIN", "PROCUREMENT"],
  },
  {
    labelKey: "nav.review",
    href: "/review",
    icon: "fact_check",
    roles: ["ADMIN", "REVIEW"],
  },
  {
    labelKey: "nav.adminPricing",
    href: "/admin/pricing",
    icon: "settings",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.installations",
    href: "/installations",
    icon: "handyman",
    roles: ["ADMIN", "INSTALLATIONS"],
  },
  {
    labelKey: "nav.executive",
    href: "/executive",
    icon: "analytics",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.accounting",
    href: "/accounting",
    icon: "payments",
    roles: ["ADMIN", "ACCOUNTING"],
  },
  {
    labelKey: "nav.hr",
    href: "/hr",
    icon: "group",
    roles: ["ADMIN", "HR"],
  },
];

export function getNavItems(role?: string): NavItem[] {
  return navRegistry.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );
}
