"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Heart,
  Landmark,
  Plus,
  Search,
} from "lucide-react";
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
import { PageHeader } from "@/components/Velora/page-header";
import { CompactAction } from "@/components/Velora/compact-actions";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { EntityList, FilterBar, PageShell } from "@/components/Velora/page-patterns";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";
import type { AgingBuckets } from "@/modules/reports/lib/aging-buckets";
import { AgingBucketsChart } from "@/modules/reports/components/aging-buckets-chart";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { createCustomerAction } from "@/modules/customers/actions/customer.actions";
import { useTranslation } from "@/lib/i18n/use-translation";

interface CustomersPageProps {
  customers: Customer[];
  currency?: string;
  glance?: {
    collected30d: number;
    agingBuckets: AgingBuckets;
    partiesWithBalance: number;
  } | null;
  /** Soft-hide AR credit KPI when org credit_sales is off. */
  creditSalesEnabled?: boolean;
}

export function CustomersPage({
  customers: initial,
  currency = "EGP",
  glance = null,
  creditSalesEnabled = false,
}: CustomersPageProps) {
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", tax_id: "" });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const creditBalance = customers.reduce(
    (sum, c) => sum + (c.account_balance ?? 0),
    0
  );

  const create = () => {
    startTransition(async () => {
      try {
        const customer = await createCustomerAction(form);
        setCustomers([customer, ...customers]);
        setShowCreate(false);
        setForm({ name: "", phone: "", email: "", address: "", tax_id: "" });
        toast.success(t("Customer created"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Action failed"));
      }
    });
  };

  return (
    <PageShell dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        breadcrumb={
          <span>
            <Link href="/customers" className="text-primary hover:underline">
              {t("Customers")}
            </Link>
            <span className="mx-1 text-muted-foreground">/</span>
            {t("Customer Directory")}
          </span>
        }
        title="Customer Directory"
        description="Profiles, history, and loyalty."
        action={
          <CompactAction
            label="إضافة عميل"
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setShowCreate(true)}
          />
        }
      />

      <section
        aria-label={t("Customer summary")}
        className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card"
      >
        <dl className={creditSalesEnabled ? "grid grid-cols-2 lg:grid-cols-4" : "grid grid-cols-2"}>
          <div className={creditSalesEnabled ? "border-b border-border px-3 py-3 lg:border-b-0 sm:px-4 sm:py-4" : "px-3 py-3 sm:px-4 sm:py-4"}>
            <dt className="text-xs font-medium text-muted-foreground">{t("Total customers")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{customers.length}</dd>
            <dd className="text-xs text-muted-foreground">{t("Registered customers")}</dd>
          </div>
          <div className={creditSalesEnabled ? "border-b border-s border-border px-3 py-3 lg:border-b-0 sm:px-4 sm:py-4" : "border-s border-border px-3 py-3 sm:px-4 sm:py-4"}>
            <dt className="text-xs font-medium text-muted-foreground">{t("Search results")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{filtered.length}</dd>
            <dd className="text-xs text-muted-foreground">{t(search.trim() ? "Matches current filter" : "All customers")}</dd>
          </div>
          {creditSalesEnabled ? (
            <>
              <div className="px-3 py-3 lg:border-s sm:px-4 sm:py-4">
                <dt className="text-xs font-medium text-muted-foreground">{t("Credit balance")}</dt>
                <dd className="mt-1 break-words text-xl font-semibold tabular-nums">{formatCurrency(creditBalance, currency, locale)}</dd>
                <dd className="text-xs text-muted-foreground">{glance ? `${glance.partiesWithBalance} ${t("with balance")}` : t("Total balances")}</dd>
              </div>
              <div className="border-s border-border px-3 py-3 sm:px-4 sm:py-4">
                <dt className="text-xs font-medium text-muted-foreground">{t("Collected in 30 days")}</dt>
                <dd className="mt-1 break-words text-xl font-semibold tabular-nums">{formatCurrency(glance?.collected30d ?? 0, currency, locale)}</dd>
                <dd className="text-xs text-muted-foreground">{t("Customer payments")}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <FilterBar><div className="relative w-full sm:max-w-md"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { const next = e.target.value; setSearch(next); const params = new URLSearchParams(searchParams.toString()); if (next.trim()) params.set("q", next); else params.delete("q"); const query = params.toString(); window.history.replaceState(null, "", query ? `/customers/directory?${query}` : "/customers/directory"); }} placeholder={t("Search by name or phone...")} className="ps-10" aria-label={t("Search customers")} /></div><p className="text-xs text-muted-foreground">{t("Search by name or phone")}</p></FilterBar>

      {filtered.length === 0 ? (
        <div className="flex flex-col gap-[var(--mds-space-4)]">
          <EmptyStateBlock
            title={search.trim() ? "No results" : "No customers"}
            description={
              search.trim()
                ? "Try a different name or phone."
                : creditSalesEnabled
                  ? "Add a customer to start loyalty and credit sales."
                  : "Add a customer to start loyalty and sales history."
            }
          />
          {!search.trim() ? (
            <div className="flex justify-center">
              <Button
                className="shadow-[var(--mds-elevation-1)]"
                onClick={() => setShowCreate(true)}
              >
                {t("Add Customer")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <EntityList className="divide-y divide-border">
          {filtered.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}?returnTo=${encodeURIComponent(searchParams.toString() ? `/customers/directory?${searchParams.toString()}` : "/customers/directory")}`} className="grid min-w-0 gap-3 p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0"><h3 className="truncate font-semibold">{c.name}</h3><p className="truncate text-sm text-muted-foreground" dir="ltr">{c.phone}</p></div>
              <div className="sm:min-w-28"><p className="text-sm font-semibold tabular-nums">{formatCurrency(c.total_spent, currency, locale)}</p><p className="text-xs text-muted-foreground">{c.visit_count} {t("visits")}</p></div>
              <div className="sm:min-w-32">{c.account_balance > 0 ? <span className="rounded-full bg-[var(--mds-color-feedback-warning-subtle)] px-2 py-1 text-xs font-medium text-[var(--mds-color-feedback-warning)]">{t("Due")} {formatCurrency(c.account_balance, currency, locale)}</span> : <span className="text-xs text-muted-foreground">{t("Nothing due")}</span>}</div>
            </Link>
          ))}
        </EntityList>
      )}

      {creditSalesEnabled && glance ? <AgingBucketsChart title={t("Customer aging")} buckets={glance.agingBuckets} currency={currency} barColor="var(--mds-color-feedback-warning)" /> : null}
      <ModuleAnalyticsQuickLinks title="Customer analysis" description="Balances, statements, and loyalty" links={[...(creditSalesEnabled ? [{ href: "/reports/aging?side=customers", label: "Customer aging", description: "Aging and collection", icon: Landmark }] : []), { href: "/reports/statement?party=customer", label: "Customer statement", description: "Detailed activity by period", icon: BookOpen }, { href: "/customers/loyalty", label: "Loyalty", description: "Points earned and redeemed", icon: Heart }]} />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-[var(--mds-radius-lg)]">
          <DialogHeader>
            <DialogTitle>{t("New Customer")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-name">{t("Name")}</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-phone">{t("Phone")}</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-email">{t("Email")}</Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-address">{t("Address")}</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-tax">{t("Tax ID")}</Label>
              <Input
                id="customer-tax"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <Button
              className="shadow-[var(--mds-elevation-1)]"
              onClick={create}
              disabled={pending || form.name.trim().length < 2 || form.phone.trim().length < 8}
            >
              {t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
