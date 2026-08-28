"use client";

import Link from "next/link";
import {
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Flame,
  Landmark,
  Mail,
  Package,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { EntityList, PageShell } from "@/components/Velora/page-patterns";
import { filterReportHubGroups } from "@/modules/reports/lib/report-hub-links";

const REPORT_HUB_ICONS: Record<string, LucideIcon> = {
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Flame,
  Landmark,
  Package,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
};

interface ReportsHubProps {
  showProfit: boolean;
  showFinancial: boolean;
  showCustomerDebt?: boolean;
  canManageSchedule?: boolean;
}

export function ReportsHub({
  showProfit,
  showFinancial,
  showCustomerDebt = true,
  canManageSchedule = false,
}: ReportsHubProps) {
  const groups = filterReportHubGroups(showProfit, showFinancial, showCustomerDebt);

  return (
    <PageShell dir="rtl">
      <PageHeader
        breadcrumb={<span>التقارير</span>}
        title="التقارير"
        description="كل تقارير الأداء والتشغيل والمالية في مكان واحد. اختَر التقرير المطلوب للبدء."
        action={
          canManageSchedule ? (
            <CompactActions>
              <CompactAction
                label="جدولة إيميل التقارير"
                icon={Mail}
                href="/settings?tab=features#report-schedule"
              />
            </CompactActions>
          ) : null
        }
      />

      <div className="space-y-[var(--mds-space-6)]">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
            </div>
            <EntityList className="grid sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((link) => {
              const Icon = REPORT_HUB_ICONS[link.icon] ?? ClipboardList;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block min-h-32 border-b border-border outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:border-s"
                >
                  <div className="flex h-full items-start gap-4 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-harbor-50)] text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground">{link.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{link.description}</p>
                      <span className="mt-2 inline-flex text-xs font-semibold text-primary">فتح التقرير</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            </EntityList>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
