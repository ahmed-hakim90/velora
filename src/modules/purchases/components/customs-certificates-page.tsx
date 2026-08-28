"use client";

import { useMemo, useState, useTransition } from "react";
import { FileBadge, Plus } from "lucide-react";
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
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  addCertificateCostAction,
  closeCertificateAction,
  createCertificateAction,
} from "@/modules/purchases/actions/purchase-import.actions";
import type { CertificateWithDetails } from "@/modules/purchases/services/customs-certificate.service";
import {
  CUSTOMS_CERTIFICATE_COST_TYPE_LABELS,
  CUSTOMS_CERTIFICATE_COST_TYPES,
  CUSTOMS_CERTIFICATE_STATUS_LABELS,
  type CustomsCertificateCostType,
} from "@/modules/purchases/lib/import-constants";
import { CERTIFICATE_COST_HINT } from "@/modules/purchases/lib/landed-cost-split";
import type { Supplier } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface CustomsCertificatesPageProps {
  certificates: CertificateWithDetails[];
  suppliers: Supplier[];
  currency: string;
}

export function CustomsCertificatesPage({
  certificates: initial,
  suppliers,
  currency,
}: CustomsCertificatesPageProps) {
  const { t } = useTranslation();
  const [certificates, setCertificates] = useState(initial);
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [newNumber, setNewNumber] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [costType, setCostType] = useState<CustomsCertificateCostType>("customs");
  const [costAmount, setCostAmount] = useState("");
  const [payeeId, setPayeeId] = useState<string>("");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" });

  const filteredCertificates = useMemo(() => certificates.filter((certificate) => {
    const normalizedQuery = query.trim().toLowerCase();
    const date = certificate.certificate_date || certificate.created_at.slice(0, 10);
    return (!normalizedQuery || certificate.certificate_number.toLowerCase().includes(normalizedQuery)) && (statusFilter === "all" || certificate.status === statusFilter) && (!dateRange.from || date >= dateRange.from) && (!dateRange.to || date <= dateRange.to);
  }), [certificates, query, statusFilter, dateRange]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => value && value !== "all" ? params.set(key, value) : params.delete(key));
    const nextQuery = params.toString();
    window.history.replaceState(null, "", nextQuery ? `/inventory/customs-certificates?${nextQuery}` : "/inventory/customs-certificates");
  }

  const selected = useMemo(
    () => filteredCertificates.find((c) => c.id === selectedId) ?? filteredCertificates[0] ?? null,
    [filteredCertificates, selectedId]
  );

  function createCert() {
    startTransition(async () => {
      const result = await createCertificateAction({
        certificateNumber: newNumber,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) => [result.data, ...prev]);
      setSelectedId(result.data.id);
      setNewNumber("");
      toast.success(t("Customs certificate created"));
    });
  }

  function addCost() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addCertificateCostAction({
        certificateId: selected.id,
        costType,
        amount: parseFloat(costAmount) || 0,
        payeeSupplierId: payeeId || null,
        paymentMethod: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) =>
        prev.map((c) => (c.id === selected.id ? result.data : c))
      );
      setCostAmount("");
      toast.success(t("Cost added and landed cost updated"));
    });
  }

  function closeCert() {
    if (!selected) return;
    startTransition(async () => {
      const result = await closeCertificateAction(selected.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) =>
        prev.map((c) => (c.id === selected.id ? result.data : c))
      );
      toast.success(t("Certificate closed"));
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customs certificates"
        description="Track the customs number and port-to-warehouse costs. Supplier shipping stays on the purchase invoice."
      />

      <OperationalCard title={t("New certificate")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>{t("Certificate number")}</Label>
            <Input
              className="min-h-11"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder={t("Customs number")}
            />
          </div>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || !newNumber.trim()}
            onClick={createCert}
          >
            {t("Create")}
          </Button>
        </div>
      </OperationalCard>

      <div className="grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:grid-cols-[auto_minmax(12rem,1fr)_10rem] xl:items-end">
        <Input className="h-8 min-h-8 min-w-0 flex-1" aria-label={t("Search certificates")} placeholder={t("Search by certificate number")} value={query} onChange={(event) => { setQuery(event.target.value); updateUrl({ q: event.target.value }); }} />
        <DateRangeFilter className="order-first col-span-2 xl:order-none xl:col-span-1" value={dateRange} onChange={(next) => { setDateRange(next); updateUrl(next); }} />
        <Select value={statusFilter} onValueChange={(value) => { const next = value ?? "all"; setStatusFilter(next); updateUrl({ status: next }); }}><SelectTrigger size="sm" className="w-full xl:w-40" aria-label={t("Certificate status")}><SelectValue>{() => statusFilter === "all" ? t("All statuses") : t(CUSTOMS_CERTIFICATE_STATUS_LABELS[statusFilter as keyof typeof CUSTOMS_CERTIFICATE_STATUS_LABELS])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">{t("All statuses")}</SelectItem><SelectItem value="open">{t("Open")}</SelectItem><SelectItem value="closed">{t("Closed")}</SelectItem></SelectContent></Select>
      </div>

      {filteredCertificates.length === 0 ? (
        <EmptyStateBlock
          title={certificates.length === 0 ? t("No certificates") : t("No matching results")}
          description={certificates.length === 0 ? t("Record the customs certificate when containers reach the port.") : t("Change the date range or filters to view other certificates.")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(28rem,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <div className="hidden overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card lg:block"><Table><TableHeader><TableRow><TableHead>{t("Certificate")}</TableHead><TableHead>{t("Date")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-end">{t("Containers")}</TableHead><TableHead className="text-end">{t("Cost")}</TableHead></TableRow></TableHeader><TableBody>{filteredCertificates.map((cert) => <TableRow key={cert.id} data-state={selectedId === cert.id ? "selected" : undefined} className="cursor-pointer" onClick={() => setSelectedId(cert.id)}><TableCell className="font-medium tabular-nums">{cert.certificate_number}</TableCell><TableCell className="text-muted-foreground">{formatDateTime(cert.certificate_date)}</TableCell><TableCell><StatusPill label={t(CUSTOMS_CERTIFICATE_STATUS_LABELS[cert.status])} variant={cert.status === "open" ? "info" : "success"} /></TableCell><TableCell className="text-end tabular-nums">{cert.containers.length}</TableCell><TableCell className="text-end tabular-nums">{formatCurrency(cert.costsTotal, currency)}</TableCell></TableRow>)}</TableBody></Table></div>
            <div className="space-y-2 lg:hidden">
            {filteredCertificates.map((cert) => (
              <button
                key={cert.id}
                type="button"
                onClick={() => setSelectedId(cert.id)}
                className={`w-full rounded-xl border px-3 py-3 text-start transition ${
                  selectedId === cert.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">{cert.certificate_number}</span>
                  <StatusPill
                    label={t(CUSTOMS_CERTIFICATE_STATUS_LABELS[cert.status])}
                    variant={cert.status === "open" ? "info" : "success"}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cert.containers.length} {t("containers")} ·{" "}
                  {formatCurrency(cert.costsTotal, currency)}
                </p>
              </button>
            ))}
            </div>
          </div>

          {selected ? (
            <OperationalCard
              title={selected.certificate_number}
              description={`${selected.containers.length} ${t("linked containers")}`}
              action={
                selected.status === "open" ? (
                  <CompactActions>
                    <CompactAction
                      label={t("Close certificate")}
                      icon={FileBadge}
                      disabled={pending}
                      onClick={closeCert}
                    />
                  </CompactActions>
                ) : null
              }
            >
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t("Containers")}</h3>
                  {selected.containers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("Link a container from the containers list or purchase order.")}
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {selected.containers.map((c) => (
                        <li key={c.id} className="tabular-nums">
                          {c.container_number} · {c.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">{t("Costs")}</h3>
                  <p className="mb-3 text-xs text-muted-foreground">{t(CERTIFICATE_COST_HINT)}</p>
                  {selected.linkedInvoiceExtraCost > 0 ? (
                    <p className="mb-3 rounded-[var(--mds-radius-lg)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                      {t("Container invoices include an extra cost of")} {formatCurrency(selected.linkedInvoiceExtraCost, currency)} — {t("This is supplier shipping on the invoice. Do not record it again here.")}
                    </p>
                  ) : null}
                  {selected.costs.length === 0 ? (
                    <p className="mb-3 text-sm text-muted-foreground">{t("No costs yet")}</p>
                  ) : (
                    <ul className="mb-3 space-y-1 text-sm">
                      {selected.costs.map((cost) => (
                        <li key={cost.id} className="flex justify-between gap-2">
                          <span>
                            {t(CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[cost.cost_type])}
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(cost.amount, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selected.status === "open" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t("Cost type")}</Label>
                        <Select
                          value={costType}
                          onValueChange={(v) => {
                            if (v) setCostType(v as CustomsCertificateCostType);
                          }}
                        >
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue>
                              {() => t(CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[costType])}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMS_CERTIFICATE_COST_TYPES.map((type) => (
                              <SelectItem
                                key={type}
                                value={type}
                                label={t(CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[type])}
                              >
                                {t(CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[type])}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("Amount")} ({currency})</Label>
                        <Input
                          className="min-h-11"
                          inputMode="decimal"
                          value={costAmount}
                          onChange={(e) => setCostAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t("Payee (supplier / agent) — optional")}</Label>
                        <Select
                          value={payeeId || "__none__"}
                          onValueChange={(v) =>
                            setPayeeId(!v || v === "__none__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue>
                              {(value) =>
                                value === "__none__"
                                  ? t("None")
                                  : suppliers.find((s) => s.id === value)?.name ?? t("None")
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" label={t("None")}>
                              {t("None")}
                            </SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id} label={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        className="min-h-11 sm:col-span-2"
                        disabled={pending}
                        onClick={addCost}
                      >
                        <Plus className="size-4" />
                        {t("Add cost and capitalize it")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </OperationalCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
