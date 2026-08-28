"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Eye, Landmark, List, Pencil, Plus, Tags, Truck, Receipt } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { DateRangeFilter, type DateRangeValue } from "@/components/Velora/date-range-filter";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { backgroundMutationKey } from "@/hooks/use-background-mutation";
import { useBackgroundMutationStore } from "@/stores/background-mutation-store";
import type { Product, PurchaseInvoice, Supplier, Warehouse } from "@/lib/types";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";
import type { SupplierPriceSummary } from "@/modules/purchases/services/price-history.service";
import { PurchaseForm } from "./purchase-form";
import { SupplierPriceHistory } from "./supplier-price-history";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PurchasesPageProps {
  purchases: PurchaseWithLines[];
  priceHistory: SupplierPriceSummary[];
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  currency: string;
  supplierDueTotal?: number;
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  basePath?: string;
  title?: string;
  description?: string;
  createLabel?: string;
  allowCreate?: boolean;
  canManagePrintEngine?: boolean;
  importsEnabled?: boolean;
}

type PurchasesTab = "drafts" | "received" | "history";

const statusVariant: Partial<
  Record<PurchaseWithLines["status"], "draft" | "success" | "danger" | "warning" | "info">
> = {
  draft: "draft",
  received: "success",
  cancelled: "danger",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  sent: "info",
  partial_invoiced: "warning",
  invoiced: "success",
  posted: "success",
};

const statusLabels: Partial<Record<PurchaseWithLines["status"], string>> = {
  draft: "Draft",
  received: "Received",
  cancelled: "Cancelled",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  partial_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  posted: "Posted",
};

function isPurchasesTab(value: string | null): value is PurchasesTab {
  return value === "drafts" || value === "received" || value === "history";
}

function sortByNewest(a: PurchaseWithLines, b: PurchaseWithLines) {
  const aAt = a.received_at ?? `${a.document_date}T12:00:00.000Z`;
  const bAt = b.received_at ?? `${b.document_date}T12:00:00.000Z`;
  return new Date(bAt).getTime() - new Date(aAt).getTime();
}

function PurchaseInvoiceCard({
  purchase,
  currency,
  receiving,
  onOpen,
  onPrintReceipt,
}: {
  purchase: PurchaseWithLines;
  currency: string;
  receiving?: boolean;
  onOpen: (id: string) => void;
  onPrintReceipt: (purchase: PurchaseWithLines) => void;
}) {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const isDraft = purchase.status === "draft";
  const isReceived = purchase.status === "received";
  const stamp =
    purchase.received_at ?? `${purchase.document_date}T12:00:00.000Z`;

  return (
    <MobileEntityCard
      title={purchase.invoice_number}
      subtitle={`${purchase.supplierName || t("No supplier")} · ${purchase.lines.length} ${t("items")}`}
      badge={
        receiving ? (
          <StatusPill label="Receiving…" variant="info" />
        ) : (
          <StatusPill
            label={statusLabels[purchase.status] ?? purchase.status}
            variant={statusVariant[purchase.status] ?? "info"}
          />
        )
      }
      fields={[
        {
          label: t("Total"),
          value: (
            <span className="tabular-nums font-semibold">
              {formatCurrency(purchase.total, currency, locale)}
            </span>
          ),
        },
        {
          label: t("Warehouse"),
          value: purchase.warehouseName,
        },
        {
          label: t("Date"),
          value: formatDateTime(stamp),
        },
        ...(isDraft && !receiving
          ? [
              {
                label: t("Note"),
                value: t("Draft — inventory is not updated yet"),
              },
            ]
          : []),
        ...(receiving
          ? [
              {
                label: t("Note"),
                value: t("Inventory is updating in the background"),
              },
            ]
          : []),
      ]}
      footer={
        <CompactActions className="w-full justify-end">
          {purchase.lines.length > 0 ? (
            <CompactAction
              label="Print"
              icon={Receipt}
              className="border-primary text-primary"
              onClick={() => onPrintReceipt(purchase)}
            />
          ) : null}
          {isReceived ? (
            <CompactAction
              label="Sales price list"
              icon={Tags}
              variant="default"
              href={`/inventory/purchases/price-list?invoice=${purchase.id}`}
            />
          ) : null}
          <CompactAction
            label={isDraft ? "Continue" : "Open"}
            icon={Pencil}
            variant={isDraft ? "default" : "outline"}
            disabled={receiving}
            onClick={() => onOpen(purchase.id)}
          />
        </CompactActions>
      }
    />
  );
}

function InvoiceList({
  items,
  currency,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onOpen,
  onPrintReceipt,
}: {
  items: PurchaseWithLines[];
  currency: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  onOpen: (id: string) => void;
  onPrintReceipt: (purchase: PurchaseWithLines) => void;
}) {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const mutations = useBackgroundMutationStore((s) => s.mutations);

  if (items.length === 0) {
    return (
      <EmptyStateBlock
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{items.length} {t("invoices")}</p>
      <div className="grid gap-2 md:hidden">
        {items.map((purchase) => {
          const key = backgroundMutationKey("purchase", "receive", purchase.id);
          const receiving = mutations[key]?.status === "pending";
          return <PurchaseInvoiceCard key={purchase.id} purchase={purchase} currency={currency} receiving={receiving} onOpen={onOpen} onPrintReceipt={onPrintReceipt} />;
        })}
      </div>
      <div className="hidden overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Document number")}</TableHead><TableHead>{t("Supplier")}</TableHead><TableHead>{t("Warehouse")}</TableHead><TableHead>{t("Date")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-end">{t("Total")}</TableHead><TableHead className="text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((purchase) => {
              const key = backgroundMutationKey("purchase", "receive", purchase.id);
              const receiving = mutations[key]?.status === "pending";
              const draft = purchase.status === "draft";
              const ActionIcon = draft ? Pencil : Eye;
              return (
                <TableRow key={purchase.id} className="cursor-pointer" onDoubleClick={() => onOpen(purchase.id)}>
                  <TableCell className="font-semibold tabular-nums">{purchase.invoice_number}</TableCell>
                  <TableCell>{purchase.supplierName || t("No supplier")}</TableCell>
                  <TableCell>{purchase.warehouseName}</TableCell>
                  <TableCell className="text-muted-foreground">{purchase.document_date}</TableCell>
                  <TableCell><StatusPill label={receiving ? "Receiving…" : (statusLabels[purchase.status] ?? purchase.status)} variant={receiving ? "info" : (statusVariant[purchase.status] ?? "info")} /></TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">{formatCurrency(purchase.total, currency, locale)}</TableCell>
                  <TableCell>
                    <CompactActions className="flex-nowrap justify-center">
                      {purchase.lines.length > 0 ? <CompactAction label="Print" icon={Receipt} className="border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300" onClick={() => onPrintReceipt(purchase)} /> : null}
                      <CompactAction label={draft ? "Edit" : "View"} icon={ActionIcon} disabled={receiving} className={draft ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-primary/30 bg-primary/10 text-primary"} onClick={() => onOpen(purchase.id)} />
                    </CompactActions>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function PurchasesPage({
  purchases,
  priceHistory,
  suppliers,
  products,
  warehouses,
  currency,
  supplierDueTotal = 0,
  documentKind = "purchase_invoice",
  basePath = "/inventory/purchases",
  title = "Purchases",
  description = "Drafts, received invoices, prices, and cancellations.",
  createLabel = "New purchase",
  allowCreate = true,
  canManagePrintEngine = false,
  importsEnabled = false,
}: PurchasesPageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const invoiceFromQuery = searchParams.get("invoice");
  const createFromQuery = searchParams.get("create") === "1";
  const [createBootstrapped, setCreateBootstrapped] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  });
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() =>
    searchParams.get("view") === "kanban" ? "kanban" : "table"
  );
  const activeEditingId = editingId ?? invoiceFromQuery;

  const listReturnPath = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invoice");
    params.delete("create");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }, [basePath, searchParams]);

  const closeForm = useCallback(() => {
    setCreating(false);
    setEditingId(null);
    if (invoiceFromQuery) router.replace(listReturnPath, { scroll: false });
    else router.refresh();
  }, [invoiceFromQuery, router, listReturnPath]);

  const startDraftCreate = useCallback(() => {
    if (documentKind !== "purchase_request" && suppliers.length === 0) {
      toast.error(t("Add a supplier first"));
      return;
    }
    if (warehouses.length === 0) {
      toast.error(t("No warehouse available — check branch settings"));
      return;
    }
    // افتح الوثيقة فورًا — المسودة تتسجل على السيرفر عند أول حفظ/صنف (مش قبل ما تشوف الفورم)
    setCreating(true);
  }, [suppliers.length, warehouses.length, documentKind, t]);

  useEffect(() => {
    if (!createFromQuery || createBootstrapped || invoiceFromQuery || !allowCreate) return;
    setCreateBootstrapped(true);
    startDraftCreate();
    router.replace(listReturnPath, { scroll: false });
  }, [
    createFromQuery,
    createBootstrapped,
    invoiceFromQuery,
    allowCreate,
    startDraftCreate,
    router,
    basePath,
    listReturnPath,
  ]);

  function openPurchaseReceipt(purchase: PurchaseWithLines) {
    setPrintPreview({
      href: `/print/purchases/${purchase.id}?embed=1`,
      title: purchase.invoice_number,
    });
  }

  const filteredPurchases = useMemo(
    () => purchases.filter((purchase) => {
      const date = purchase.document_date ?? purchase.created_at.slice(0, 10);
      if (dateRange.from && date < dateRange.from) return false;
      if (dateRange.to && date > dateRange.to) return false;
      return true;
    }),
    [purchases, dateRange]
  );
  const drafts = useMemo(
    () => filteredPurchases.filter((p) => p.status === "draft").sort(sortByNewest),
    [filteredPurchases]
  );
  const received = useMemo(
    () => filteredPurchases.filter((p) => p.status === "received").sort(sortByNewest),
    [filteredPurchases]
  );
  const submitted = useMemo(
    () => filteredPurchases.filter((p) => p.status === "submitted").sort(sortByNewest),
    [filteredPurchases]
  );
  const approved = useMemo(
    () => filteredPurchases.filter((p) => p.status === "approved").sort(sortByNewest),
    [filteredPurchases]
  );
  const sent = useMemo(
    () => filteredPurchases.filter((p) => p.status === "sent" || p.status === "partial_invoiced").sort(sortByNewest),
    [filteredPurchases]
  );
  const invoiced = useMemo(
    () => filteredPurchases.filter((p) => p.status === "invoiced").sort(sortByNewest),
    [filteredPurchases]
  );
  const posted = useMemo(
    () => filteredPurchases.filter((p) => p.status === "posted").sort(sortByNewest),
    [filteredPurchases]
  );
  const cancelled = useMemo(
    () => filteredPurchases.filter((p) => p.status === "cancelled").sort(sortByNewest),
    [filteredPurchases]
  );

  const receivedValue30d = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return received
      .filter((p) => {
        const at = p.received_at ? new Date(p.received_at) : null;
        return at != null && at >= from;
      })
      .reduce((sum, p) => sum + p.total, 0);
  }, [received]);

  const draftValue = useMemo(
    () => drafts.reduce((sum, p) => sum + p.total, 0),
    [drafts]
  );

  const tabFromQuery = searchParams.get("tab");
  const defaultTab: PurchasesTab = drafts.length > 0 ? "drafts" : "received";
  const activeTab: PurchasesTab = isPurchasesTab(tabFromQuery) ? tabFromQuery : defaultTab;

  const setTab = (tab: string | number | null) => {
    const next = typeof tab === "string" && isPurchasesTab(tab) ? tab : defaultTab;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invoice");
    if (next === defaultTab) params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${basePath}?${qs}` : basePath);
  };

  const completedRows = documentKind === "purchase_request"
    ? approved
    : documentKind === "purchase_order"
      ? sent
      : documentKind === "purchase_return"
        ? posted
        : received;
  const historyRows = documentKind === "purchase_request" ? submitted : documentKind === "purchase_order" ? invoiced : cancelled;
  const kanbanColumns = [
    { id: "drafts", label: "Drafts", rows: drafts },
    {
      id: "completed",
      label: documentKind === "purchase_request" ? "Approved" : documentKind === "purchase_order" ? "Sent" : documentKind === "purchase_return" ? "Posted" : "Received",
      rows: completedRows,
    },
    { id: "history", label: documentKind === "purchase_invoice" ? "Cancelled" : documentKind === "purchase_request" ? "Submitted" : "Invoiced", rows: historyRows },
  ];

  if (creating || activeEditingId) {
    return (
      <>
        <PageHeader
          title={activeEditingId ? title : createLabel}
          description={description}
        />
        <PurchaseForm
          suppliers={suppliers}
          products={products}
          warehouses={warehouses}
          currency={currency}
          initialInvoiceId={activeEditingId ?? undefined}
          documentKind={documentKind}
          canManagePrintEngine={canManagePrintEngine}
          importsEnabled={importsEnabled}
          onComplete={closeForm}
        />
      </>
    );
  }

  const newPurchaseButton = (
    <CompactAction
      label={createLabel}
      icon={Plus}
      variant="default"
      alwaysLabeled
      onClick={startDraftCreate}
    />
  );

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <CompactActions>
            {documentKind === "purchase_invoice" ? (
              <CompactAction
                label="Price list from products"
                icon={Tags}
                href="/inventory/purchases/price-list"
              />
            ) : null}
            <CompactAction
              label="Manage suppliers"
              icon={Truck}
              href="/inventory/suppliers"
            />
            {allowCreate ? newPurchaseButton : null}
          </CompactActions>
        }
      />

      {documentKind === "purchase_invoice" ? (
      <div className="mb-3 grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-4">
        <KpiCard
          label="Drafts"
          value={String(drafts.length)}
          change={formatCurrency(draftValue, currency, locale)}
          trend="neutral"
          icon={<Pencil className="size-5" />}
        />
        <KpiCard
          label="Received"
          value={String(received.length)}
          icon={<Receipt className="size-5" />}
        />
        <KpiCard
          label="Received value (30 days)"
          value={formatCurrency(receivedValue30d, currency, locale)}
          icon={<Truck className="size-5" />}
        />
        <KpiCard
          label="Supplier due"
          value={formatCurrency(supplierDueTotal, currency, locale)}
          change="Open suppliers for details"
          trend="neutral"
          icon={<Landmark className="size-5" />}
        />
      </div>
      ) : null}

      <div className="mb-3 flex flex-col gap-2 rounded-[var(--mds-radius-md)] border border-border bg-card p-2 xl:flex-row xl:items-center xl:justify-between">
        <DateRangeFilter
          value={dateRange}
          onChange={(next) => {
            setDateRange(next);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("invoice");
            params.delete("create");
            if (next.from) params.set("from", next.from); else params.delete("from");
            if (next.to) params.set("to", next.to); else params.delete("to");
            const query = params.toString();
            window.history.replaceState(null, "", query ? `${basePath}?${query}` : basePath);
          }}
        />
        <div className="flex items-center gap-1" role="group" aria-label={t("Purchase view")}>
          <Button type="button" size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("table"); const params = new URLSearchParams(searchParams.toString()); params.set("view", "table"); window.history.replaceState(null, "", `${basePath}?${params.toString()}`); }}><List className="size-4" /> {t("Table")}</Button>
          <Button type="button" size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => { setViewMode("kanban"); const params = new URLSearchParams(searchParams.toString()); params.set("view", "kanban"); window.history.replaceState(null, "", `${basePath}?${params.toString()}`); }}><Columns3 className="size-4" /> {t("Kanban")}</Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid auto-cols-[minmax(18rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3">
          {kanbanColumns.map((column) => (
            <section key={column.id} className="rounded-[var(--mds-radius-lg)] border border-border bg-muted/35 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-semibold">{t(column.label)}</h2><span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">{column.rows.length}</span></div>
              <div className="space-y-2">
                {column.rows.length === 0 ? <div className="rounded-[var(--mds-radius-md)] border border-dashed bg-background/60 p-4 text-center text-xs text-muted-foreground">{t("No documents")}</div> : column.rows.map((purchase) => {
                  const draft = purchase.status === "draft";
                  const ActionIcon = draft ? Pencil : Eye;
                  return <article key={purchase.id} className="rounded-[var(--mds-radius-md)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold tabular-nums">{purchase.invoice_number}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{purchase.supplierName || t("No supplier")}</p></div><CompactAction label={draft ? "Edit" : "View"} icon={ActionIcon} className={draft ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-primary/30 bg-primary/10 text-primary"} onClick={() => setEditingId(purchase.id)} /></div><div className="mt-3 flex items-end justify-between gap-2 border-t border-border pt-2"><span className="text-xs text-muted-foreground">{purchase.document_date}</span><span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(purchase.total, currency, locale)}</span></div></article>;
                })}
              </div>
            </section>
          ))}
        </div>
      ) : <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
        <TabsList
          variant="default"
          className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit"
        >
          <TabsTrigger value="drafts" className="min-h-10 px-3 py-2">
            {t("Drafts")}
            {drafts.length > 0 ? (
              <span className="ms-1.5 tabular-nums text-muted-foreground">
                ({drafts.length})
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="received" className="min-h-10 px-3 py-2">
            {documentKind === "purchase_request"
              ? t("Approved")
              : documentKind === "purchase_order"
                ? t("Sent")
                : documentKind === "purchase_return"
                  ? t("Posted")
                  : t("Received")}
            {(documentKind === "purchase_request"
              ? approved.length
              : documentKind === "purchase_order"
                ? sent.length
                : documentKind === "purchase_return"
                  ? posted.length
                  : received.length) > 0 ? (
              <span className="ms-1.5 tabular-nums text-muted-foreground">
                (
                {documentKind === "purchase_request"
                  ? approved.length
                  : documentKind === "purchase_order"
                    ? sent.length
                    : documentKind === "purchase_return"
                      ? posted.length
                      : received.length}
                )
              </span>
            ) : null}
          </TabsTrigger>
          {documentKind === "purchase_invoice" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            {t("History")}
          </TabsTrigger>
          ) : documentKind === "purchase_request" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            {t("Submitted")} ({submitted.length})
          </TabsTrigger>
          ) : documentKind === "purchase_order" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            {t("Invoiced")} ({invoiced.length})
          </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="drafts" className="mt-0">
          <InvoiceList
            items={drafts}
            currency={currency}
            emptyTitle="No draft invoices"
            emptyDescription="Start a new purchase, add items, then receive it to update inventory."
            emptyAction={newPurchaseButton}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
        </TabsContent>

        <TabsContent value="received" className="mt-0">
          <InvoiceList
            items={
              documentKind === "purchase_request"
                ? approved
                : documentKind === "purchase_order"
                  ? sent
                  : documentKind === "purchase_return"
                    ? posted
                    : received
            }
            currency={currency}
            emptyTitle="No documents"
            emptyDescription={description}
            emptyAction={allowCreate ? newPurchaseButton : undefined}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {documentKind === "purchase_invoice" ? (
          <div className="grid gap-4 pb-4">
            <SupplierPriceHistory history={priceHistory} currency={currency} />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("Cancelled or reopened invoices")}
              </h3>
              <InvoiceList
                items={cancelled}
                currency={currency}
                emptyTitle="No cancellation history"
                emptyDescription="Cancelled invoices appear here. Supplier price history is above."
                onOpen={setEditingId}
                onPrintReceipt={openPurchaseReceipt}
              />
            </div>
          </div>
          ) : (
          <InvoiceList
            items={documentKind === "purchase_request" ? submitted : invoiced}
            currency={currency}
            emptyTitle="No documents"
            emptyDescription={description}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
          )}
        </TabsContent>
      </Tabs>}

      <DocumentPrintPreviewModal
        open={Boolean(printPreview)}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
        href={printPreview?.href ?? null}
        title={printPreview?.title}
      />
    </>
  );
}
