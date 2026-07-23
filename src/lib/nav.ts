export interface NavItem {
  labelKey: string;
  href: string;
  icon?: string;
  roles?: string[];
}

export const navRegistry: NavItem[] = [
  // dashboard بلا roles عمدًا — نقطة الرجوع الافتراضية لكل الأدوار (BL-136).
  { labelKey: "nav.dashboard", href: "/dashboard", icon: "dashboard" },
  // BL-136: roles مطابقة لـrequireRole في كل page.tsx (مقروءة من الكود) —
  // الرابط يختفي من القائمة للدور غير المصرَّح (getNavItems).
  {
    labelKey: "nav.customers",
    href: "/customers",
    icon: "people",
    roles: ["ADMIN", "SALES_MANAGER", "SALES_REP", "VIEWER"],
  },
  {
    labelKey: "nav.quotations",
    href: "/quotations",
    icon: "receipt",
    roles: ["ADMIN", "SALES_MANAGER", "SALES_REP", "VIEWER"],
  },
  {
    labelKey: "nav.inspections",
    href: "/inspections",
    icon: "search",
    roles: ["ADMIN", "INSPECTION_MANAGER", "INSPECTION_REP"],
  },
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
    // D-41 (BL-113): REVIEW له مدخل خاص لأوامر التصنيع — القائمة تُفلتر على
    // UNDER_REVIEW في getMfgOrders. منفصل عن nav.manufacturing (PROCUREMENT/ADMIN).
    // BL-124: ADMIN مستثنى هنا — يصله المدخل عبر nav.manufacturing (مدخل واحد لا مكرر).
    labelKey: "nav.manufacturingReview",
    href: "/manufacturing",
    icon: "fact_check",
    roles: ["REVIEW"],
  },
  {
    labelKey: "nav.installations",
    href: "/installations",
    icon: "handyman",
    roles: ["ADMIN", "INSTALLATIONS"],
  },
  {
    // SCR-017 (BL-63): بيت التحقيقات — REVIEW تفتح وتجمّع، ADMIN يحكم (D-25)،
    // TEC_APPROVER يقرأ ويُصدر البديل بعد الحكم (D-29، PHASE 4)
    labelKey: "nav.investigations",
    href: "/investigations",
    icon: "gavel",
    roles: ["ADMIN", "REVIEW", "TEC_APPROVER"],
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
    roles: ["ADMIN", "ACCOUNTING", "PROJECTS"],
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
    // BL-74 (PHASE E): مدخل "بانتظار اعتمادك" — ADMIN فقط
    labelKey: "nav.approvals",
    href: "/approvals",
    icon: "inbox",
    roles: ["ADMIN"],
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
