import type { PermissionKey } from "@/lib/constants";

export const SETTINGS_TAB_IDS = [
  "business",
  "activity",
  "branches",
  "pos",
  "print",
  "expenses",
  "users",
  "features",
  "audit",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export const SETTINGS_GROUPS = [
  "Business",
  "Cashier",
  "Inventory",
  "Security",
  "Advanced",
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

export const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  permissions: PermissionKey[];
  group: SettingsGroup;
  searchTerms: string[];
}[] = [
  {
    id: "business",
    label: "Business",
    permissions: ["settings_manage"],
    group: "Business",
    searchTerms: [
      "store",
      "company",
      "branding",
      "logo",
      "currency",
      "متجر",
      "شركة",
      "شعار",
      "عملة",
    ],
  },
  {
    id: "activity",
    label: "Business activity",
    permissions: ["settings_manage"],
    group: "Business",
    searchTerms: [
      "activity",
      "preset",
      "sales modes",
      "weight",
      "wholesale",
      "inventory",
      "نشاط",
      "مبيعات",
      "وزن",
      "جملة",
      "مخزون",
      "كافيه",
      "سوبر ماركت",
    ],
  },
  {
    id: "branches",
    label: "Branches",
    permissions: ["settings_manage"],
    group: "Business",
    searchTerms: ["branches", "stores", "terminals", "فروع", "كاشير"],
  },
  {
    id: "pos",
    label: "Cashier",
    permissions: ["settings_manage", "session_settings_manage"],
    group: "Cashier",
    searchTerms: [
      "pos",
      "sessions",
      "receipts",
      "payments",
      "كاشير",
      "جلسات",
      "إيصالات",
      "دفع",
    ],
  },
  {
    id: "print",
    label: "Print Engine",
    permissions: ["settings_manage"],
    group: "Business",
    searchTerms: [
      "print",
      "engine",
      "invoice",
      "template",
      "logo",
      "a4",
      "طباعة",
      "فاتورة",
      "قالب",
      "شعار",
      "محرك",
      "تخصيص",
      "عرض سعر",
      "أمر بيع",
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    permissions: ["settings_manage", "cost_center_manage"],
    group: "Inventory",
    searchTerms: [
      "units",
      "transfers",
      "expenses",
      "categories",
      "وحدات",
      "تحويلات",
      "مصروفات",
      "تصنيفات",
    ],
  },
  {
    id: "users",
    label: "Users",
    permissions: ["user_manage"],
    group: "Security",
    searchTerms: [
      "users",
      "roles",
      "permissions",
      "security",
      "مستخدمين",
      "أدوار",
      "صلاحيات",
      "أمان",
    ],
  },
  {
    id: "features",
    label: "System features",
    permissions: ["settings_manage"],
    group: "Advanced",
    searchTerms: [
      "feature flags",
      "flags",
      "toggles",
      "خصائص",
      "مفاتيح",
      "تفعيل",
      "reports schedule",
      "email digest",
      "جدولة",
      "تقارير",
      "إيميل",
    ],
  },
  {
    id: "audit",
    label: "Audit log",
    permissions: ["audit_view"],
    group: "Advanced",
    searchTerms: ["audit", "logs", "مراجعة", "سجلات"],
  },
];

export function tabVisible(
  tab: (typeof SETTINGS_TABS)[number],
  permissions: Set<PermissionKey>,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  return tab.permissions.some((p) => permissions.has(p));
}

export function getVisibleSettingsTabs(
  permissions: Set<PermissionKey>,
  isOwner: boolean,
): (typeof SETTINGS_TABS)[number][] {
  return SETTINGS_TABS.filter((tab) => tabVisible(tab, permissions, isOwner));
}

export function groupSettingsTabs(
  tabs: Array<
    Pick<
      (typeof SETTINGS_TABS)[number],
      "id" | "label" | "group" | "searchTerms"
    >
  >,
): Array<{
  group: SettingsGroup;
  tabs: Array<
    Pick<
      (typeof SETTINGS_TABS)[number],
      "id" | "label" | "group" | "searchTerms"
    >
  >;
}> {
  return SETTINGS_GROUPS.map((group) => ({
    group,
    tabs: tabs.filter((tab) => tab.group === group),
  })).filter((entry) => entry.tabs.length > 0);
}

export function resolveSettingsTab(
  requested: string | undefined,
  permissions: Set<PermissionKey>,
  isOwner: boolean,
): SettingsTabId {
  const visible = getVisibleSettingsTabs(permissions, isOwner);
  const fallback = visible[0]?.id ?? "business";
  if (!requested) return fallback;
  const match = visible.find((t) => t.id === requested);
  return match?.id ?? fallback;
}
