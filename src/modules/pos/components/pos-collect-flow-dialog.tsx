"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Banknote, CreditCard, Search, Wallet, X } from "lucide-react";
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
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { roundMoney } from "@/lib/money";
import type { PaymentMethod } from "@/lib/types";
import {
  listOutstandingCustomersAction,
} from "@/modules/customers/actions/customer.actions";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import { usePosStore } from "@/stores/pos-store";
import { cn } from "@/lib/utils";
import { firstGrapheme } from "@/lib/first-grapheme";
import { useTranslation } from "@/lib/i18n/use-translation";

async function postPosCustomerPayment(input: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const res = await fetch("/api/pos/customer-payment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || "Could not record collection" };
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

type CollectCustomer = {
  id: string;
  name: string;
  phone: string;
  account_balance: number;
};

interface PosCollectFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toCollectCustomer(customer: {
  id: string;
  name: string;
  phone: string;
  account_balance: number;
}): CollectCustomer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    account_balance: customer.account_balance,
  };
}

export function PosCollectFlowDialog({ open, onOpenChange }: PosCollectFlowDialogProps) {
  const { t } = useTranslation();
  const cartCustomer = usePosStore((s) => s.customer);
  const setCartCustomer = usePosStore((s) => s.setCustomer);
  const [pending, startTransition] = useTransition();
  const [loadingList, startListTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [outstanding, setOutstanding] = useState<CollectCustomer[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState<CollectCustomer | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");
  const [reference, setReference] = useState("");

  function resetForm(customer: CollectCustomer | null = null) {
    setSelected(customer);
    setAmount(
      customer && customer.account_balance > 0
        ? String(roundMoney(customer.account_balance))
        : ""
    );
    setMethod("cash");
    setReference("");
  }

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setListError(null);
      const preselect =
        cartCustomer && cartCustomer.account_balance > 0
          ? toCollectCustomer(cartCustomer)
          : null;
      resetForm(preselect);
    }
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    startListTransition(async () => {
      try {
        const rows = await listOutstandingCustomersAction();
        if (!cancelled) {
          setOutstanding(rows.map(toCollectCustomer));
          setListError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message = t(
            error instanceof Error ? error.message : "Could not load customers with balances"
          );
          toast.error(message);
          setListError(message);
          setOutstanding([]);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, open, t]);

  const list = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return outstanding;
    const digits = trimmed.replace(/\D/g, "");
    return outstanding.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(trimmed);
      const phoneMatch =
        c.phone.toLowerCase().includes(trimmed) ||
        (digits.length >= 2 && c.phone.replace(/\D/g, "").includes(digits));
      return nameMatch || phoneMatch;
    });
  }, [outstanding, query]);

  const owed = selected?.account_balance ?? 0;
  const value = Number(amount);
  const canSubmit =
    Boolean(selected) &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= owed + 0.001 &&
    !pending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      resetForm(null);
    }
    onOpenChange(next);
  }

  function handleCollect() {
    if (!selected || !canSubmit) return;
    startTransition(async () => {
      try {
        const paidAmount = roundMoney(value);
        const result = await postPosCustomerPayment({
          customerId: selected.id,
          amount: paidAmount,
          paymentMethod: method,
          reference: reference.trim() || undefined,
        });
        if (!result.success) {
          playPosErrorSound();
          toast.error(result.error);
          return;
        }
        const nextBalance = Math.max(0, roundMoney(owed - paidAmount));
        toast.success(`${t("Collected")} ${formatCurrency(paidAmount)} ${t("from")} ${selected.name}`);
        playPosSuccessSound();
        if (cartCustomer?.id === selected.id) {
          setCartCustomer({ ...cartCustomer, account_balance: nextBalance });
        }
        handleOpenChange(false);
      } catch (error) {
        playPosErrorSound();
        toast.error(t(error instanceof Error ? error.message : "Could not record collection"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[94dvh] max-w-lg overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-3 py-2.5 pe-10 text-start sm:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Banknote className="size-4" /></div>
            <div className="min-w-0"><DialogTitle className="text-base">{selected ? t("Collect from customer") : t("Collect balances")}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {selected
              ? `${selected.name} · ${t("Due")} ${formatCurrency(owed)}`
              : t("Choose a customer with a balance or search by name or phone")}
          </DialogDescription></div></div>
        </DialogHeader>

        <div className="max-h-[min(76dvh,620px)] space-y-2.5 overflow-y-auto px-3 py-3">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search by name or phone…")}
                  aria-label={t("Search customer to collect")}
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
                <LoadingStateBlock label={t("Loading…")} className="border-0 shadow-none" />
              ) : listError ? (
                <ErrorStateBlock
                  title={t("Could not load customer balances")}
                  description={listError}
                  retryLabel={t("Try again")}
                  onRetry={() => {
                    setListError(null);
                    setLoadAttempt((current) => current + 1);
                  }}
                  className="border-0 px-3 py-4 shadow-none"
                />
              ) : list.length === 0 ? (
                <EmptyStateBlock
                  title={
                    query.trim()
                      ? t("No customer balance matches your search")
                      : t("No balances due")
                  }
                  description={
                    query.trim()
                      ? t("Try a different name or phone number.")
                      : t("Customers with balances will appear here.")
                  }
                  className="border-0 bg-transparent py-4 shadow-none"
                />
              ) : (
                <ul className="space-y-1.5">
                  {list.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-start transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={() => resetForm(customer)}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                          {firstGrapheme(customer.name, "؟")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{customer.name}</p>
                          <p className="truncate text-xs text-muted-foreground" dir="ltr">
                            {customer.phone}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                          {formatCurrency(customer.account_balance)}
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
                {t("Change customer")}
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {firstGrapheme(selected.name, "؟")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {selected.phone}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {t("Due")} {formatCurrency(owed)}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
                <Label className="text-xs" htmlFor="pos-collect-amount">{t("Amount")}</Label>
                <Input
                  id="pos-collect-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-lg text-end text-sm font-semibold tabular-nums"
                  autoFocus
                />
                {value > owed + 0.001 ? (
                  <p className="col-span-2 text-xs text-destructive" role="alert">{t("Amount exceeds balance")}</p>
                ) : amount.trim() && (!Number.isFinite(value) || value <= 0) ? (
                  <p className="col-span-2 text-xs text-destructive" role="alert">{t("Enter a value greater than zero")}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("Collection method")}</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-collect-ref">{t("Reference (optional)")}</Label>
                <Input
                  id="pos-collect-ref"
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
          <DialogFooter className="mx-0 mb-0 border-t border-border/70 px-3 py-2.5">
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
              onClick={handleCollect}
            >
              {pending ? t("Collecting…") : t("Confirm collection")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
