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
  {
    labelKey: "nav.technicalOffice",
    href: "/technical-office",
    icon: "drafting_compass",
    roles: ["ADMIN", "TECHNICAL_OFFICE", "TEC_APPROVER"],
  },
  {
    // PHASE 2 (D-03): شاشة اعتماد عروض الأسعار = المدير التنفيذي (TEC_APPROVER)،
    // لا محمد حسام. دور REVIEW الحقيقي على أمر التصنيع (PHASE 3).
    labelKey: "nav.review",
    href: "/review",
    icon: "fact_check",
    roles: ["ADMIN", "TEC_APPROVER"],
  },
  {
    labelKey: "nav.manufacturing",
    href: "/manufacturing",
    icon: "factory",
    roles: ["ADMIN", "PROCUREMENT"],
  },
  {
    labelKey: "nav.installations",
    href: "/installations",
    icon: "handyman",
    roles: ["ADMIN", "INSTALLATIONS"],
  },
  {
    labelKey: "nav.projects",
    href: "/projects",
    icon: "folder",
    roles: ["ADMIN", "PROJECTS"],
  },
  {
    labelKey: "nav.accounting",
    href: "/accounting",
    icon: "payments",
    roles: ["ADMIN", "ACCOUNTING", "PROJECTS", "TECHNICAL_OFFICE"],
  },
  // دفعة هـ (سد انقطاع #2): المستخلصات والفواتير كانتا شاشتين بلا مدخل قائمة
  {
    labelKey: "nav.statements",
    href: "/statements",
    icon: "request_quote",
    roles: ["ADMIN", "ACCOUNTING"],
  },
  {
    labelKey: "nav.invoices",
    href: "/invoices",
    icon: "receipt_long",
    roles: ["ADMIN", "ACCOUNTING"],
  },
  {
    labelKey: "nav.hr",
    href: "/hr",
    icon: "group",
    roles: ["ADMIN", "HR"],
  },
  {
    labelKey: "nav.executive",
    href: "/executive",
    icon: "analytics",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.users",
    href: "/users",
    icon: "admin",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.adminPricing",
    href: "/admin/pricing",
    icon: "settings",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.audit",
    href: "/audit",
    icon: "history",
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.coverageEdits",
    href: "/coverage-edits",
    icon: "supervisor_account",
    roles: ["ADMIN", "SALES_MANAGER"],
  },
  {
    labelKey: "nav.import",
    href: "/admin/import",
    icon: "upload_file",
    roles: ["ADMIN"],
  },
];

export function getNavItems(role?: string): NavItem[] {
  return navRegistry.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );
}
