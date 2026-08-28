"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  Package,
  ScrollText,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalCard } from "@/components/Velora/operational-card";
import { PageHeader } from "@/components/Velora/page-header";
import { FilterBar, PageShell } from "@/components/Velora/page-patterns";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { StockCards, type StockCategoryGroup } from "./stock-cards";
import { MovementTimeline } from "./movement-timeline";
import { LowStockStrip } from "./low-stock-strip";
import { ExpiryAlertStrip } from "./expiry-alert-strip";
import { ReorderSuggestions } from "./reorder-suggestions";
import { aggregateMovementTypeCounts } from "@/modules/inventory/lib/movement-type-labels";
import type { MovementTimelineItem } from "../services/movement.service";
import type { InventoryAlert } from "../services/alert.service";
import type { ExpiryBatchAlert } from "../services/expiry.service";
import type { ReorderSuggestion } from "../services/reorder.service";
import type { Warehouse as WarehouseType, ProductType } from "@/lib/types";
import { useMemo } from "react";
import { LocalizedText } from "@/components/Velora/localized-text";
import { useTranslation } from "@/lib/i18n/use-translation";

const quickLinks = [
  { label: "Purchases", subtitle: "Supplier invoices", href: "/inventory/purchases", icon: Truck, accent: "var(--mds-color-action-primary)" },
  { label: "Purchase request", subtitle: "Internal approval", href: "/inventory/purchase-requests", icon: ClipboardList, accent: "var(--mds-color-action-primary-hover)" },
  { label: "Purchase order", subtitle: "Supplier order", href: "/inventory/purchase-orders", icon: FileSpreadsheet, accent: "var(--mds-color-feedback-info)" },
  { label: "Purchase return", subtitle: "Return to supplier", href: "/inventory/purchase-returns", icon: ScrollText, accent: "var(--mds-color-feedback-danger)" },
  { label: "Suppliers", subtitle: "Account statements", href: "/inventory/suppliers", icon: Landmark, accent: "var(--mds-color-feedback-info)" },
  { label: "Transfers", subtitle: "Between branches", href: "/inventory/transfers", icon: ArrowLeftRight, accent: "var(--mds-color-action-primary-hover)" },
  { label: "Waste", subtitle: "Loss and damage", href: "/inventory/waste", icon: Trash2, accent: "var(--mds-color-feedback-danger)" },
  { label: "Stock Count", subtitle: "Inventory adjustment", href: "/inventory/stock-count", icon: ClipboardList, accent: "var(--mds-color-feedback-warning)" },
];

const productTypeFilters: { label: string; value?: ProductType }[] = [
  { label: "All", value: undefined },
  { label: "Finished", value: "finished" },
  { label: "Ingredients", value: "ingredient" },
];

function inventoryHref(warehouseId?: string, productType?: ProductType) {
  const params = new URLSearchParams();
  if (warehouseId) params.set("warehouse", warehouseId);
  if (productType) params.set("type", productType);
  const query = params.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

interface InventoryHubProps {
  storeName: string;
  healthScore: number;
  healthLabel: string;
  lowCount: number;
  totalSkus: number;
  stockGroups: StockCategoryGroup[];
  alerts: InventoryAlert[];
  expiryAlerts: ExpiryBatchAlert[];
  movements: MovementTimelineItem[];
  reorderSuggestions: ReorderSuggestion[];
  warehouses: WarehouseType[];
  selectedWarehouseId?: string;
  selectedProductType?: ProductType;
}

export function InventoryHub({
  storeName,
  healthScore,
  healthLabel,
  lowCount,
  totalSkus,
  stockGroups,
  alerts,
  expiryAlerts,
  movements,
  reorderSuggestions,
  warehouses,
  selectedWarehouseId,
  selectedProductType,
}: InventoryHubProps) {
  const { t } = useTranslation();
  const activeWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  const hasStock = stockGroups.some((group) => group.items.length > 0);
  const movementChart = useMemo(
    () =>
      aggregateMovementTypeCounts(movements).map((row) => ({
        label: t(row.label),
        count: row.count,
      })),
    [movements, t]
  );

  return (
    <PageShell>
      <PageHeader
        breadcrumb={<LocalizedText text="Inventory" />}
        title="Inventory"
        description={`${t("Stock health and movements for")} ${storeName}${
          activeWarehouse ? ` · ${activeWarehouse.name}` : ` · ${t("All warehouses")}`
        }. ${t("Start with purchases or stock count as needed.")}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/reports/product-card"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("Product card")}
            </Link>
            <Link
              href="/inventory/movements"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("Full movement log")}
            </Link>
          </div>
        }
      />

      <FilterBar className="items-stretch sm:flex-col">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 text-xs font-medium text-muted-foreground sm:min-w-[4.5rem]">
            {t("Warehouse")}
          </span>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link
              href={inventoryHref(undefined, selectedProductType)}
              className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                !selectedWarehouseId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 hover:bg-muted"
              }`}
            >
              {t("All")}
            </Link>
            {warehouses.map((warehouse) => (
              <Link
                key={warehouse.id}
                href={inventoryHref(warehouse.id, selectedProductType)}
                className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                  selectedWarehouseId === warehouse.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {warehouse.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 text-xs font-medium text-muted-foreground sm:min-w-[4.5rem]">
            {t("Type")}
          </span>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {productTypeFilters.map(({ label, value }) => (
              <Link
                key={label}
                href={inventoryHref(selectedWarehouseId, value)}
                className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                  selectedProductType === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {t(label)}
              </Link>
            ))}
          </div>
        </div>
      </FilterBar>

      <section aria-label={t("Inventory summary")} className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card">
        <dl className="grid grid-cols-2 sm:grid-cols-3">
          <div className="border-b border-border px-4 py-4 sm:border-b-0"><dt className="text-xs font-medium text-muted-foreground">{t("Health score")}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{healthScore}%</dd><dd className="text-xs text-muted-foreground">{t(healthLabel)}</dd></div>
          <div className="border-b border-border px-4 py-4 sm:border-b-0 sm:border-s"><dt className="text-xs font-medium text-muted-foreground">{t("Tracked items")}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{totalSkus}</dd><dd className="text-xs text-muted-foreground">{t("Active inventory items")}</dd></div>
          <Link href="/products" className="col-span-2 px-4 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:col-span-1 sm:border-s"><dt className="text-xs font-medium text-muted-foreground">{t("Low Stock")}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--mds-color-feedback-warning)]">{lowCount}</dd><dd className="text-xs text-muted-foreground">{t("At or below reorder point")}</dd></Link>
        </dl>
      </section>

      {movementChart.length > 0 ? (
        <ReportChartSection title={t("Recent movements by type")} height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={movementChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--mds-color-action-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ModuleAnalyticsQuickLinks
        title={t("Inventory analytics")}
        description={t("Quick reports and details")}
        links={[
          {
            href: "/reports/inventory",
            label: t("Inventory Report"),
            description: t("Valuation, operations, and expiry"),
            icon: Warehouse,
          },
          {
            href: "/reports/product-card",
            label: t("Product card"),
            description: t("Inbound, outbound, and available stock over time"),
            icon: ClipboardList,
          },
          {
            href: "/reports/sales/product",
            label: t("Product Sales Report"),
            description: t("Revenue and quantity for one product"),
            icon: BarChart3,
          },
          {
            href: "/reports/replenishment",
            label: t("Replenishment Report"),
            description: t("Suggested purchasing based on usage"),
            icon: Package,
          },
          {
            href: "/inventory/suppliers",
            label: t("Suppliers"),
            description: t("Balances and account statements"),
            icon: Landmark,
          },
        ]}
      />

      <LowStockStrip alerts={alerts} />

      <ExpiryAlertStrip alerts={expiryAlerts} />

      <ReorderSuggestions suggestions={reorderSuggestions} />

      <div className="grid grid-cols-2 gap-[var(--mds-space-3)] lg:grid-cols-4">
        {quickLinks.map((link) => (
          <OperationalCard
            key={link.href}
            title={link.label}
            value={link.subtitle}
            href={link.href}
            icon={<link.icon className="size-5" />}
            accent={link.accent}
          />
        ))}
      </div>

      <Tabs defaultValue="stock">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="stock">{t("Stock by category")}</TabsTrigger>
          <TabsTrigger value="movements">{t("Recent movements")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          {hasStock ? (
            <StockCards groups={stockGroups} />
          ) : (
            <EmptyStateBlock
              title={t("No inventory to display")}
              description={t("Add tracked items or receive purchases to start tracking inventory.")}
              ctaHref="/products"
              ctaLabel={t("Manage products")}
            />
          )}
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          {movements.length > 0 ? (
            <MovementTimeline movements={movements} compact />
          ) : (
            <EmptyStateBlock
              title={t("No movements yet")}
              description={t("Receiving, transfers, waste, and stock counts will appear here.")}
              ctaHref="/inventory/purchases"
              ctaLabel={t("Open purchases")}
            />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
