"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import type { Category, Product, Store, Warehouse } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import { StockCountWizard } from "./stock-count-wizard";
import { StockCountSheetForm } from "./stock-count-sheet-form";
import { StockCountStartForm } from "./stock-count-start-form";
import { useTranslation } from "@/lib/i18n/use-translation";

function statusLabel(status: StockCountWithLines["status"]) {
  switch (status) {
    case "completed":
      return { label: "Completed", variant: "success" as const };
    case "pending_approval":
      return { label: "Pending approval", variant: "warning" as const };
    case "approved":
      return { label: "Approved", variant: "info" as const };
    default:
      return { label: "Counting", variant: "info" as const };
  }
}

interface StockCountPageProps {
  counts: StockCountWithLines[];
  activeCount: StockCountWithLines | null;
  products: Product[];
  warehouses: Warehouse[];
  printWarehouses: Warehouse[];
  stores: Store[];
  categories: Category[];
  storeId: string;
  canApprove: boolean;
  trackedProductCount: number;
  barcodeScannerEnabled: boolean;
}

export function StockCountPage({
  counts,
  activeCount,
  products,
  warehouses,
  printWarehouses,
  stores,
  categories,
  storeId,
  canApprove,
  trackedProductCount,
  barcodeScannerEnabled,
}: StockCountPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" });
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouse") ?? "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const warehouseNameById = new Map(printWarehouses.map((w) => [w.id, w.name]));
  const filteredCounts = useMemo(() => counts.filter((count) => {
    const date = count.started_at.slice(0, 10);
    return (!dateRange.from || date >= dateRange.from) && (!dateRange.to || date <= dateRange.to) && (warehouseId === "all" || count.warehouse_id === warehouseId) && (statusFilter === "all" || count.status === statusFilter);
  }), [counts, dateRange, warehouseId, statusFilter]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value && value !== "all" ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/inventory/stock-count?${query}` : "/inventory/stock-count");
  }

  return (
    <>
      <PageHeader
        title="Stock count"
        description="Count a warehouse, category, or product from zero with a scanner, or print a count sheet"
      />

      {activeCount ? (
        <StockCountWizard
          count={activeCount}
          products={products}
          categories={categories}
          canApprove={canApprove}
          trackedProductCount={trackedProductCount}
          barcodeScannerEnabled={barcodeScannerEnabled}
          onComplete={() => router.refresh()}
        />
      ) : (
        <div className="space-y-4">
          <StockCountStartForm
            warehouses={warehouses}
            categories={categories}
            products={products}
            barcodeScannerEnabled={barcodeScannerEnabled}
            onStarted={() => router.refresh()}
          />
          <StockCountSheetForm
            stores={stores}
            warehouses={printWarehouses}
            categories={categories}
            products={products}
            defaultStoreId={storeId}
          />
          <div className="grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:grid-cols-[auto_11rem_11rem] xl:items-end">
            <DateRangeFilter className="col-span-2 xl:col-span-1" value={dateRange} onChange={(next) => { setDateRange(next); updateUrl(next); }} />
            <Select value={warehouseId} onValueChange={(value) => { const next = value ?? "all"; setWarehouseId(next); updateUrl({ warehouse: next }); }}><SelectTrigger size="sm" className="w-full xl:w-44" aria-label={t("Warehouse")}><SelectValue>{() => warehouseId === "all" ? t("All warehouses") : warehouseNameById.get(warehouseId) ?? t("All warehouses")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All warehouses")}</SelectItem>{printWarehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={(value) => { const next = value ?? "all"; setStatusFilter(next); updateUrl({ status: next }); }}><SelectTrigger size="sm" className="w-full xl:w-44" aria-label={t("Stock count status")}><SelectValue>{() => statusFilter === "all" ? t("All statuses") : t(statusLabel(statusFilter as StockCountWithLines["status"]).label)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All statuses")}</SelectItem><SelectItem value="in_progress">{t("Counting")}</SelectItem><SelectItem value="pending_approval">{t("Pending approval")}</SelectItem><SelectItem value="approved">{t("Approved")}</SelectItem><SelectItem value="completed">{t("Completed")}</SelectItem></SelectContent></Select>
          </div>
          {filteredCounts.length === 0 ? (
            <EmptyStateBlock
              title={counts.length === 0 ? t("No previous stock counts") : t("No matching results")}
              description={counts.length === 0 ? t("Start a count above, or print a sheet and count manually.") : t("Change the date range or filters to view other counts.")}
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card md:block"><Table><TableHeader><TableRow><TableHead>{t("Count number")}</TableHead><TableHead>{t("Warehouse")}</TableHead><TableHead>{t("Started")}</TableHead><TableHead>{t("Completed")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-end">{t("Items")}</TableHead><TableHead className="text-center">{t("Action")}</TableHead></TableRow></TableHeader><TableBody>{filteredCounts.map((c) => { const status = statusLabel(c.status); return <TableRow key={c.id}><TableCell className="font-medium">#{c.id.slice(-6).toUpperCase()}</TableCell><TableCell>{warehouseNameById.get(c.warehouse_id) ?? t("Warehouse")}</TableCell><TableCell className="text-muted-foreground">{formatDateTime(c.started_at)}</TableCell><TableCell className="text-muted-foreground">{c.completed_at ? formatDateTime(c.completed_at) : "—"}</TableCell><TableCell><StatusPill label={t(status.label)} variant={status.variant} /></TableCell><TableCell className="text-end tabular-nums">{c.lines.length}</TableCell><TableCell className="text-center"><CompactAction label={t("Print")} icon={Printer} href={`/print/stock-count/${c.id}`} className="border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300" /></TableCell></TableRow>; })}</TableBody></Table></div>
              <div className="grid gap-2 md:hidden">
                {filteredCounts.map((c) => {
                  const status = statusLabel(c.status);
                  return (
                    <MobileEntityCard
                      key={c.id}
                      title={`${t("Stock count")} #${c.id.slice(-6).toUpperCase()}`}
                      subtitle={warehouseNameById.get(c.warehouse_id) ?? t("Warehouse")}
                      badge={<StatusPill label={t(status.label)} variant={status.variant} />}
                      fields={[{ label: t("Items"), value: String(c.lines.length) }, { label: t("Started"), value: formatDateTime(c.started_at) }]}
                      footer={
                        <CompactActions>
                          <CompactAction
                            label={t("Print")}
                            icon={Printer}
                            href={`/print/stock-count/${c.id}`}
                          />
                        </CompactActions>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
