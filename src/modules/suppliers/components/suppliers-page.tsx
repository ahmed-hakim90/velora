"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Banknote, BookOpen, Landmark, Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { EntityList, FilterBar, PageShell } from "@/components/Velora/page-patterns";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { SupplierListSummary } from "@/lib/types";
import type { AgingBuckets } from "@/modules/reports/lib/aging-buckets";
import { AgingBucketsChart } from "@/modules/reports/components/aging-buckets-chart";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import {
  createSupplierFromSuppliersAction,
  getSuppliersPageDataAction,
} from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "@/modules/suppliers/components/record-payment-dialog";
import { useTranslation } from "@/lib/i18n/use-translation";

interface SuppliersPageProps {
  summaries: SupplierListSummary[];
  currency: string;
  canManagePayments?: boolean;
  glance?: {
    paid30d: number;
    agingBuckets: AgingBuckets;
    partiesWithBalance: number;
  } | null;
}

export function SuppliersPage({
  summaries: initial,
  currency,
  canManagePayments = false,
  glance = null,
}: SuppliersPageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const searchParams = useSearchParams();
  const [summaries, setSummaries] = useState(initial);
  const [paid30d, setPaid30d] = useState(glance?.paid30d ?? 0);
  const [agingBuckets, setAgingBuckets] = useState(glance?.agingBuckets ?? null);
  const [partiesWithBalance, setPartiesWithBalance] = useState(
    glance?.partiesWithBalance ?? 0
  );
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    contact_info: "",
    opening_balance: "0",
    address: "",
    tax_id: "",
  });

  const filtered = summaries.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_info.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayables = useMemo(
    () => summaries.reduce((sum, s) => sum + Math.max(0, s.balanceDue), 0),
    [summaries]
  );

  const openPayment = (supplierId?: string) => {
    setPaymentSupplierId(supplierId);
    setShowPayment(true);
  };

  const create = () => {
    if (!form.name.trim()) {
      toast.error(t("Name is required"));
      return;
    }
    const opening = parseFloat(form.opening_balance) || 0;
    if (opening < 0) {
      toast.error(t("Opening balance must be zero or more"));
      return;
    }
    startTransition(async () => {
      const result = await createSupplierFromSuppliersAction({
        name: form.name.trim(),
        contact_info: form.contact_info.trim(),
        opening_balance: opening,
        address: form.address.trim(),
        tax_id: form.tax_id.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = result.data;
      setSummaries([
        {
          ...created,
          totalPurchased: 0,
          totalPaid: 0,
          balanceDue: created.opening_balance,
          invoiceCount: 0,
          lastActivityAt: null,
        },
        ...summaries,
      ]);
      setShowCreate(false);
      setForm({ name: "", contact_info: "", opening_balance: "0", address: "", tax_id: "" });
      toast.success(t("Supplier created"));
    });
  };

  return (
    <>
      <PageShell dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title="Suppliers"
        description="Balances and account statements."
        action={
          <CompactActions>
            {canManagePayments && summaries.length > 0 ? (
              <CompactAction
                label="Record payment"
                icon={Banknote}
                onClick={() => openPayment()}
              />
            ) : null}
            <CompactAction
              label="Add Supplier"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setShowCreate(true)}
            />
          </CompactActions>
        }
      />

      <section aria-label={t("Supplier summary")} className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-border px-4 py-4 lg:border-b-0"><dt className="text-xs font-medium text-muted-foreground">{t("Total payables")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totalPayables, currency, locale)}</dd><dd className="text-xs text-muted-foreground">{agingBuckets ? `${partiesWithBalance} ${t("suppliers with balance")}` : t("Current balance")}</dd></div>
          <div className="border-b border-border px-4 py-4 sm:border-s lg:border-b-0"><dt className="text-xs font-medium text-muted-foreground">{t("Suppliers")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summaries.length}</dd><dd className="text-xs text-muted-foreground">{t("Registered suppliers")}</dd></div>
          <div className="border-b border-border px-4 py-4 lg:border-b-0 lg:border-s"><dt className="text-xs font-medium text-muted-foreground">{t("Paid in 30 days")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(paid30d, currency, locale)}</dd><dd className="text-xs text-muted-foreground">{t("Valid payments")}</dd></div>
          <div className="px-4 py-4 sm:border-s"><dt className="text-xs font-medium text-muted-foreground">{t("Search results")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{filtered.length}</dd><dd className="text-xs text-muted-foreground">{t(search.trim() ? "Matches current filter" : "All suppliers")}</dd></div>
        </dl>
      </section>

      <FilterBar>
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { const next = e.target.value; setSearch(next); const params = new URLSearchParams(searchParams.toString()); if (next.trim()) params.set("q", next); else params.delete("q"); const query = params.toString(); window.history.replaceState(null, "", query ? `/inventory/suppliers?${query}` : "/inventory/suppliers"); }} placeholder={t("Search suppliers...")} className="ps-10" />
        </div>
        <p className="text-xs text-muted-foreground">{t("Search by name or contact")}</p>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="space-y-4">
          <EmptyStateBlock
            title={search.trim() ? "No results" : "No suppliers"}
            description={
              search.trim()
                ? "Try a different supplier name."
                : "Add a supplier to track purchases and balances."
            }
          />
          {!search.trim() ? (
            <div className="flex justify-center">
              <Button onClick={() => setShowCreate(true)}>{t("Add Supplier")}</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <EntityList className="divide-y divide-border">
          {filtered.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
              <Link href={`/inventory/suppliers/${s.id}?returnTo=${encodeURIComponent(searchParams.toString() ? `/inventory/suppliers?${searchParams.toString()}` : "/inventory/suppliers")}`} className="min-w-0 flex-1 outline-none">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.contact_info ? (
                      <p className="truncate text-sm text-muted-foreground">{s.contact_info}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.invoiceCount} {t("received invoices")}
                    </p>
                  </div>
                  <div className="shrink-0 sm:min-w-32">
                    <p className="font-semibold">{formatCurrency(s.balanceDue, currency, locale)}</p>
                    <p className="text-xs text-muted-foreground">{t("Balance due")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground sm:min-w-36">{s.lastActivityAt ? `${t("Last activity")} ${formatDateTime(s.lastActivityAt)}` : t("No activity yet")}</p>
                </div>
              </Link>
              {canManagePayments ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => openPayment(s.id)}><Banknote className="size-4" /> {t("Record payment")}</Button>
              ) : null}
            </div>
          ))}
        </EntityList>
      )}

      {agingBuckets ? (
        <AgingBucketsChart title={t("Supplier aging")} buckets={agingBuckets} currency={currency} barColor="var(--mds-color-feedback-info)" />
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="Supplier analysis"
        description="Balances, statements, and purchases"
        links={[
          { href: "/reports/aging?side=suppliers", label: "Supplier aging", description: "Aging and payables", icon: Landmark },
          { href: "/reports/statement?party=supplier", label: "Supplier statement", description: "Detailed activity by period", icon: BookOpen },
          { href: "/inventory/purchases", label: "Purchases", description: "Received invoices", icon: Truck },
        ]}
      />

      </PageShell>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("New Supplier")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t("Name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Contact")}</Label>
              <Input
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder={t("Email or phone")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Address")}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Tax ID")}</Label>
              <Input
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Opening balance due")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {t("Enter any balance from before using the system.")}
              </p>
            </div>
            <Button onClick={create} disabled={pending}>
              {t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {canManagePayments ? (
        <RecordPaymentDialog
          open={showPayment}
          onOpenChange={(open) => {
            setShowPayment(open);
            if (!open) setPaymentSupplierId(undefined);
          }}
          suppliers={paymentSupplierId ? undefined : summaries}
          currency={currency}
          initialSupplierId={paymentSupplierId}
          supplierId={paymentSupplierId}
          onSuccess={() => {
            startTransition(async () => {
              try {
                const data = await getSuppliersPageDataAction();
                setSummaries(data.summaries);
                setPaid30d(data.glance.paid30d);
                setAgingBuckets(data.glance.agingBuckets);
                setPartiesWithBalance(data.glance.partiesWithBalance);
              } catch {
                router.refresh();
              }
            });
          }}
        />
      ) : null}
    </>
  );
}
