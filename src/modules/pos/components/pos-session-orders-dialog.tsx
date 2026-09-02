"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getPosSessionOrderAction,
  listPosSessionOrdersAction,
  type PosSessionOrderSummary,
} from "@/modules/pos/actions/session-orders.actions";
import { PosReceiptSuccessDialog } from "@/modules/pos/components/pos-receipt-success-dialog";
import type { ReceiptPayload } from "@/modules/pos/services/receipt-format.service";
import { buildReceiptPayloadFromOrder } from "@/modules/pos/utils/receipt-payload";
import type { ReportBranding } from "@/modules/reports/core/report-context";

interface PosSessionOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branding: ReportBranding;
  refreshKey: number;
  onUsbPrint: (receipt: ReceiptPayload) => void | Promise<void>;
  onBrowserPrint: (receipt: ReceiptPayload) => void | Promise<void>;
  onWhatsApp: (
    receipt: ReceiptPayload,
    phoneOverride?: string,
  ) => void | Promise<void>;
}

export function PosSessionOrdersDialog({
  open,
  onOpenChange,
  branding,
  refreshKey,
  onUsbPrint,
  onBrowserPrint,
  onWhatsApp,
}: PosSessionOrdersDialogProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PosSessionOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [query, setQuery] = useState("");
  const [loadedRefreshKey, setLoadedRefreshKey] = useState<number | null>(null);
  const receiptCacheRef = useRef(new Map<string, ReceiptPayload>());

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return orders;
    const queryDigits = normalizedQuery.replace(/\D/g, "");
    return orders.filter((order) => {
      const phoneDigits = order.customerPhone?.replace(/\D/g, "") ?? "";
      return (
        order.orderNumber.toLocaleLowerCase().includes(normalizedQuery) ||
        order.customerName?.toLocaleLowerCase().includes(normalizedQuery) ||
        (queryDigits.length >= 3 && phoneDigits.includes(queryDigits))
      );
    });
  }, [orders, query]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listPosSessionOrdersAction());
      receiptCacheRef.current.clear();
      setLoadedRefreshKey(refreshKey);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Could not load session invoices"),
      );
    } finally {
      setLoading(false);
    }
  }, [refreshKey, t]);

  useEffect(() => {
    if (!open) return;
    if (loadedRefreshKey !== refreshKey) void loadOrders();
  }, [loadOrders, loadedRefreshKey, open, refreshKey]);

  async function openOrder(orderId: string) {
    const cachedReceipt = receiptCacheRef.current.get(orderId);
    if (cachedReceipt) {
      setReceipt(cachedReceipt);
      return;
    }
    setOpeningId(orderId);
    setError(null);
    try {
      const order = await getPosSessionOrderAction(orderId);
      const nextReceipt = buildReceiptPayloadFromOrder(order, branding);
      receiptCacheRef.current.set(orderId, nextReceipt);
      setReceipt(nextReceipt);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Could not open invoice"),
      );
    } finally {
      setOpeningId(null);
    }
  }

  function handleListOpenChange(nextOpen: boolean) {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog open={open && !receipt} onOpenChange={handleListOpenChange}>
        <DialogContent className="flex max-h-[min(92dvh,44rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)]">
          <DialogHeader className="border-b border-border/70 px-4 py-3 text-start">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="size-5 text-primary" aria-hidden />
              {t("Session invoices")}
            </DialogTitle>
            <DialogDescription>
              {t("Open and print any invoice from the active session")}
            </DialogDescription>
          </DialogHeader>

          {!loading && !error && orders.length > 0 ? (
            <div className="space-y-2 border-b border-border/70 px-3 py-2.5">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("Search by invoice, customer, or phone")}
                    aria-label={t("Search session invoices")}
                    className="h-11 ps-9"
                    inputMode="search"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  onClick={() => void loadOrders()}
                  disabled={loading}
                  aria-label={t("Refresh session invoices")}
                  title={t("Refresh session invoices")}
                >
                  <RefreshCw
                    className={loading ? "size-4 animate-spin" : "size-4"}
                    aria-hidden
                  />
                </Button>
              </div>
              <p
                className="px-1 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {query.trim()
                  ? `${filteredOrders.length} ${t("matching invoices")}`
                  : `${orders.length} ${t("invoices in this session")}`}
              </p>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
            {loading ? (
              <div
                className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-5 animate-spin" aria-hidden />
                {t("Loading session invoices…")}
              </div>
            ) : error ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                <AlertCircle className="size-6 text-destructive" aria-hidden />
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => void loadOrders()}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {t("Retry")}
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-muted-foreground">
                <ReceiptText className="size-7" aria-hidden />
                <p className="text-sm font-medium">
                  {t("No invoices in this session yet")}
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-muted-foreground">
                <Search className="size-7" aria-hidden />
                <p className="text-sm font-medium">
                  {t("No matching invoices")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((order) => {
                  const opening = openingId === order.id;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-start transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void openOrder(order.id)}
                      disabled={Boolean(openingId)}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {opening ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <Printer className="size-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-sm font-bold [unicode-bidi:isolate]"
                          dir="auto"
                        >
                          {order.orderNumber}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(order.createdAt)}
                        </span>
                        {order.customerName ||
                        order.paymentMethods.length > 0 ? (
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            {order.customerName ? (
                              <span className="max-w-40 truncate" dir="auto">
                                {order.customerName}
                                {order.customerPhone
                                  ? ` · ${order.customerPhone}`
                                  : ""}
                              </span>
                            ) : null}
                            {order.paymentMethods.length > 0 ? (
                              <span className="font-medium">
                                {order.paymentMethods
                                  .map((method) => t(method))
                                  .join(" + ")}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {order.status !== "completed" ||
                        order.paymentStatus !== "paid" ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {order.status !== "completed" ? (
                              <Badge variant="destructive" className="h-5">
                                {t(order.status)}
                              </Badge>
                            ) : null}
                            {order.paymentStatus !== "paid" ? (
                              <Badge variant="outline" className="h-5">
                                {t(order.paymentStatus)}
                              </Badge>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="shrink-0 text-sm font-bold tabular-nums [unicode-bidi:isolate]"
                        dir="auto"
                      >
                        {formatCurrency(order.total, branding.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {receipt ? (
        <PosReceiptSuccessDialog
          mode="history"
          open={Boolean(receipt)}
          receipt={receipt}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setReceipt(null);
          }}
          onUsbPrint={() => onUsbPrint(receipt)}
          onBrowserPrint={() => onBrowserPrint(receipt)}
          onWhatsApp={(phoneOverride) => onWhatsApp(receipt, phoneOverride)}
        />
      ) : null}
    </>
  );
}
