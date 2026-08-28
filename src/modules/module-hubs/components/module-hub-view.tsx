"use client";

import Link from "next/link";
import {
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileBadge,
  FileSpreadsheet,
  Heart,
  Landmark,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { EntityList, PageShell } from "@/components/Velora/page-patterns";
import { HubAnalyticsSection } from "@/modules/module-hubs/components/hub-analytics-section";
import type { ModuleHubDefinition, ModuleHubLink } from "@/modules/module-hubs/lib/module-hub-catalog";
import type { HubAnalyticsPayload } from "@/modules/module-hubs/lib/hub-analytics-types";

const HUB_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileBadge,
  FileSpreadsheet,
  Heart,
  Landmark,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
};

interface ModuleHubViewProps {
  hub: Pick<
    ModuleHubDefinition,
    "title" | "description" | "breadcrumb" | "ctaLabel"
  >;
  links: ModuleHubLink[];
  analytics?: HubAnalyticsPayload | null;
}

export function ModuleHubView({ hub, links, analytics }: ModuleHubViewProps) {
  return (
    <PageShell dir="rtl">
      <PageHeader
        breadcrumb={<span>{hub.breadcrumb}</span>}
        title={hub.title}
        description={hub.description}
      />

      {links.length === 0 ? (
        <EmptyStateBlock
          title="مفيش شاشات متاحة"
          description="مش عندك صلاحية تفتح عناصر المجموعة دي، أو الخصائص مقفولة من الإعدادات."
        />
      ) : (
        <section aria-label="شاشات الموديول" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            اختَر الشاشة
          </h2>
          <EntityList className="grid sm:grid-cols-2">
            {links.map((link) => {
              const Icon = HUB_ICONS[link.icon] ?? ClipboardList;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block min-h-28 border-b border-border outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:border-s"
                >
                  <div className="flex h-full items-center gap-4 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-harbor-50)] text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{link.label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
                      <span className="mt-2 inline-flex text-xs font-semibold text-primary">{hub.ctaLabel}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </EntityList>
        </section>
      )}

      {analytics ? <HubAnalyticsSection analytics={analytics} /> : null}
    </PageShell>
  );
}
