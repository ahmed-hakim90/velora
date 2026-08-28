"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompactAction } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { KpiCard } from "@/components/Velora/kpi-card";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { formatDateTime } from "@/lib/format";
import type { Product, Warehouse } from "@/lib/types";
import type { WasteWithProduct } from "@/modules/waste/services/waste.service";
import { WASTE_REASONS } from "@/modules/waste/constants";
import { WasteForm } from "./waste-form";
import { useTranslation } from "@/lib/i18n/use-translation";

interface WastePageProps {
  records: WasteWithProduct[];
  summary: {
    totalUnits: number;
    recordCount: number;
    byReason: { code: string; label: string; count: number; units: number }[];
  };
  products: Product[];
  warehouses: Warehouse[];
}

export function WastePage({ records, summary: _summary, products, warehouses }: WastePageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" });
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouse") ?? "all");
  const [reason, setReason] = useState(searchParams.get("reason") ?? "all");
  const reasonLabels = new Map<string, string>(WASTE_REASONS.map((item) => [item.code, item.label]));
  const filteredRecords = useMemo(() => records.filter((record) => {
    const date = record.created_at.slice(0, 10);
    return (!dateRange.from || date >= dateRange.from) && (!dateRange.to || date <= dateRange.to) && (warehouseId === "all" || record.warehouse_id === warehouseId) && (reason === "all" || record.reason_code === reason);
  }), [records, dateRange, warehouseId, reason]);
  const filteredSummary = useMemo(() => ({
    totalUnits: filteredRecords.reduce((total, record) => total + record.quantity, 0),
    recordCount: filteredRecords.length,
    byReason: WASTE_REASONS.map((item) => ({ ...item, units: filteredRecords.filter((record) => record.reason_code === item.code).reduce((total, record) => total + record.quantity, 0) })),
  }), [filteredRecords]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value && value !== "all" ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/inventory/waste?${query}` : "/inventory/waste");
  }

  if (showForm) {
    return (
      <>
        <PageHeader title="Record waste" />
        <WasteForm
          products={products}
          warehouses={warehouses}
          onComplete={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Waste"
        description="Track lost and damaged stock"
        action={
          <CompactAction
            label={t("Record waste")}
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setShowForm(true)}
          />
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-3">
        <KpiCard label={t("Units in period")} value={String(filteredSummary.totalUnits)} icon={<Trash2 className="size-5" />} />
        <KpiCard label={t("Records")} value={String(filteredSummary.recordCount)} />
        <KpiCard
          label={t("Top reason")}
          value={
            [...filteredSummary.byReason].sort((a, b) => b.units - a.units)[0]?.units ? t([...filteredSummary.byReason].sort((a, b) => b.units - a.units)[0]?.label ?? "") : "—"
          }
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:grid-cols-[auto_11rem_11rem] xl:items-end">
        <DateRangeFilter className="col-span-2 xl:col-span-1" value={dateRange} onChange={(next) => { setDateRange(next); updateUrl(next); }} />
        <Select value={warehouseId} onValueChange={(value) => { const next = value ?? "all"; setWarehouseId(next); updateUrl({ warehouse: next }); }}><SelectTrigger size="sm" className="w-full xl:w-44" aria-label={t("Warehouse")}><SelectValue>{() => warehouseId === "all" ? t("All warehouses") : warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? t("All warehouses")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All warehouses")}</SelectItem>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
        <Select value={reason} onValueChange={(value) => { const next = value ?? "all"; setReason(next); updateUrl({ reason: next }); }}><SelectTrigger size="sm" className="w-full xl:w-44" aria-label={t("Waste reason")}><SelectValue>{() => reason === "all" ? t("All reasons") : t(reasonLabels.get(reason) ?? "All reasons")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All reasons")}</SelectItem>{WASTE_REASONS.map((item) => <SelectItem key={item.code} value={item.code}>{t(item.label)}</SelectItem>)}</SelectContent></Select>
      </div>

      {filteredSummary.totalUnits > 0 ? (
        <div className="mb-3">
          <ReportChartSection title={t("Waste by reason")} height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...filteredSummary.byReason]
                  .sort((a, b) => b.units - a.units)
                  .slice(0, 8)
                  .map((r) => ({
                    label: t(r.label).length > 10 ? `${t(r.label).slice(0, 10)}…` : t(r.label),
                    units: r.units,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="units" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        </div>
      ) : null}

      {filteredRecords.length === 0 ? (
        <EmptyStateBlock
          title={records.length === 0 ? t("No waste recorded yet") : t("No matching results")}
          description={records.length === 0 ? t("Record lost and damaged stock to track waste reasons.") : t("Change the date range or filters to view other records.")}
          action={
            <CompactAction
              label={t("Record waste")}
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setShowForm(true)}
            />
          }
        />
      ) : (
        <><div className="hidden overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card md:block"><Table><TableHeader><TableRow><TableHead>{t("Product")}</TableHead><TableHead>{t("Warehouse")}</TableHead><TableHead>{t("Reason")}</TableHead><TableHead>{t("Date")}</TableHead><TableHead className="text-end">{t("Quantity")}</TableHead></TableRow></TableHeader><TableBody>{filteredRecords.map((r) => <TableRow key={r.id}><TableCell className="font-medium">{r.productName}</TableCell><TableCell>{r.warehouseName}</TableCell><TableCell>{t(reasonLabels.get(r.reason_code) ?? r.reason_code)}</TableCell><TableCell className="text-muted-foreground">{formatDateTime(r.created_at)}</TableCell><TableCell className="text-end font-semibold tabular-nums text-destructive">−{r.quantity}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="grid gap-[var(--mds-space-3)] md:hidden">
          {filteredRecords.map((r) => (
            <MobileEntityCard
              key={r.id}
              title={r.productName}
              subtitle={r.warehouseName}
              badge={
                <span className="rounded-[var(--mds-radius-md)] bg-destructive/10 px-[var(--mds-space-2)] py-0.5 text-sm font-semibold text-destructive">
                  −{r.quantity}
                </span>
              }
              fields={[
                { label: t("Reason"), value: t(reasonLabels.get(r.reason_code) ?? r.reason_code) },
                { label: t("Date"), value: formatDateTime(r.created_at) },
              ]}
            />
          ))}
        </div></>
      )}
    </>
  );
}
