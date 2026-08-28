"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, UserCircle, Wallet } from "lucide-react";
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
import type { Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

const PAY_NOW_METHODS: {
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

export type CreditCheckoutConfirm = {
  payments: PaymentSplit[];
  /** Extra cash/card applied to existing account debt (not part of this invoice). */
  accountCollection: number;
};

interface PosCreditCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  customer: Customer | null;
  enabledMethods: PaymentMethod[];
  loading?: boolean;
  onConfirm: (result: CreditCheckoutConfirm) => void;
}

export function PosCreditCheckoutDialog({
  open,
  onOpenChange,
  total,
  customer,
  enabledMethods,
  loading = false,
  onConfirm,
}: PosCreditCheckoutDialogProps) {
  const { t } = useTranslation();
  const [payNow, setPayNow] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");

  const availablePayMethods = useMemo(
    () => PAY_NOW_METHODS.filter((method) => enabledMethods.includes(method.id)),
    [enabledMethods]
  );

  const owed = customer?.account_balance ?? 0;
  const maxPayableNow = Math.round((total + Math.max(0, owed)) * 100) / 100;

  useEffect(() => {
    if (!open) return;

    setPayNow(false);
    setAmountPaid("");
    setPayMethod(availablePayMethods[0]?.id ?? "cash");
  }, [availablePayMethods, open]);

  const paidValue = Number(amountPaid);
  const paid = payNow && Number.isFinite(paidValue) ? Math.max(0, paidValue) : 0;
  const paidRounded = Math.round(paid * 100) / 100;
  const invoiceCovered = Math.min(paidRounded, total);
  const creditRemainder = Math.round(Math.max(0, total - invoiceCovered) * 100) / 100;
  const accountCollection = Math.round(Math.max(0, paidRounded - total) * 100) / 100;
  const amountTooHigh = payNow && paidRounded > maxPayableNow + 0.001;
  const amountInvalid = payNow && (!Number.isFinite(paidValue) || paidValue < 0);
  const balanceAfter =
    Math.round((Math.max(0, owed) - accountCollection + creditRemainder) * 100) / 100;

  const canSubmit =
    Boolean(customer) &&
    total > 0 &&
    !loading &&
    !amountTooHigh &&
    !amountInvalid &&
    (!payNow || paidRounded > 0);

  function handleConfirm() {
    if (!canSubmit || !customer) return;

    if (!payNow || paidRounded <= 0) {
      onConfirm({
        payments: [{ method: "credit", amount: total }],
        accountCollection: 0,
      });
      return;
    }

    if (creditRemainder > 0.001) {
      onConfirm({
        payments: [
          { method: payMethod, amount: invoiceCovered },
          { method: "credit", amount: creditRemainder },
        ],
        accountCollection: 0,
      });
      return;
    }

    // Fully covers invoice; any surplus is collected against account debt.
    onConfirm({
      payments: [{ method: payMethod, amount: total }],
      accountCollection,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94dvh,100%)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-3 py-2.5 pe-10 text-start sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200"><UserCircle className="size-4" /></div><div className="min-w-0"><DialogTitle className="text-base">{t("Credit sale")}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {customer
              ? `${customer.name} · ${t("Invoice total")} ${formatCurrency(total)}`
              : t("Attach a customer first to complete a credit sale")}
          </DialogDescription></div></div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2.5 sm:p-3">
        {customer ? (
          <div className="space-y-2">
            {owed > 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {t("Current account balance")}: {formatCurrency(owed)}
              </p>
            ) : null}
            {typeof customer.credit_limit === "number" && customer.credit_limit > 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                {t("Credit limit")} {formatCurrency(customer.credit_limit)} · {t("Available about")}{" "}
                {formatCurrency(Math.max(0, customer.credit_limit - owed))}
                {total > Math.max(0, customer.credit_limit - owed) + 0.001
                  ? ` — ${t("This invoice may exceed the credit limit")}`
                  : null}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPayNow(false);
                  setAmountPaid("");
                }}
                className={cn(
                  "min-h-14 rounded-xl border-2 px-2.5 py-2 text-start transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  !payNow
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-500/15"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-sm font-semibold">{t("Pay later")}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {t("Charge the full amount to the account")} ({formatCurrency(total)})
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPayNow(true)}
                className={cn(
                  "min-h-14 rounded-xl border-2 px-2.5 py-2 text-start transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  payNow
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-sm font-semibold">{t("Pay now")}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {t("Pay part or more; any extra reduces the old balance")}
                </p>
              </button>
            </div>

            {payNow ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2">
                  <Label className="text-xs" htmlFor="credit-pay-now-amount">{t("Amount paid now")}</Label>
                  <Input
                    id="credit-pay-now-amount"
                    type="number"
                    min={0}
                    max={maxPayableNow}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-11 rounded-lg text-end text-sm font-semibold tabular-nums"
                    autoFocus
                    placeholder="0.00"
                  />
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    {t("Maximum")}: {formatCurrency(maxPayableNow)}
                    {owed > 0 ? ` (${t("invoice + balance")})` : ""}
                  </p>
                  {amountTooHigh ? (
                    <p className="col-span-2 text-xs text-destructive">
                      {t("Amount exceeds the invoice and account balance")}
                    </p>
                  ) : null}
                  {accountCollection > 0.001 ? (
                    <p className="col-span-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(accountCollection)} {t("will reduce the old balance")}
                    </p>
                  ) : null}
                </div>
                {availablePayMethods.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("Payment method")}</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {availablePayMethods.map(({ id, label, icon: Icon, className }) => (
                        <button
                          key={id}
                          type="button"
                          data-selected={payMethod === id}
                          onClick={() => setPayMethod(id)}
                          className={cn(
                            "flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                            className
                          )}
                        >
                          <Icon className="size-4" />
                          {t(label)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/60 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("Invoice total")}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("Pay now")}</span>
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(paidRounded)}
                </span>
              </div>
              {accountCollection > 0.001 ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("Reduces old balance")}</span>
                  <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    -{formatCurrency(accountCollection)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 border-t border-amber-200/70 pt-2 dark:border-amber-500/20">
                <span className="font-medium">{t("Invoice credit remainder")}</span>
                <span className="font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {formatCurrency(creditRemainder)}
                </span>
              </div>
              {owed > 0 || creditRemainder > 0 || accountCollection > 0 ? (
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t("Balance after transaction")}</span>
                  <span className="tabular-nums">{formatCurrency(balanceAfter)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t("Attach a customer from the cart, then choose credit sale.")}
          </div>
        )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 grid grid-cols-2 gap-1.5 border-t border-border/60 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-lg font-semibold"
            disabled={!canSubmit}
            onClick={handleConfirm}
          >
            {loading ? t("Saving…") : t("Confirm credit sale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
