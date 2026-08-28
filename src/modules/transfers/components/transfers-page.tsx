"use client";

import { useMemo, useState } from "react";
import { Columns3, Eye, List, Pencil, Plus, ArrowLeftRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { Product, Store, Warehouse } from "@/lib/types";
import type { TransferWithLines } from "@/modules/transfers/services/transfer.service";
import { TransferForm } from "./transfer-form";
import { useTranslation } from "@/lib/i18n/use-translation";

interface TransfersPageProps {
  transfers: TransferWithLines[];
  stores: Store[];
  warehouses: Warehouse[];
  products: Product[];
  storeId: string;
}

const TRANSFER_STATUS_LABELS: Record<TransferWithLines["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  received: "Received",
  cancelled: "Cancelled",
};

const statusVariant: Record<
  TransferWithLines["status"],
  "draft" | "warning" | "success" | "danger"
> = {
  draft: "draft",
  sent: "warning",
  received: "success",
  cancelled: "danger",
};

export function TransfersPage({
  transfers,
  stores,
  warehouses,
  products,
  storeId,
}: TransfersPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() => searchParams.get("view") === "kanban" ? "kanban" : "table");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" });
  const filteredTransfers = useMemo(() => transfers.filter((transfer) => {
    const date = transfer.created_at.slice(0, 10);
    if (dateRange.from && date < dateRange.from) return false;
    if (dateRange.to && date > dateRange.to) return false;
    return true;
  }), [transfers, dateRange]);

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, sent: 0, received: 0, cancelled: 0 };
    for (const t of filteredTransfers) {
      counts[t.status] += 1;
    }
    return counts;
  }, [filteredTransfers]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/inventory/transfers?${query}` : "/inventory/transfers");
  }

  if (creating || editingId) {
    return (
      <>
        <PageHeader
          title={editingId ? "Transfer" : "New transfer"}
          description={editingId ? "View or edit transfer" : "Move stock between branches"}
        />
        <TransferForm
          stores={stores}
          warehouses={warehouses}
          products={products}
          defaultFromStoreId={storeId}
          initialTransferId={editingId ?? undefined}
          onComplete={() => {
            setCreating(false);
            setEditingId(null);
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Stock movements between branches"
        action={
          <CompactAction
            label={t("New transfer")}
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setCreating(true)}
          />
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-4">
        <KpiCard
          label={t("Draft")}
          value={String(statusCounts.draft)}
          icon={<Pencil className="size-5" />}
        />
        <KpiCard
          label={t("Sent")}
          value={String(statusCounts.sent)}
          icon={<ArrowLeftRight className="size-5" />}
        />
        <KpiCard
          label={t("Received")}
          value={String(statusCounts.received)}
        />
        <KpiCard
          label={t("Cancelled")}
          value={String(statusCounts.cancelled)}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:flex-row xl:items-center xl:justify-between">
        <DateRangeFilter value={dateRange} onChange={(next) => { setDateRange(next); updateUrl(next); }} />
        <div className="flex gap-1"><Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("table"); updateUrl({ view: "table" }); }}><List className="size-4" />{t("Table")}</Button><Button size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("kanban"); updateUrl({ view: "kanban" }); }}><Columns3 className="size-4" />{t("Kanban")}</Button></div>
      </div>

      {filteredTransfers.length === 0 ? (
        <EmptyStateBlock
          title={t("No transfers yet")}
          description={t("Create a transfer to move stock between branches.")}
          action={
            <CompactAction
              label={t("New transfer")}
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setCreating(true)}
            />
          }
        />
      ) : viewMode === "kanban" ? (
        <div className="grid auto-cols-[minmax(18rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {(["draft", "sent", "received", "cancelled"] as const).map((status) => <section key={status} className="rounded-[var(--mds-radius-lg)] border border-border bg-muted/35 p-2.5"><div className="mb-2 flex justify-between px-1"><h2 className="text-sm font-semibold">{t(TRANSFER_STATUS_LABELS[status])}</h2><span className="rounded-full bg-background px-2 text-xs font-semibold">{statusCounts[status]}</span></div><div className="space-y-2">{filteredTransfers.filter((transfer) => transfer.status === status).map((transfer) => (
            <MobileEntityCard
              key={transfer.id}
              title={`${transfer.fromStoreName} / ${transfer.fromWarehouseName}`}
              subtitle={`← ${transfer.toStoreName} / ${transfer.toWarehouseName}`}
              badge={
                <StatusPill
                  label={t(TRANSFER_STATUS_LABELS[transfer.status])}
                  variant={statusVariant[transfer.status]}
                />
              }
              fields={[
                { label: t("Items"), value: String(transfer.lines.length) },
                { label: t("Date"), value: formatDateTime(transfer.created_at) },
              ]}
              footer={
                <CompactActions className="w-full justify-end">
                  <CompactAction
                    label={transfer.status === "draft" ? t("Edit") : t("View")}
                    icon={transfer.status === "draft" ? Pencil : Eye}
                    onClick={() => setEditingId(transfer.id)}
                  />
                </CompactActions>
              }
            />
          ))}</div></section>)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card"><Table><TableHeader><TableRow><TableHead>{t("From")}</TableHead><TableHead>{t("To")}</TableHead><TableHead>{t("Date")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-end">{t("Items")}</TableHead><TableHead className="text-center">{t("Action")}</TableHead></TableRow></TableHeader><TableBody>{filteredTransfers.map((transfer) => <TableRow key={transfer.id} className="cursor-pointer" onDoubleClick={() => setEditingId(transfer.id)}><TableCell className="font-medium">{transfer.fromStoreName} · {transfer.fromWarehouseName}</TableCell><TableCell>{transfer.toStoreName} · {transfer.toWarehouseName}</TableCell><TableCell className="text-muted-foreground">{formatDateTime(transfer.created_at)}</TableCell><TableCell><StatusPill label={t(TRANSFER_STATUS_LABELS[transfer.status])} variant={statusVariant[transfer.status]} /></TableCell><TableCell className="text-end tabular-nums">{transfer.lines.length}</TableCell><TableCell className="text-center"><CompactAction label={transfer.status === "draft" ? t("Edit") : t("View")} icon={transfer.status === "draft" ? Pencil : Eye} className={transfer.status === "draft" ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-primary/30 bg-primary/10 text-primary"} onClick={() => setEditingId(transfer.id)} /></TableCell></TableRow>)}</TableBody></Table></div>
      )}
    </>
  );
}
