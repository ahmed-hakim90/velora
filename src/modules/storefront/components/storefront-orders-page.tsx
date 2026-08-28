"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Truck, UserRound } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { transitionStorefrontOrderAction } from "../actions/storefront-order-admin.actions";
import { canTransitionStorefrontOrder, STOREFRONT_ORDER_STATUSES, STOREFRONT_ORDER_STATUS_LABELS_AR, type StorefrontOrderStatus } from "../core/order-lifecycle";
import type { StorefrontAdminOrder } from "../services/storefront-order-admin.service";

const paymentLabels: Record<string, string> = { pending: "عند الاستلام", paid: "مدفوع", failed: "غير مدفوع", refunded: "مردود", partially_refunded: "مردود جزئيًا", authorized: "مفوّض" };

export function StorefrontOrdersPage({ orders }: { orders: StorefrontAdminOrder[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | StorefrontOrderStatus>("all");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => orders.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    const haystack = `${order.orderNumber} ${order.customerName} ${order.customerPhone}`.toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }), [orders, query, status]);

  function move(orderId: string, next: StorefrontOrderStatus) {
    setError("");
    startTransition(async () => {
      try { await transitionStorefrontOrderAction(orderId, next); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الطلب"); }
    });
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row">
      <label className="relative flex-1"><Search className="absolute end-3 top-3 size-5 text-muted-foreground" /><span className="sr-only">بحث</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="رقم الطلب، العميل أو الهاتف" className="h-11 w-full rounded-xl border bg-background px-4 pe-11 outline-none focus:ring-2 focus:ring-primary" /></label>
      <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 rounded-xl border bg-background px-4"><option value="all">كل الحالات</option>{STOREFRONT_ORDER_STATUSES.map((value) => <option key={value} value={value}>{STOREFRONT_ORDER_STATUS_LABELS_AR[value]}</option>)}</select>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    {!filtered.length ? <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">لا توجد طلبات متجر مطابقة.</div> : <div className="grid gap-4 xl:grid-cols-2">{filtered.map((order) => {
      const nextStatuses = STOREFRONT_ORDER_STATUSES.filter((candidate) => candidate !== order.status && canTransitionStorefrontOrder(order.status, candidate));
      const address = typeof order.shippingAddress.address === "string" ? order.shippingAddress.address : "";
      return <article key={order.id} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold text-primary">{order.orderNumber}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.placedAt))}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{STOREFRONT_ORDER_STATUS_LABELS_AR[order.status]}</span></div>
        <div className="mt-4 grid gap-2 rounded-xl bg-muted/50 p-3 text-sm"><p className="flex items-center gap-2"><UserRound className="size-4" /><strong>{order.customerName}</strong> · <span dir="ltr">{order.customerPhone}</span></p><p className="flex items-center gap-2"><Truck className="size-4" />{order.fulfillmentType === "delivery" ? address || "توصيل" : "استلام من الفرع"}</p><p>الدفع: <strong>{paymentLabels[order.paymentStatus] ?? order.paymentStatus}</strong></p></div>
        <div className="mt-4 space-y-2">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.name}{item.variantName ? ` — ${item.variantName}` : ""} × {item.quantity}</span><strong>{formatCurrency(item.lineTotal, order.currency)}</strong></div>)}</div>
        <div className="mt-4 flex items-center justify-between border-t pt-4"><span className="font-bold">الإجمالي</span><strong className="text-lg">{formatCurrency(order.grandTotal, order.currency)}</strong></div>
        {nextStatuses.length ? <div className="mt-4 flex flex-wrap gap-2">{nextStatuses.map((next) => <button key={next} disabled={pending} onClick={() => move(order.id, next)} className={next === "cancelled" ? "h-10 rounded-xl border border-destructive/40 px-4 text-sm font-bold text-destructive disabled:opacity-50" : "h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"}>{STOREFRONT_ORDER_STATUS_LABELS_AR[next]}</button>)}</div> : null}
      </article>;
    })}</div>}
  </div>;
}
