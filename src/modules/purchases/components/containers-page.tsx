"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Ship } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  attachContainerCertificateAction,
  createContainerAction,
  listCertificatesAction,
  receiveContainerAction,
  updateContainerStatusAction,
} from "@/modules/purchases/actions/purchase-import.actions";
import type { ContainerWithLines } from "@/modules/purchases/services/purchase-container.service";
import type { CertificateWithDetails } from "@/modules/purchases/services/customs-certificate.service";
import {
  PURCHASE_CONTAINER_STATUS_LABELS,
  type PurchaseContainerStatus,
} from "@/modules/purchases/lib/import-constants";
import { useTranslation } from "@/lib/i18n/use-translation";

const statusVariant: Record<
  PurchaseContainerStatus,
  "draft" | "info" | "warning" | "success" | "danger"
> = {
  planned: "draft",
  shipped: "info",
  at_port: "warning",
  inland: "warning",
  received: "success",
  cancelled: "danger",
};

interface ContainersPageProps {
  containers: ContainerWithLines[];
  currency: string;
}

export function ContainersPage({ containers: initial, currency }: ContainersPageProps) {
  const { t } = useTranslation();
  const [containers, setContainers] = useState(initial);
  const searchParams = useSearchParams();
  const [certificates, setCertificates] = useState<CertificateWithDetails[]>([]);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" });

  useEffect(() => {
    void (async () => {
      const result = await listCertificatesAction();
      if (result.ok) {
        setCertificates(result.data.filter((c) => c.status === "open"));
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return containers.filter((c) => {
      const date = c.created_at.slice(0, 10);
      const matchesSearch = !q ||
        c.container_number.toLowerCase().includes(q) ||
        c.purchaseOrderNumber.toLowerCase().includes(q) ||
        (c.certificateNumber ?? "").toLowerCase().includes(q);
      return matchesSearch && (statusFilter === "all" || c.status === statusFilter) && (!dateRange.from || date >= dateRange.from) && (!dateRange.to || date <= dateRange.to);
    });
  }, [containers, filter, statusFilter, dateRange]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value && value !== "all" ? params.set(key, value) : params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/inventory/containers?${query}` : "/inventory/containers");
  }

  function containerActions(container: ContainerWithLines) {
    if (container.status === "received" || container.status === "cancelled") return null;
    return <CompactActions>
      {container.status === "planned" ? <CompactAction label={t("Mark as shipped")} icon={Ship} disabled={pending} onClick={() => advance(container.id, "shipped")} /> : null}
      {container.status === "shipped" ? <CompactAction label={t("Arrived at port")} icon={Ship} disabled={pending} onClick={() => advance(container.id, "at_port")} /> : null}
      {container.status === "at_port" ? <CompactAction label={t("On the way to warehouse")} icon={Ship} disabled={pending} onClick={() => advance(container.id, "inland")} /> : null}
      {(container.status === "inland" || container.status === "at_port" || container.status === "shipped") ? <CompactAction label={t("Receive into warehouse")} icon={Plus} variant="default" disabled={pending} onClick={() => receive(container.id)} /> : null}
    </CompactActions>;
  }

  function certificateSelect(container: ContainerWithLines) {
    if (container.status === "cancelled" || certificates.length === 0) {
      return container.certificateNumber ?? "—";
    }
    return <Select value={container.customs_certificate_id ?? "__none__"} onValueChange={(value) => attachCert(container.id, !value || value === "__none__" ? null : value)}><SelectTrigger size="sm" className="w-full min-w-32" aria-label={`${t("Customs certificate for container")} ${container.container_number}`}><SelectValue>{(value) => value === "__none__" ? t("None") : certificates.find((certificate) => certificate.id === value)?.certificate_number ?? t("None")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__none__">{t("None")}</SelectItem>{certificates.map((certificate) => <SelectItem key={certificate.id} value={certificate.id}>{certificate.certificate_number}</SelectItem>)}</SelectContent></Select>;
  }

  function advance(containerId: string, status: PurchaseContainerStatus) {
    startTransition(async () => {
      const result = await updateContainerStatusAction({ containerId, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data : c))
      );
      toast.success(t("Container status updated"));
    });
  }

  function receive(containerId: string) {
    startTransition(async () => {
      const result = await receiveContainerAction({ containerId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data.container : c))
      );
      toast.success(
        `${t("Container received")} — ${t("Invoice")} ${result.data.purchase.invoice_number} · ${formatCurrency(result.data.purchase.total, currency)}`
      );
    });
  }

  function attachCert(containerId: string, certificateId: string | null) {
    startTransition(async () => {
      const result = await attachContainerCertificateAction({
        containerId,
        certificateId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data : c))
      );
      toast.success(certificateId ? t("Certificate linked") : t("Certificate removed"));
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Containers"
        description="Track purchase order containers from shipping to warehouse receipt"
      />
      <div className="grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:grid-cols-[minmax(12rem,1fr)_auto_11rem] xl:items-end">
        <div className="min-w-0 flex-1">
        <Label htmlFor="container-search" className="sr-only">{t("Search")}</Label>
        <Input
          id="container-search"
          className="h-8 min-h-8"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); updateUrl({ q: e.target.value }); }}
          placeholder={t("Container / order / certificate number")}
        />
        </div>
        <DateRangeFilter className="order-first col-span-2 xl:order-none xl:col-span-1" value={dateRange} onChange={(next) => { setDateRange(next); updateUrl(next); }} />
        <Select value={statusFilter} onValueChange={(value) => { const next = value ?? "all"; setStatusFilter(next); updateUrl({ status: next }); }}><SelectTrigger size="sm" className="w-full xl:w-44" aria-label={t("Container status")}><SelectValue>{() => statusFilter === "all" ? t("All statuses") : t(PURCHASE_CONTAINER_STATUS_LABELS[statusFilter as PurchaseContainerStatus])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All statuses")}</SelectItem>{Object.entries(PURCHASE_CONTAINER_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{t(label)}</SelectItem>)}</SelectContent></Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyStateBlock
          title={containers.length === 0 ? t("No containers") : t("No matching results")}
          description={containers.length === 0 ? t("Create a container from a purchase order after enabling container imports.") : t("Change the date range or filters to view other containers.")}
        />
      ) : (
        <><div className="hidden overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card md:block"><Table><TableHeader><TableRow><TableHead>{t("Container number")}</TableHead><TableHead>{t("Purchase order")}</TableHead><TableHead>{t("Certificate")}</TableHead><TableHead>{t("Created")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-end">{t("Items / quantity")}</TableHead><TableHead className="text-center">{t("Action")}</TableHead></TableRow></TableHeader><TableBody>{filtered.map((container) => <TableRow key={container.id}><TableCell className="font-semibold tabular-nums">{container.container_number}</TableCell><TableCell>{container.purchaseOrderNumber}</TableCell><TableCell>{certificateSelect(container)}</TableCell><TableCell className="text-muted-foreground">{formatDateTime(container.created_at)}</TableCell><TableCell><StatusPill label={t(PURCHASE_CONTAINER_STATUS_LABELS[container.status])} variant={statusVariant[container.status]} /></TableCell><TableCell className="text-end tabular-nums">{container.lines.length} / {container.lines.reduce((sum, line) => sum + line.quantity, 0)}</TableCell><TableCell><div className="flex justify-center">{containerActions(container)}</div></TableCell></TableRow>)}</TableBody></Table></div>
        <div className="grid gap-3 md:hidden">
          {filtered.map((container) => (
            <MobileEntityCard
              key={container.id}
              title={container.container_number}
              subtitle={`${t("Order")} ${container.purchaseOrderNumber}${
                container.certificateNumber
                  ? ` · ${t("Certificate")} ${container.certificateNumber}`
                  : ""
              }`}
              badge={
                <StatusPill
                  label={t(PURCHASE_CONTAINER_STATUS_LABELS[container.status])}
                  variant={statusVariant[container.status]}
                />
              }
              fields={[{ label: t("Items"), value: String(container.lines.length) }, { label: t("Quantity"), value: String(container.lines.reduce((sum, line) => sum + line.quantity, 0)) }, { label: t("Created"), value: formatDateTime(container.created_at) }]}
              footer={<div className="grid w-full gap-2"><div>{certificateSelect(container)}</div>{containerActions(container)}</div>}
            />
          ))}
        </div></>
      )}
    </div>
  );
}

/** Compact create form used from purchase order detail. */
export function CreateContainerInline({
  purchaseOrderId,
  lines,
  onCreated,
}: {
  purchaseOrderId: string;
  lines: { sourceLineId: string; productName: string; remaining: number }[];
  onCreated: (container: ContainerWithLines) => void;
}) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [l.sourceLineId, l.remaining > 0 ? String(l.remaining) : ""])
    )
  );

  function submit() {
    startTransition(async () => {
      const payload = lines
        .map((line) => ({
          sourceLineId: line.sourceLineId,
          quantity: parseFloat(qtys[line.sourceLineId] || "0") || 0,
        }))
        .filter((l) => l.quantity > 0);
      const result = await createContainerAction({
        purchaseOrderId,
        containerNumber: number,
        lines: payload,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("Container created"));
      setNumber("");
      onCreated(result.data);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3">
      <div className="space-y-1.5">
        <Label>{t("Container number")}</Label>
        <Input
          className="min-h-11"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="MSKU1234567"
        />
      </div>
      {lines.map((line) => (
        <div key={line.sourceLineId} className="grid grid-cols-[1fr_7rem] items-end gap-2">
          <div>
            <p className="text-sm font-medium">{line.productName}</p>
            <p className="text-xs text-muted-foreground">{t("Remaining")} {line.remaining}</p>
          </div>
          <Input
            className="min-h-11"
            inputMode="decimal"
            value={qtys[line.sourceLineId] ?? ""}
            onChange={(e) =>
              setQtys((prev) => ({ ...prev, [line.sourceLineId]: e.target.value }))
            }
            disabled={line.remaining <= 0}
          />
        </div>
      ))}
      <Button
        type="button"
        disabled={pending || !number.trim()}
        onClick={submit}
        className="min-h-11 w-full"
      >
        {t("Add container")}
      </Button>
    </div>
  );
}
