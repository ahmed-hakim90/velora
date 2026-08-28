import Link from "next/link";
import { AlertTriangle, ArrowUpLeft, Boxes, CircleDollarSign, Clock3, PackageSearch, ReceiptText, ShoppingCart } from "lucide-react";
import { AccessDenied } from "@/components/Velora/access-denied";
import { PageHeader } from "@/components/Velora/page-header";
import { LocalizedText } from "@/components/Velora/localized-text";
import { EntityList, PageShell } from "@/components/Velora/page-patterns";
import { buttonVariants } from "@/components/ui/button";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { cn } from "@/lib/utils";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { buildProfitSnapshot, getActiveSessions, getDashboardInventory, getDashboardSales, getMonthToDateExpenses, getMonthToDateSales, getOwnerFinanceSnapshot } from "@/modules/dashboard/services/dashboard.service";
import { LiveSalesPulse } from "@/modules/dashboard/components/live-sales-pulse";
import { QuickActionsBar } from "@/modules/dashboard/components/quick-actions-bar";
import { ActiveSessionsWidget } from "@/modules/dashboard/components/active-sessions-widget";
import { RecentOrdersFeed } from "@/modules/dashboard/components/recent-orders-feed";
import { formatCurrency } from "@/lib/format";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";
import type { LowStockItem } from "@/modules/dashboard/services/dashboard.service";

type AttentionItem = { label: string; value: string; detail: string; href: string; tone: "danger" | "warning" | "neutral"; icon: typeof AlertTriangle };

function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <EntityList aria-labelledby="attention-title">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-[var(--mds-color-feedback-warning-subtle)] text-[var(--mds-color-feedback-warning)]"><AlertTriangle className="size-4" aria-hidden /></span>
            <h2 id="attention-title" className="font-heading text-base font-semibold"><LocalizedText text="Needs attention" /></h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground"><LocalizedText text="Start with what needs action now." /></p>
        </div>
        <Link href="/operations" className="text-sm font-medium text-primary hover:underline"><LocalizedText text="Open operations" /></Link>
      </div>
      <div className="grid divide-y divide-border sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="group flex min-h-24 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)]", item.tone === "danger" && "bg-[var(--mds-color-feedback-danger-subtle)] text-[var(--mds-color-feedback-danger)]", item.tone === "warning" && "bg-[var(--mds-color-feedback-warning-subtle)] text-[var(--mds-color-feedback-warning)]", item.tone === "neutral" && "bg-[var(--mds-color-feedback-info-subtle)] text-[var(--mds-color-feedback-info)]")}><Icon className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold"><LocalizedText text={item.label} /></span><span className="text-lg font-semibold tabular-nums">{item.value}</span></span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground"><LocalizedText text={item.detail} /></span>
              </span>
              <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
          );
        })}
      </div>
    </EntityList>
  );
}

function DailySummary({ currency, metrics }: { currency: string; metrics: Array<{ label: string; value: string; detail: string }> }) {
  return (
    <section aria-labelledby="summary-title" className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div><h2 id="summary-title" className="font-heading text-base font-semibold"><LocalizedText text="Today at a glance" /></h2><p className="text-xs text-muted-foreground"><LocalizedText text="Key figures" /> · {currency}</p></div>
        <Link href="/reports" className="text-sm font-medium text-primary hover:underline"><LocalizedText text="Detailed reports" /></Link>
      </div>
      <dl className="grid grid-cols-2 border-t border-border lg:grid-cols-5">
        {metrics.map((metric, index) => <div key={metric.label} className={cn("border-b border-border px-3 py-3 sm:px-4 lg:border-b-0", index % 2 === 1 && "border-s", metrics.length % 2 === 1 && index === metrics.length - 1 && "col-span-2 lg:col-span-1")}><dt className="text-xs font-medium text-muted-foreground"><LocalizedText text={metric.label} /></dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{metric.value}</dd><dd className="mt-0.5 text-xs text-muted-foreground"><LocalizedText text={metric.detail} /></dd></div>)}
      </dl>
    </section>
  );
}

function LowStockWatch({ items }: { items: LowStockItem[] }) {
  return (
    <EntityList aria-labelledby="low-stock-title" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="low-stock-title" className="font-heading text-sm font-semibold"><LocalizedText text="Low stock" /></h2>
        <Link href="/inventory" className="text-xs font-medium text-primary hover:underline"><LocalizedText text="View items" /></Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[var(--mds-radius-md)] border border-dashed border-border p-5 text-center text-sm text-muted-foreground"><LocalizedText text="No items below reorder level" /></p>
      ) : (
        <div className="divide-y divide-border">
          {items.slice(0, 6).map((item) => (
            <div key={item.productId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 text-sm">
              <span className="truncate font-medium">{item.productName}</span>
              <span className="text-xs text-muted-foreground"><LocalizedText text="Limit" /> {item.reorderPoint}</span>
              <span className="min-w-10 text-end font-semibold tabular-nums text-[var(--mds-color-feedback-danger)]">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </EntityList>
  );
}

export async function DashboardPage() {
  const user = await ensureTenantUser(await getCurrentUser());
  const isOwner = user.role === "owner";
  const store = await requirePageStoreId("/");
  if (!store.ok) return <AccessDenied title={store.denial.title} description={store.denial.description} />;
  const storeId = store.storeId;
  const org = await orgRepo.getOrganization();
  const products = await catalogRepo.listProducts();
  const [sales, inventory, activeSessions, monthSales, finance, businessActivity, expensesMtd] = await Promise.all([
    getDashboardSales(storeId, { products }), getDashboardInventory(storeId, products), getActiveSessions(storeId),
    isOwner ? getMonthToDateSales(storeId) : Promise.resolve(null), isOwner ? getOwnerFinanceSnapshot(storeId) : Promise.resolve(null),
    getBusinessActivitySettings(), getMonthToDateExpenses(storeId),
  ]);
  const profit = buildProfitSnapshot(inventory.inventoryExpectedProfit, expensesMtd);
  const { stats, recentOrders } = sales;
  const { lowStock, inventoryValue, nearExpiryCount } = inventory;
  const attentionItems: AttentionItem[] = [
    { label: "Low stock", value: String(lowStock.length), detail: lowStock[0]?.productName ?? "No critical items", href: "/inventory", tone: lowStock.length ? "warning" : "neutral", icon: PackageSearch },
    { label: "Open sessions", value: String(activeSessions.length), detail: activeSessions.length ? "Review session age and settlement" : "No sessions need attention", href: "/sessions", tone: activeSessions.length ? "warning" : "neutral", icon: Clock3 },
    { label: "Near expiry", value: String(nearExpiryCount), detail: "Items need review", href: "/inventory", tone: nearExpiryCount ? "danger" : "neutral", icon: Boxes },
    { label: isOwner ? "Supplier due" : "Today's orders", value: isOwner && finance ? formatCurrency(finance.supplierOutstanding, org.currency) : String(stats.todayOrders), detail: isOwner ? "Current balance to follow up" : "Completed today", href: isOwner ? "/inventory/suppliers" : "/orders", tone: isOwner && finance && finance.supplierOutstanding > 0 ? "danger" : "neutral", icon: isOwner ? ReceiptText : ShoppingCart },
  ];
  const summaryMetrics = [
    { label: "Today's sales", value: formatCurrency(stats.todaySales, org.currency), detail: `${stats.todayOrders} orders` },
    { label: "Avg ticket", value: formatCurrency(stats.avgTicket, org.currency), detail: "Per completed order" },
    { label: "Monthly sales", value: formatCurrency(monthSales?.revenue ?? stats.todaySales, org.currency), detail: `${monthSales?.orderCount ?? stats.todayOrders} orders` },
    { label: "Inventory Value", value: formatCurrency(inventoryValue, org.currency), detail: "At current sale price" },
    { label: "Profit after expenses", value: formatCurrency(profit.profitAfterExpenses, org.currency), detail: "Estimated from current inventory" },
  ];

  return (
    <PageShell>
      <PageHeader breadcrumb={<LocalizedText text="Dashboard" />} title="Dashboard" description="What needs attention now, then performance." action={<Link href="/pos" className={buttonVariants({ size: "sm" })}><ShoppingCart className="size-4" aria-hidden /><LocalizedText text="POS" /></Link>} />
      <AttentionQueue items={attentionItems} />
      <DailySummary currency={org.currency} metrics={summaryMetrics} />
      <QuickActionsBar enableWholesaleSales={businessActivity.enable_wholesale_sales} />
      <section aria-label="متابعة التشغيل" className="grid min-w-0 gap-4 xl:grid-cols-3"><ActiveSessionsWidget sessions={activeSessions} /><RecentOrdersFeed orders={recentOrders} /><LowStockWatch items={lowStock} /></section>
      <section aria-label="اتجاه المبيعات" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <LiveSalesPulse data={stats.salesSparkline} todaySales={stats.todaySales} />
        <EntityList className="p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-feedback-success-subtle)] text-[var(--mds-color-feedback-success)]"><CircleDollarSign className="size-5" aria-hidden /></span><div><p className="text-xs font-medium text-muted-foreground"><LocalizedText text="Estimated net profit" /></p><p className="text-xl font-semibold tabular-nums">{formatCurrency(profit.profitAfterExpenses, org.currency)}</p></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground"><LocalizedText text="Expected inventory profit after approved monthly expenses." /></p><Link href="/reports/profit" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"><LocalizedText text="Open profit report" /></Link></EntityList>
      </section>
    </PageShell>
  );
}
