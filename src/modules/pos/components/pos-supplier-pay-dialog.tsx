"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Banknote, CreditCard, Search, Truck, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { roundMoney } from "@/lib/money";
import type { PaymentMethod } from "@/lib/types";
import { listSuppliersForPosPaymentAction } from "@/modules/suppliers/actions/supplier.actions";
import { TreasuryPicker } from "@/modules/treasury/components/treasury-picker";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import { cn } from "@/lib/utils";
import { firstGrapheme } from "@/lib/first-grapheme";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ErrorStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";

async function postPosSupplierPayment(input: {
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  cashSource?: "drawer" | "treasury";
  treasuryId?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const res = await fetch("/api/pos/supplier-payment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || "Could not record supplier payment" };
  }
  return { success: true };
}

const METHOD_META: {
  id: Exclude<PaymentMethod, "credit">;
  label: string;
  icon: typeof Banknote;
  className: string;
}[] = [
  {
    id: "cash",
    label: "Cash",
    icon: Banknote,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 data-[selected=true]:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  {
    id: "card",
    label: "Card",
    icon: CreditCard,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 data-[selected=true]:border-sky-500 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 data-[selected=true]:border-violet-500 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  },
  {
    id: "other",
    label: "Other",
    icon: Banknote,
    className:
      "border-slate-200 bg-slate-50 text-slate-800 data-[selected=true]:border-slate-500 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
  },
];

type PaySupplier = {
  id: string;
  name: string;
  balanceDue: number;
};

interface PosSupplierPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
}

export function PosSupplierPayDialog({ open, onOpenChange, storeId }: PosSupplierPayDialogProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [loadingList, startListTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState<PaySupplier[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState<PaySupplier | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");
  const [reference, setReference] = useState("");
  const [cashSource, setCashSource] = useState<"drawer" | "treasury">("drawer");
  const [treasuryId, setTreasuryId] = useState("");

  function resetForm(supplier: PaySupplier | null = null) {
    setSelected(supplier);
    setAmount(
      supplier && supplier.balanceDue > 0
        ? String(roundMoney(supplier.balanceDue))
        : ""
    );
    setMethod("cash");
    setReference("");
    setCashSource("drawer");
    setTreasuryId("");
  }

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setListError(null);
    setSelected(null);
    setAmount("");
    setMethod("cash");
    setReference("");
    setCashSource("drawer");
    setTreasuryId("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    startListTransition(async () => {
      try {
        const rows = await listSuppliersForPosPaymentAction();
        if (!cancelled) {
          setSuppliers(rows);
          setListError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message = t(error instanceof Error ? error.message : "Could not load suppliers");
          toast.error(message);
          setListError(message);
          setSuppliers([]);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, open, t]);

  const list = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(trimmed));
  }, [suppliers, query]);

  const balanceDue = selected?.balanceDue ?? 0;
  const value = Number(amount);
  const canSubmit =
    Boolean(selected) &&
    Number.isFinite(value) &&
    value > 0 &&
    (method !== "cash" || cashSource === "drawer" || Boolean(treasuryId)) &&
    !pending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      resetForm(null);
    }
    onOpenChange(next);
  }

  function handlePay() {
    if (!selected || !canSubmit) return;
    startTransition(async () => {
      try {
        const paidAmount = roundMoney(value);
        const result = await postPosSupplierPayment({
          supplierId: selected.id,
          amount: paidAmount,
          paymentMethod: method,
          reference: reference.trim() || undefined,
          cashSource: method === "cash" ? cashSource : undefined,
          treasuryId:
            method === "cash" && cashSource === "treasury" ? treasuryId : undefined,
        });
        if (!result.success) {
          playPosErrorSound();
          toast.error(result.error);
          return;
        }
        toast.success(`${t("Payment recorded")} ${formatCurrency(paidAmount)} · ${selected.name}`);
        playPosSuccessSound();
        handleOpenChange(false);
      } catch (error) {
        playPosErrorSound();
        toast.error(t(error instanceof Error ? error.message : "Could not record supplier payment"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(94dvh,100%)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/70 px-3 py-2.5 pe-10 text-start sm:py-3">
          <div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200"><Truck className="size-4" /></div><div className="min-w-0">
          <DialogTitle className="text-base">{selected ? t("Supplier payment") : t("Supplier payments")}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {selected
              ? `${selected.name} · ${t("Balance")} ${formatCurrency(balanceDue)}`
              : t("Choose a supplier and record a payment. It will reconcile with the invoice later.")}
          </DialogDescription></div></div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-y-contain px-3 py-3">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search suppliers…")}
                  aria-label={t("Search suppliers")}
                  className="h-11 rounded-xl ps-10 pe-11"
                  autoFocus
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => setQuery("")}
                    aria-label={t("Clear search")}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              {loadingList && list.length === 0 ? (
                <LoadingStateBlock label={t("Loading…")} className="border-0 px-3 py-4 shadow-none" />
              ) : listError ? (
                <ErrorStateBlock
                  title={t("Could not load suppliers")}
                  description={listError}
                  retryLabel={t("Try again")}
                  onRetry={() => {
                    setListError(null);
                    setLoadAttempt((current) => current + 1);
                  }}
                  className="border-0 px-3 py-4 shadow-none"
                />
              ) : list.length === 0 ? (
                <p className="py-5 text-center text-xs text-muted-foreground">
                  {query.trim() ? t("No supplier matches your search") : t("No suppliers")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((supplier) => (
                    <li key={supplier.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-start transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={() => resetForm(supplier)}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                          {firstGrapheme(supplier.name, "؟")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{supplier.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {supplier.balanceDue > 0
                              ? `${t("Due")} ${formatCurrency(supplier.balanceDue)}`
                              : supplier.balanceDue < 0
                                ? `${t("Advance")} ${formatCurrency(Math.abs(supplier.balanceDue))}`
                                : t("Zero balance")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                            supplier.balanceDue > 0
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {formatCurrency(supplier.balanceDue)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onClick={() => resetForm(null)}
              >
                <ArrowRight className="size-4 ltr:rotate-180" />
                {t("Change supplier")}
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {firstGrapheme(selected.name, "؟")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("Current balance")} {formatCurrency(balanceDue)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
                <Label className="text-xs" htmlFor="pos-supplier-pay-amount">{t("Amount")}</Label>
                <Input
                  id="pos-supplier-pay-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-lg text-end text-sm font-semibold tabular-nums"
                  autoFocus
                />
                <p className="col-span-2 text-xs text-muted-foreground">
                  {t("You can pay before the invoice; the balance updates when purchases are received.")}
                </p>
                {amount.trim() && (!Number.isFinite(value) || value <= 0) ? (
                  <p className="col-span-2 text-xs text-destructive" role="alert">
                    {t("Enter a value greater than zero")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("Payment method")}</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {METHOD_META.filter((m) => PAYMENT_METHODS.includes(m.id)).map(
                    ({ id, label, icon: Icon, className }) => (
                      <button
                        key={id}
                        type="button"
                        aria-label={t(label)}
                        data-selected={method === id}
                        onClick={() => setMethod(id)}
                        className={cn(
                          "flex h-11 flex-col items-center justify-center gap-0 rounded-lg border px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:flex-row sm:gap-1 sm:text-xs",
                          className
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="truncate">{t(label)}</span>
                      </button>
                    )
                  )}
                </div>
                {method === "cash" ? (
                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                    <Label className="text-xs">{t("Cash source")}</Label>
                    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t("Cash source")}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={cashSource === "drawer"}
                        data-selected={cashSource === "drawer"}
                        onClick={() => setCashSource("drawer")}
                        className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
                      >
                        {t("Session drawer")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={cashSource === "treasury"}
                        disabled={!storeId}
                        data-selected={cashSource === "treasury"}
                        onClick={() => setCashSource("treasury")}
                        className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("Store treasury")}
                      </button>
                    </div>
                    {cashSource === "drawer" ? (
                      <p className="text-xs text-muted-foreground">
                        {t("This will reduce the expected drawer balance at session close.")}
                      </p>
                    ) : storeId ? (
                      <TreasuryPicker
                        value={treasuryId}
                        onChange={setTreasuryId}
                        preferredStoreId={storeId}
                        includeHq={false}
                        label={t("Choose store treasury")}
                      />
                    ) : (
                      <p className="text-xs text-destructive">
                        {t("Could not identify the current store. Use the session drawer or reopen this screen.")}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-supplier-pay-ref">{t("Reference (optional)")}</Label>
                <Input
                  id="pos-supplier-pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder={t("Receipt number / note")}
                />
              </div>
            </>
          )}
        </div>

        {selected ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border/70 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg"
              onClick={() => handleOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-lg font-semibold"
              disabled={!canSubmit}
              onClick={handlePay}
            >
              {pending ? t("Recording…") : t("Confirm payment")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
