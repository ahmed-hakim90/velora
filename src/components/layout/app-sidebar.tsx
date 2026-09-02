"use client";

import Link from "next/link";
import { useDisplayPathname } from "@/hooks/use-display-pathname";
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  BookOpen,
  Calculator,
  Calendar,
  CircleDollarSign,
  Building2,
  MonitorSmartphone,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Landmark,
  Package,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import { filterNavByAccess, isNavHrefActive, ROLE_LABELS_AR } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n/use-translation";
import { AppBrandMark } from "@/components/layout/app-brand-mark";
import { PoweredByHakimo } from "@/components/layout/powered-by-hakimo";
import { logoutAction } from "@/modules/auth/actions/logout.action";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  Building2,
  Calculator,
  MonitorSmartphone,
  ShoppingCart,
  Receipt,
  Package,
  PieChart,
  Warehouse,
  Truck,
  ArrowLeftRight,
  Trash2,
  TrendingUp,
  ClipboardList,
  Clock,
  Wallet,
  Users,
  Heart,
  Tag,
  Landmark,
  BarChart3,
  Barcode,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  FileSpreadsheet,
  Settings,
  Shield,
  ScrollText,
};

const ROLE_SUBTITLE: Record<UserRole, string> = {
  owner: "إدارة كاملة",
  manager: "تشغيل الفرع",
  cashier: "بيع وورديات",
  inventory: "مخزون ومشتريات",
};

/** Keep navigation quiet by default; the current section always opens itself. */
const DEFAULT_OPEN_NAV_GROUPS = new Set(["Dashboard", "Operations"]);

function isNavGroupCollapsed(
  label: string,
  collapsedGroups: Record<string, boolean>,
  hasActiveItem: boolean
): boolean {
  if (hasActiveItem) return false;
  if (Object.prototype.hasOwnProperty.call(collapsedGroups, label)) {
    return Boolean(collapsedGroups[label]);
  }
  return !DEFAULT_OPEN_NAV_GROUPS.has(label);
}

export function AppSidebar({
  userRole,
  featureFlags,
  enableWholesaleSales,
  allowCashierWholesale,
  enableKitchenDisplay,
  permissions = [],
  className,
  forceExpanded = false,
}: {
  userRole: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  enableKitchenDisplay?: boolean;
  permissions?: PermissionKey[];
  className?: string;
  forceExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const pathname = useDisplayPathname();
  const { sidebarCollapsed, toggleSidebar, collapsedGroups, setGroupCollapsed } =
    useUiStore();
  const collapsed = forceExpanded ? false : sidebarCollapsed;
  const navGroups = filterNavByAccess(
    userRole,
    new Set(permissions),
    featureFlags,
    { enableWholesaleSales, allowCashierWholesale, enableKitchenDisplay }
  );
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

  return (
    <TooltipProvider delay={300}>
      <aside
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border-e border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--mds-elevation-2)] transition-[width] duration-[var(--mds-motion-normal)] ease-[var(--mds-motion-easing-standard)]",
          collapsed ? "w-[72px]" : "w-[15.5rem]",
          className
        )}
      >
        {collapsed && !forceExpanded ? (
          <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border bg-[linear-gradient(135deg,rgb(103_232_249/0.16),transparent_55%)]">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
              onClick={toggleSidebar}
              aria-label={t("Expand sidebar")}
            >
              <Menu className="size-5" />
            </Button>
          </div>
        ) : (
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border bg-[linear-gradient(135deg,rgb(103_232_249/0.16),transparent_55%)] px-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--mds-elevation-1)]">
              <AppBrandMark />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {APP_NAME}
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--mds-sidebar-muted)" }}>
                {ROLE_SUBTITLE[userRole]}
              </p>
            </div>
            {!forceExpanded && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 border border-sidebar-border bg-[var(--mds-sidebar-hover)] text-sidebar-foreground shadow-sm hover:border-sidebar-primary/60 hover:bg-sidebar-accent hover:text-sidebar-primary"
                onClick={toggleSidebar}
                aria-label={t("Collapse sidebar")}
              >
                <ChevronLeft className="size-5 rtl:rotate-180" />
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 overflow-hidden px-2 py-2.5">
          <nav className="space-y-1" aria-label={t("Main navigation")}>
            {navGroups.map((group) => {
              const groupHrefs = group.items.map((i) => i.href);
              const hasActiveItem = group.items.some((item) =>
                isNavHrefActive(pathname, item.href, allHrefs)
              );
              // Keep the section open when it contains the current page.
              const groupCollapsed = isNavGroupCollapsed(
                group.label,
                collapsedGroups,
                hasActiveItem
              );
              const GroupIcon = iconMap[group.icon] ?? LayoutDashboard;
              return (
                <div
                  key={group.label}
                  className={cn(
                    "rounded-[var(--mds-radius-md)]",
                    !collapsed && hasActiveItem && "bg-sidebar-foreground/[0.045]"
                  )}
                >
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() =>
                        setGroupCollapsed(group.label, !groupCollapsed)
                      }
                      aria-expanded={!groupCollapsed}
                      aria-controls={`sidebar-group-${group.label.replace(/\s+/g, "-").toLowerCase()}`}
                      className={cn(
                        "group mb-0.5 flex w-full items-center justify-between gap-2 rounded-[var(--mds-radius-md)] border px-2 py-1.5 text-start text-xs font-semibold transition-colors",
                        forceExpanded ? "min-h-11" : "min-h-9",
                        hasActiveItem
                          ? "border-sidebar-primary/45 bg-sidebar-foreground/[0.09] text-sidebar-foreground"
                          : "border-sidebar-border/70 bg-sidebar-foreground/[0.035] text-sidebar-foreground/95 hover:border-sidebar-primary/35 hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-[var(--mds-radius-sm)] bg-sidebar-foreground/[0.07]",
                            hasActiveItem && "bg-sidebar-primary/15 text-sidebar-primary"
                          )}
                        >
                          <GroupIcon className="size-3.5" aria-hidden />
                        </span>
                        <span className="truncate">{t(group.label)}</span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <span className="flex size-6 items-center justify-center rounded-[var(--mds-radius-sm)] border border-sidebar-border bg-sidebar/40 transition-colors group-hover:border-sidebar-primary/40">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 transition-transform duration-200",
                              groupCollapsed && "-rotate-90 rtl:rotate-90"
                            )}
                            aria-hidden
                          />
                        </span>
                      </span>
                    </button>
                  )}
                  {(!groupCollapsed || collapsed) && (
                    <ul
                      id={`sidebar-group-${group.label.replace(/\s+/g, "-").toLowerCase()}`}
                      className={cn(
                        "space-y-1",
                        !collapsed && "ms-3.5 border-s border-sidebar-border/80 ps-2 pb-1.5"
                      )}
                    >
                      {group.items.map((item, index) => {
                        const Icon = iconMap[item.icon] ?? LayoutDashboard;
                        const active = isNavHrefActive(
                          pathname,
                          item.href,
                          groupHrefs.length > 1 ? allHrefs : groupHrefs
                        );
                        return (
                          <li key={`${group.label}-${item.href}-${index}`}>
                            {collapsed ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Link
                                      href={item.href}
                                      aria-current={active ? "page" : undefined}
                                      className={cn(
                                        "relative flex items-center justify-center rounded-[var(--mds-radius-md)] p-2.5 text-sm transition-colors",
                                        active
                                          ? "bg-sidebar-foreground/[0.1] text-sidebar-foreground ring-1 ring-inset ring-sidebar-primary/30"
                                          : "text-sidebar-foreground/90 hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                                      )}
                                    />
                                  }
                                >
                                  <Icon className="size-4 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span className="text-muted-foreground">{t(group.label)} · </span>
                                  {t(item.label)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "relative flex items-center gap-2 rounded-[var(--mds-radius-sm)] px-2 py-1.5 text-[12px] transition-colors",
                                  forceExpanded ? "min-h-11" : "min-h-8",
                                  active
                                    ? "bg-sidebar-foreground/[0.1] font-semibold text-sidebar-foreground ring-1 ring-inset ring-sidebar-primary/30"
                                    : "font-medium text-sidebar-foreground/90 hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                                )}
                              >
                                {active ? (
                                  <span
                                    className="absolute inset-e-0 inset-y-1.5 w-1 rounded-s-full bg-sidebar-primary"
                                    aria-hidden
                                  />
                                ) : null}
                                <Icon
                                  className={cn(
                                    "size-3.5 shrink-0",
                                    active ? "text-sidebar-primary" : "opacity-90"
                                  )}
                                />
                                <span className="truncate">{t(item.label)}</span>
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="shrink-0 border-t border-sidebar-border bg-sidebar-foreground/[0.025] px-2.5 py-2">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--mds-radius-sm)] px-1.5 py-1">
                <span className="size-1.5 shrink-0 rounded-full bg-sidebar-primary shadow-[0_0_0_3px_rgb(103_232_249/0.1)]" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-sidebar-foreground">
                    {t(ROLE_LABELS_AR[userRole])}
                  </p>
                  <PoweredByHakimo
                    compact
                    tone="sidebar"
                    className="mt-0.5 h-auto w-fit justify-start p-0 text-[9px] opacity-60 hover:bg-transparent hover:opacity-100"
                  />
                </div>
              </div>
              <SidebarSignOut collapsed label={t("Sign out")} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <SidebarSignOut collapsed label={t("Sign out")} />
              <PoweredByHakimo
                compact
                tone="sidebar"
                className="size-7 rounded-[var(--mds-radius-sm)] opacity-70 hover:bg-[var(--mds-sidebar-hover)] hover:opacity-100"
              />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function SidebarSignOut({ collapsed, label }: { collapsed: boolean; label: string }) {
  if (collapsed) {
    return (
      <Tooltip>
        <form action={logoutAction}>
          <TooltipTrigger
            render={
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                className="text-sidebar-foreground/80 hover:bg-[var(--mds-sidebar-hover)] hover:text-destructive"
                aria-label={label}
              />
            }
          >
            <LogOut className="size-4" />
          </TooltipTrigger>
        </form>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        className="h-9 w-full justify-start gap-2 rounded-[var(--mds-radius-md)] px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-[var(--mds-sidebar-hover)] hover:text-destructive"
      >
        <LogOut className="size-4 shrink-0" />
        {label}
      </Button>
    </form>
  );
}
