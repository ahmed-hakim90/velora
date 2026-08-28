"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Columns3, Eye, List, Pencil, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { DataTableShell } from "@/components/Velora/data-table-shell";
import { StatusPill } from "@/components/Velora/status-pill";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { todayDocumentDate } from "@/lib/document-date";
import { selectLabelById } from "@/lib/select-label";
import type {
  Customer,
  Order,
  PaymentMethod,
  Product,
  ProductPriceTier,
  Warehouse,
} from "@/lib/types";
import {
  getSalesInvoiceCatalogAction,
  getSalesInvoiceDetailAction,
} from "@/modules/sales-invoices/actions/sales-invoice.actions";
import type { SalesInvoiceWithDetails } from "@/modules/sales-invoices/services/sales-invoice.service";
import { SalesInvoiceForm } from "./sales-invoice-form";
import { useTranslation } from "@/lib/i18n/use-translation";

const LOCAL_DRAFT_PREFIX = "local-";

function buildLocalSalesDraft(input: {
  documentKind: NonNullable<Order["document_kind"]>;
  warehouseId: string;
  customerId: string | null;
  customers: Customer[];
  warehouses: Warehouse[];
}): SalesInvoiceWithDetails {
  const warehouse = input.warehouses.find((w) => w.id === input.warehouseId);
  const customer = input.customerId
    ? input.customers.find((c) => c.id === input.customerId)
    : null;
  const now = new Date().toISOString();
  return {
    id: `${LOCAL_DRAFT_PREFIX}${crypto.randomUUID()}`,
    store_id: "",
    session_id: null,
    order_number: "New draft",
    customer_id: input.customerId,
    status: "completed",
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    payment_status: "unpaid",
    created_by: "",
    created_at: now,
    sales_mode: "wholesale",
    document_status: "draft",
    document_kind: input.documentKind,
    source_document_id: null,
    document_notes: "",
    document_date: todayDocumentDate(),
    warehouse_id: input.warehouseId,
    valid_until: null,
    lines: [],
    customerName: customer?.name ?? null,
    warehouseName: warehouse?.name ?? null,
  };
}

interface SalesInvoicesPageProps {
  invoices: SalesInvoiceWithDetails[];
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  wholesaleTiersByProductId: Record<string, ProductPriceTier[]>;
  currency: string;
  enabledPaymentMethods: PaymentMethod[];
  canCorrectCosts?: boolean;
  canManagePrintEngine?: boolean;
  documentKind?: NonNullable<Order["document_kind"]>;
  basePath?: string;
  title?: string;
  description?: string;
  createLabel?: string;
  allowCreate?: boolean;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  delivered: "Delivered",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  invoiced: "Invoiced",
};

const statusVariant: Record<string, "draft" | "info" | "success" | "danger" | "warning"> = {
  draft: "draft",
  issued: "info",
  delivered: "success",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
  confirmed: "info",
  cancelled: "danger",
  invoiced: "success",
};

export function SalesInvoicesPage({
  invoices: initial,
  customers,
  products: initialProducts,
  warehouses,
  wholesaleTiersByProductId: initialTiers,
  currency,
  enabledPaymentMethods,
  canCorrectCosts = false,
  canManagePrintEngine = false,
  documentKind = "sales_invoice",
  basePath = "/sales-invoices",
  title = "Sales Invoices",
  description = "Draft, issue, deliver, and update inventory.",
  createLabel = "New invoice",
  allowCreate = true,
}: SalesInvoicesPageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const searchParams = useSearchParams();
  const openFromQuery = searchParams.get("open");
  const createFromQuery = searchParams.get("create") === "1";
  const [, startTransition] = useTransition();
  const [invoices, setInvoices] = useState(initial);
  const [products, setProducts] = useState(initialProducts);
  const [wholesaleTiersByProductId, setWholesaleTiersByProductId] = useState(initialTiers);
  const [activeId, setActiveId] = useState<string | null>(openFromQuery);
  const [openBootstrapped, setOpenBootstrapped] = useState(false);
  const [createBootstrapped, setCreateBootstrapped] = useState(false);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [customerId, setCustomerId] = useState<string>("__none__");
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() =>
    searchParams.get("view") === "kanban" ? "kanban" : "table"
  );
  const [activeStatus, setActiveStatus] = useState(searchParams.get("status") ?? "drafts");
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  });

  const listReturnPath = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    params.delete("create");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }, [basePath, searchParams]);

  function updateListUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    params.delete("create");
    Object.entries(patch).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${basePath}?${query}` : basePath);
  }

  useEffect(() => {
    setInvoices(initial);
  }, [initial]);

  useEffect(() => {
    setProducts(initialProducts);
    setWholesaleTiersByProductId(initialTiers);
  }, [initialProducts, initialTiers]);

  const catalogFetchedAtRef = useRef(0);
  const formOpenRef = useRef(Boolean(openFromQuery));
  const refreshCatalog = useCallback((force = false) => {
    const now = Date.now();
    // Avoid hammering: focus + visibility + open were firing 3× (~2–3s each).
    if (!force && now - catalogFetchedAtRef.current < 45_000) return;
    catalogFetchedAtRef.current = now;
    void getSalesInvoiceCatalogAction().then((result) => {
      if (!result.ok) return;
      setProducts(result.data.products);
      setWholesaleTiersByProductId(result.data.wholesaleTiersByProductId);
    });
  }, []);

  const startDraftCreate = useCallback(
    (defaults: { warehouseId: string; customerId: string | null }) => {
      if (!defaults.warehouseId) {
        toast.error(t("Select a warehouse"));
        return;
      }
      if (warehouses.length === 0) {
        toast.error(t("No warehouse available — check branch settings"));
        return;
      }
      formOpenRef.current = true;
      const local = buildLocalSalesDraft({
        documentKind,
        warehouseId: defaults.warehouseId,
        customerId: defaults.customerId,
        customers,
        warehouses,
      });
      // افتح الوثيقة فورًا — المسودة تتسجل على السيرفر عند أول صنف/حفظ/استدعاء
      setInvoices((prev) => [
        local,
        ...prev.filter((invoice) => !invoice.id.startsWith(LOCAL_DRAFT_PREFIX)),
      ]);
      setActiveId(local.id);
      refreshCatalog(true);
    },
    [refreshCatalog, warehouses, customers, documentKind, t]
  );

  // Pick up product/tier price edits after leaving the tab (throttled).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refreshCatalog();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshCatalog]);

  useEffect(() => {
    if (!openFromQuery || openBootstrapped) return;
    setOpenBootstrapped(true);
    formOpenRef.current = true;
    setActiveId(openFromQuery);
    const inList = initial.some((inv) => inv.id === openFromQuery);
    if (inList) {
      router.replace(listReturnPath, { scroll: false });
      return;
    }
    startTransition(async () => {
      const detail = await getSalesInvoiceDetailAction(openFromQuery);
      if (!detail.ok) {
        toast.error(detail.error);
        router.replace(listReturnPath, { scroll: false });
        return;
      }
      setInvoices((prev) => [detail.data, ...prev.filter((i) => i.id !== detail.data.id)]);
      setActiveId(detail.data.id);
      router.replace(listReturnPath, { scroll: false });
    });
  }, [openFromQuery, openBootstrapped, initial, router, startTransition, basePath, listReturnPath]);

  useEffect(() => {
    if (!createFromQuery || createBootstrapped || openFromQuery) return;
    setCreateBootstrapped(true);
    const nextWarehouseId =
      warehouseId || warehouses.find((w) => w.is_default)?.id || warehouses[0]?.id || "";
    if (!nextWarehouseId) {
      toast.error(t("Select a warehouse first"));
      router.replace(listReturnPath, { scroll: false });
      return;
    }
    startDraftCreate({ warehouseId: nextWarehouseId, customerId: null });
    router.replace(listReturnPath, { scroll: false });
  }, [
    createFromQuery,
    createBootstrapped,
    openFromQuery,
    warehouseId,
    warehouses,
    router,
    startDraftCreate,
    basePath,
    listReturnPath,
    t,
  ]);

  const active = useMemo(
    () => invoices.find((inv) => inv.id === activeId) ?? null,
    [invoices, activeId]
  );

  const filteredInvoices = invoices.filter((invoice) => {
    const date = invoice.document_date ?? invoice.created_at.slice(0, 10);
    if (dateRange.from && date < dateRange.from) return false;
    if (dateRange.to && date > dateRange.to) return false;
    return true;
  });
  const drafts = filteredInvoices.filter((i) => i.document_status === "draft");
  const issued = filteredInvoices.filter((i) => i.document_status === "issued");
  const delivered = filteredInvoices.filter((i) => i.document_status === "delivered");
  const sent = filteredInvoices.filter((i) => i.document_status === "sent");
  const accepted = filteredInvoices.filter((i) => i.document_status === "accepted");
  const confirmed = filteredInvoices.filter((i) => i.document_status === "confirmed");
  const invoiced = filteredInvoices.filter((i) => i.document_status === "invoiced");
  const rejected = filteredInvoices.filter((i) => i.document_status === "rejected");

  const tabs =
    documentKind === "quotation"
      ? [
          { id: "drafts", label: "Drafts", rows: drafts },
          { id: "sent", label: "Sent", rows: sent },
          { id: "accepted", label: "Accepted", rows: accepted },
          { id: "rejected", label: "Rejected", rows: rejected },
        ]
      : documentKind === "sales_order"
        ? [
            { id: "drafts", label: "Drafts", rows: drafts },
            { id: "confirmed", label: "Confirmed", rows: confirmed },
            { id: "invoiced", label: "Invoiced", rows: invoiced },
          ]
        : documentKind === "credit_note"
          ? [
              { id: "drafts", label: "Drafts", rows: drafts },
              { id: "issued", label: "Issued", rows: issued },
            ]
          : [
              { id: "drafts", label: "Drafts", rows: drafts },
              { id: "issued", label: "Issued", rows: issued },
              { id: "delivered", label: "Delivered", rows: delivered },
            ];

  function closeForm() {
    formOpenRef.current = false;
    setInvoices((prev) => prev.filter((i) => !i.id.startsWith(LOCAL_DRAFT_PREFIX)));
    setActiveId(null);
  }

  function openNewDraft() {
    if (!warehouseId) {
      toast.error(t("Select a warehouse"));
      return;
    }
    startDraftCreate({
      warehouseId,
      customerId: customerId === "__none__" ? null : customerId,
    });
  }

  function upsertInvoice(
    next: SalesInvoiceWithDetails | null,
    options?: { removedId?: string; refresh?: boolean }
  ) {
    if (next === null) {
      if (options?.removedId) {
        setInvoices((prev) => prev.filter((i) => i.id !== options.removedId));
      }
      closeForm();
      if (options?.refresh !== false) router.refresh();
      return;
    }
    setInvoices((prev) => {
      const others = prev.filter(
        (i) => i.id !== next.id && !i.id.startsWith(LOCAL_DRAFT_PREFIX)
      );
      return [next, ...others];
    });
    if (formOpenRef.current) setActiveId(next.id);
    if (options?.refresh) router.refresh();
  }

  function openInvoice(invoice: SalesInvoiceWithDetails) {
    formOpenRef.current = true;
    setActiveId(invoice.id);
    refreshCatalog(true);
  }

  function RowAction({ invoice }: { invoice: SalesInvoiceWithDetails }) {
    const draft = invoice.document_status === "draft";
    const Icon = draft ? Pencil : Eye;
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className={
          draft
            ? "border-amber-500/35 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
        }
        aria-label={t(draft ? "Edit draft" : "View document")}
        title={t(draft ? "Edit draft" : "View document")}
        onClick={() => openInvoice(invoice)}
      >
        <Icon className="size-4" />
      </Button>
    );
  }

  function InvoiceTable({ rows }: { rows: SalesInvoiceWithDetails[] }) {
    if (rows.length === 0) {
      return <EmptyStateBlock title="No documents" description={description} />;
    }
    return (
      <DataTableShell title={`${title} (${rows.length})`} scrollable={false}>
        <div className="grid gap-2 md:hidden">
          {rows.map((invoice) => (
            <MobileEntityCard
              key={invoice.id}
              title={invoice.order_number}
              subtitle={invoice.customerName ?? t("No customer")}
              badge={
                <StatusPill
                  label={statusLabels[invoice.document_status ?? "draft"]}
                  variant={statusVariant[invoice.document_status ?? "draft"]}
                />
              }
              fields={[
                {
                  label: t("Date"),
                  value: formatDateTime(
                    invoice.document_date
                      ? `${invoice.document_date}T12:00:00.000Z`
                      : invoice.created_at
                  ),
                },
                {
                  label: t("Total"),
                  value: (
                    <span className="tabular-nums font-semibold">
                      {formatCurrency(invoice.total, currency, locale)}
                    </span>
                  ),
                },
              ]}
              footer={
                <CompactActions className="w-full justify-end">
                  <RowAction invoice={invoice} />
                </CompactActions>
              }
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Document number")}</TableHead>
                <TableHead>{t("Customer")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead className="text-end">{t("Total")}</TableHead>
                <TableHead className="w-16 text-center">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer" onDoubleClick={() => openInvoice(invoice)}>
                  <TableCell className="font-semibold tabular-nums">{invoice.order_number}</TableCell>
                  <TableCell>{invoice.customerName ?? t("No customer")}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(invoice.document_date ? `${invoice.document_date}T12:00:00.000Z` : invoice.created_at)}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={statusLabels[invoice.document_status ?? "draft"]}
                      variant={statusVariant[invoice.document_status ?? "draft"]}
                    />
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">
                    {formatCurrency(invoice.total, currency, locale)}
                  </TableCell>
                  <TableCell className="text-center"><RowAction invoice={invoice} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataTableShell>
    );
  }

  function InvoiceKanban() {
    return (
      <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <section key={tab.id} className="min-w-0 rounded-[var(--mds-radius-lg)] border border-border bg-muted/35 p-2.5" aria-label={t(tab.label)}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold">{t(tab.label)}</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">{tab.rows.length}</span>
            </div>
            <div className="space-y-2">
              {tab.rows.length === 0 ? (
                <div className="rounded-[var(--mds-radius-md)] border border-dashed bg-background/60 p-4 text-center text-xs text-muted-foreground">{t("No documents")}</div>
              ) : tab.rows.map((invoice) => (
                <article key={invoice.id} className="rounded-[var(--mds-radius-md)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tabular-nums">{invoice.order_number}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{invoice.customerName ?? t("No customer")}</p>
                    </div>
                    <RowAction invoice={invoice} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">{invoice.document_date ?? invoice.created_at.slice(0, 10)}</span>
                    <span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(invoice.total, currency, locale)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (active) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          breadcrumb={<span>{t("Sales Documents")} · {t(title)}</span>}
          title={title}
          description={description}
        />
        <SalesInvoiceForm
          invoice={active}
          customers={customers}
          products={products}
          warehouses={warehouses}
          wholesaleTiersByProductId={wholesaleTiersByProductId}
          currency={currency}
          enabledPaymentMethods={enabledPaymentMethods}
          canCorrectCosts={canCorrectCosts}
          canManagePrintEngine={canManagePrintEngine}
          documentKind={documentKind}
          onClose={() => {
            closeForm();
            router.refresh();
          }}
          onChanged={(next, options) => {
            if (next === null) {
              upsertInvoice(null, {
                removedId: active.id,
                refresh: options?.refresh ?? true,
              });
              return;
            }
            upsertInvoice(next, { refresh: options?.refresh ?? false });
          }}
        />
      </div>
    );
  }

  if (activeId && !active) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          breadcrumb={<span>{t("Sales Documents")} · {t(title)}</span>}
          title={title}
          description="Opening document"
        />
        <LoadingStateBlock label="Opening invoice" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={<span>{t("Sales Documents")} · {t(title)}</span>}
        title={title}
        description={description}
        action={
          allowCreate ? (
          <div className="flex w-full flex-row flex-wrap items-end gap-2 sm:w-auto">
            <div className="space-y-1">
              <Label htmlFor="new-invoice-warehouse" className="text-xs">{t("Warehouse")}</Label>
              <Select value={warehouseId || undefined} onValueChange={(v) => setWarehouseId(v ?? "")}>
                <SelectTrigger id="new-invoice-warehouse" className="h-11 w-[min(100%,11rem)] sm:h-9 sm:w-44">
                  <SelectValue placeholder={t("Warehouse")}>
                    {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} label={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-invoice-customer" className="text-xs">{t("Customer")}</Label>
              <Select value={customerId || undefined} onValueChange={(v) => setCustomerId(v ?? "__none__")}>
                <SelectTrigger id="new-invoice-customer" className="h-11 w-[min(100%,11rem)] sm:h-9 sm:w-44">
                  <SelectValue placeholder={t("Customer")}>
                    {(value) =>
                      value === "__none__"
                        ? t("No customer")
                        : selectLabelById(customers, value, (c) => c.name)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" label={t("No customer")}>
                    {t("No customer")}
                  </SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="h-11 shrink-0 sm:h-9"
              disabled={!warehouseId}
              aria-label={t("New draft")}
              onClick={openNewDraft}
            >
              <Plus className="size-4" />
              <span className="sr-only sm:not-sr-only">{t(createLabel)}</span>
            </Button>
          </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:flex-row xl:items-center xl:justify-between">
        <DateRangeFilter
          value={dateRange}
          onChange={(next) => {
            setDateRange(next);
            updateListUrl({ from: next.from, to: next.to });
          }}
        />
        <div className="flex items-center gap-1" role="group" aria-label={t("Document view")}>
          <Button type="button" size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("table"); updateListUrl({ view: "table" }); }}>
            <List className="size-4" /> {t("Table")}
          </Button>
          <Button type="button" size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("kanban"); updateListUrl({ view: "kanban" }); }}>
            <Columns3 className="size-4" /> {t("Kanban")}
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? <InvoiceKanban /> : <Tabs value={tabs.some((tab) => tab.id === activeStatus) ? activeStatus : (tabs[0]?.id ?? "drafts")} onValueChange={(value) => { setActiveStatus(value); updateListUrl({ status: value }); }}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="min-h-10 px-2 py-2 text-xs sm:text-sm">
              {t(tab.label)} ({tab.rows.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <InvoiceTable rows={tab.rows} />
          </TabsContent>
        ))}
      </Tabs>}
    </div>
  );
}
