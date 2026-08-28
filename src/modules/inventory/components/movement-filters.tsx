"use client";

import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { DateRangeFilter } from "@/components/Velora/date-range-filter";
import type { Warehouse } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

const TYPES = [
  ["sale", "Sale"], ["purchase", "Purchase"], ["purchase_from_session", "Session purchase"],
  ["transfer_in", "Transfer in"], ["transfer_out", "Transfer out"], ["waste", "Waste"],
  ["adjustment", "Adjustment"], ["stock_count", "Stock count"], ["reservation", "Reservation"],
  ["reservation_release", "Reservation release"],
] as const;

export function MovementFilters({ warehouses, warehouseId, type, from, to }: { warehouses: Warehouse[]; warehouseId: string; type: string; from: string; to: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    router.replace(query ? `/inventory/movements?${query}` : "/inventory/movements", { scroll: false });
  }
  return (
    <div className="flex flex-col gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">{t("Warehouse")}<select className="h-9 min-w-40 rounded-[var(--mds-radius-md)] border border-input bg-background px-2 text-sm text-foreground" value={warehouseId} onChange={(event) => apply({ warehouseId: event.target.value })}><option value="">{t("All warehouses")}</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">{t("Movement type")}<select className="h-9 min-w-40 rounded-[var(--mds-radius-md)] border border-input bg-background px-2 text-sm text-foreground" value={type} onChange={(event) => apply({ type: event.target.value })}><option value="">{t("All types")}</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
      </div>
      <DateRangeFilter value={{ from, to }} onChange={(next) => apply(next)} />
    </div>
  );
}
