export type ReportHubLink = {
  href: string;
  label: string;
  icon: string;
  description: string;
  requiresProfit?: boolean;
  requiresFinancial?: boolean;
  requiresCreditSales?: boolean;
};

export type ReportHubGroup = {
  title: string;
  links: ReportHubLink[];
};

/** Single catalog for the reports hub cards and ⌘K search. */
export const REPORT_HUB_GROUPS: ReportHubGroup[] = [
  {
    title: "المبيعات والتشغيل",
    links: [
      {
        href: "/reports/sales",
        label: "Sales Report",
        icon: "TrendingUp",
        description: "لوحة المبيعات والاتجاهات والتقارير المصغّرة",
      },
      {
        href: "/reports/sales/product",
        label: "Product Sales",
        icon: "Package",
        description: "تقرير مصغّر لصنف واحد: كمية وإيراد",
      },
      {
        href: "/reports/sales/branch",
        label: "Branch Summary",
        icon: "Building2",
        description: "تقرير مصغّر لفرع: أصناف وموظفين ودفع",
      },
      {
        href: "/reports/sales/cashier",
        label: "Employee Summary",
        icon: "Users",
        description: "تقرير مصغّر لكاشير: إيراد وجلسات",
      },
      {
        href: "/reports/sessions",
        label: "Sessions Report",
        icon: "Clock",
        description: "تسوية الدرج والفروقات",
      },
      {
        href: "/reports/cashiers",
        label: "Cashier Performance",
        icon: "Users",
        description: "إيراد وطلبات وفرق الجلسات لكل كاشير",
      },
      {
        href: "/reports/branches",
        label: "Branch Comparison",
        icon: "Building2",
        description: "إيراد وربح وهالك حسب الفرع",
      },
      {
        href: "/reports/periods",
        label: "Period Comparison",
        icon: "Calendar",
        description: "الفترة الحالية مقابل السابقة بنفس المدة",
      },
      {
        href: "/reports/heatmap",
        label: "Hourly Sales Heatmap",
        icon: "Flame",
        description: "كثافة الإيراد حسب الساعة واليوم",
      },
      {
        href: "/reports/daily-close",
        label: "Daily Closing Report",
        icon: "CalendarCheck2",
        description: "نقدية اليوم: المتوقع والفعلي والفرق",
      },
    ],
  },
  {
    title: "المالية والربحية",
    links: [
      {
        href: "/reports/aging?side=customers",
        label: "Customer Aging",
        icon: "Users",
        description: "أرصدة العملاء المستحقة حسب عمر الدين",
        requiresCreditSales: true,
      },
      {
        href: "/reports/aging?side=suppliers",
        label: "Supplier Aging",
        icon: "Landmark",
        description: "أرصدة الموردين المستحقة حسب عمر الدين",
      },
      {
        href: "/reports/statement",
        label: "Customer / Supplier Statement",
        icon: "BookOpen",
        description: "كشف مفصل بالحركات والرصيد على أي فترة",
      },
      {
        href: "/reports/tax",
        label: "Tax Report",
        icon: "Percent",
        description: "ضريبة المبيعات وتصدير Excel",
      },
      {
        href: "/reports/profit",
        label: "Profit Report",
        icon: "CircleDollarSign",
        description: "الهوامش وتكلفة البضاعة وصافي الربح",
        requiresProfit: true,
      },
      {
        href: "/reports/margins",
        label: "Margin Ranking",
        icon: "Percent",
        description: "أصناف وتصنيفات حسب الهامش الإجمالي",
        requiresProfit: true,
      },
      {
        href: "/reports/pnl",
        label: "Income Statement",
        icon: "FileSpreadsheet",
        description: "إيراد وتكلفة ومصروفات وصافي تقديري",
        requiresProfit: true,
      },
      {
        href: "/reports/expenses",
        label: "Expense Report",
        icon: "Wallet",
        description: "تجميع المصروفات حسب التصنيف والمركز — مش شاشة التسجيل",
        requiresFinancial: true,
      },
    ],
  },
  {
    title: "المخزون",
    links: [
      {
        href: "/reports/inventory",
        label: "Inventory Report",
        icon: "Warehouse",
        description: "التقييم والتشغيلات والانتهاء",
      },
      {
        href: "/reports/replenishment",
        label: "Replenishment Report",
        icon: "PackagePlus",
        description: "محتاج تشتري قد إيه حسب مبيعات الشهر",
      },
      {
        href: "/reports/product-card",
        label: "Product Stock Card",
        icon: "ClipboardList",
        description: "جه وطلع واتساوى والمتاح على أي فترة",
      },
    ],
  },
  {
    title: "أدوات",
    links: [
      {
        href: "/labels",
        label: "Barcode Labels",
        icon: "Barcode",
        description: "اطبع ملصقات المنتجات",
      },
    ],
  },
];

export function allReportHubLinks(): ReportHubLink[] {
  return REPORT_HUB_GROUPS.flatMap((group) => group.links);
}

export function filterReportHubGroups(
  showProfit: boolean,
  showFinancial: boolean,
  showCustomerDebt = true,
): ReportHubGroup[] {
  return REPORT_HUB_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.requiresProfit && !showProfit) return false;
      if (link.requiresFinancial && !showFinancial) return false;
      if (link.requiresCreditSales && !showCustomerDebt) return false;
      return true;
    }),
  })).filter((group) => group.links.length > 0);
}
