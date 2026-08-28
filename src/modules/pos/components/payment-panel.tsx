"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, Plus, Star, Trash2, UserCircle, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, PaymentSplit } from "@/lib/types";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import { roundMoney } from "@/lib/money";

interface PaymentPanelProps {
  open: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentSplit[]) => void;
  enabledMethods: PaymentMethod[];
  customerName?: string | null;
  loading?: boolean;
  disabled?: boolean;
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
  /** Use a fixed total instead of the POS cart (e.g. online order checkout). */
  fixedTotal?: number | null;
  /**
   * When true, credit is allowed without a POS-attached customer
   * (online order with a phone that can resolve to a customer account).
   */
  creditCustomerLinked?: boolean;
}

export function PaymentPanel({
  open,
  onClose,
  onComplete,
  enabledMethods,
  customerName,
  loading,
  disabled,
  loyaltyRedemptionRate = null,
  minimumLoyaltyRedeemPoints = 0,
  fixedTotal = null,
  creditCustomerLinked = false,
}: PaymentPanelProps) {
  const { t } = useTranslation();
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const setLoyaltyRedemption = usePosStore((s) => s.setLoyaltyRedemption);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
  const setPaymentSplits = usePosStore((s) => s.setPaymentSplits);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const useFixedTotal = fixedTotal !== null && fixedTotal !== undefined;
  const subtotal = useFixedTotal ? fixedTotal : getCartSubtotal(cart);
  const totalBeforeRedemption = useFixedTotal ? fixedTotal : getCartTotal(cart, discountAmount);
  const redemptionAmount = useFixedTotal ? 0 : loyaltyRedemption?.amount ?? 0;
  const total = Math.max(0, totalBeforeRedemption - redemptionAmount);

  const loyaltyAvailable =
    !useFixedTotal &&
    Boolean(customer) &&
    loyaltyRedemptionRate !== null &&
    loyaltyRedemptionRate > 0 &&
    (loyaltyBalance ?? 0) > 0;
  const maxRedeemablePoints = loyaltyAvailable
    ? Math.min(
        loyaltyBalance ?? 0,
        Math.floor(totalBeforeRedemption / (loyaltyRedemptionRate as number))
      )
    : 0;
  const canRedeemLoyalty =
    loyaltyAvailable &&
    maxRedeemablePoints > 0 &&
    maxRedeemablePoints >= minimumLoyaltyRedeemPoints;

  function applyRedemption(points: number) {
    const safePoints = Math.max(0, Math.min(Math.floor(points), maxRedeemablePoints));
    if (
      safePoints <= 0 ||
      safePoints < minimumLoyaltyRedeemPoints ||
      loyaltyRedemptionRate === null
    ) {
      setLoyaltyRedemption(null);
      return;
    }
    const amount =
      Math.round(safePoints * loyaltyRedemptionRate * 100) / 100;
    setLoyaltyRedemption({ points: safePoints, amount });
  }

  const methods = useMemo(
    () =>
      (
        [
          { id: "cash", label: "Cash", icon: Banknote },
          { id: "card", label: "Card", icon: CreditCard },
          { id: "wallet", label: "Wallet", icon: Wallet },
          { id: "other", label: "Other", icon: Banknote },
          { id: "credit", label: "Credit sale", icon: UserCircle },
        ] satisfies { id: PaymentMethod; label: string; icon: typeof Banknote }[]
      ).filter((method) => enabledMethods.includes(method.id)),
    [enabledMethods]
  );

  useEffect(() => {
    if (methods.length > 0 && !enabledMethods.includes(paymentMethod)) {
      setPaymentMethod(methods[0].id);
    }
  }, [enabledMethods, methods, paymentMethod, setPaymentMethod]);

  useEffect(() => {
    if (!open) return;

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (loading) return;
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [loading, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSplitMode(false);
      setSplits([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !splitMode) return;
    setSplits((current) => {
      if (current.length !== 1) return current;
      const next = roundMoney(total);
      const first = current[0]!;
      if (Math.abs(first.amount - next) < 0.005) return current;
      return [{ method: first.method, amount: next }];
    });
  }, [open, splitMode, total]);

  const syncedSplits = splits;

  const splitTotal = roundMoney(syncedSplits.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = roundMoney(Math.max(0, total - splitTotal));
  const overpaid = roundMoney(Math.max(0, splitTotal - total));
  const creditSelected = splitMode
    ? syncedSplits.some((payment) => payment.method === "credit")
    : paymentMethod === "credit";
  const creditAmount = splitMode
    ? roundMoney(
        syncedSplits
          .filter((payment) => payment.method === "credit")
          .reduce((sum, payment) => sum + payment.amount, 0)
      )
    : paymentMethod === "credit"
      ? total
      : 0;
  const hasCustomerForCredit = Boolean(customer) || creditCustomerLinked;
  const creditNeedsCustomer = creditSelected && !hasCustomerForCredit;
  const creditEnabled = methods.some((method) => method.id === "credit");
  const hasCreditSplit = syncedSplits.some((payment) => payment.method === "credit");
  const canComplete =
    !disabled &&
    !loading &&
    !creditNeedsCustomer &&
    total > 0 &&
    (useFixedTotal || cart.length > 0) &&
    methods.length > 0 &&
    (!splitMode || (Math.abs(splitTotal - total) < 0.01 && syncedSplits.length >= 1));

  function addSplit(method: PaymentMethod = methods.find((m) => m.id !== "credit")?.id ?? "cash") {
    if (method === "credit") {
      if (!hasCustomerForCredit || hasCreditSplit || remaining <= 0) return;
    }
    const amount = remaining > 0 ? remaining : 0;
    setSplits((current) => [...current, { method, amount }]);
  }

  function addCreditRemainder() {
    if (!creditEnabled || !hasCustomerForCredit || hasCreditSplit || remaining <= 0) return;
    setSplits((current) => [...current, { method: "credit", amount: remaining }]);
  }

  function updateSplit(index: number, patch: Partial<PaymentSplit>) {
    setSplits((current) =>
      current.map((payment, i) => {
        if (i !== index) return payment;
        if (
          patch.method === "credit" &&
          current.some((other, otherIndex) => otherIndex !== index && other.method === "credit")
        ) {
          return payment;
        }
        return { ...payment, ...patch };
      })
    );
  }

  function normalizePayments(payments: PaymentSplit[]): PaymentSplit[] {
    const rounded = payments
      .map((payment) => ({
        method: payment.method,
        amount: roundMoney(Number(payment.amount) || 0),
      }))
      .filter((payment) => payment.amount > 0);
    if (rounded.length === 0) return rounded;
    const sum = roundMoney(rounded.reduce((s, p) => s + p.amount, 0));
    const diff = roundMoney(total - sum);
    if (Math.abs(diff) >= 0.01) {
      const last = rounded[rounded.length - 1]!;
      last.amount = roundMoney(last.amount + diff);
      if (last.amount <= 0) {
        return rounded.filter((payment) => payment.amount > 0);
      }
    }
    return rounded;
  }

  function complete() {
    const payments = normalizePayments(
      splitMode ? syncedSplits : [{ method: paymentMethod, amount: total }]
    );
    if (payments.length === 0) return;
    if (!useFixedTotal) {
      setPaymentSplits(payments);
    }
    onComplete(payments);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] max-[390px]:p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        className="flex max-h-[min(92dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl ring-1 ring-border/60 max-[390px]:max-h-[min(96dvh,100%)] max-[390px]:rounded-t-2xl max-[390px]:rounded-b-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-payment-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3">
          <h2 id="pos-payment-title" className="font-heading text-lg font-semibold sm:text-xl">
            {t("Payment")}
          </h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            className="size-11 rounded-xl"
            aria-label={t("Close")}
            disabled={loading}
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-3 rounded-xl border border-border/50 bg-muted/30 px-2 py-2 text-center sm:py-2.5">
          <p className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
            {formatCurrency(total)}
          </p>
          {discountAmount > 0 || redemptionAmount > 0 ? (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {formatCurrency(subtotal)} {t("subtotal")}
              {discountAmount > 0
                ? ` · -${formatCurrency(discountAmount)} ${t("discount")}`
                : ""}
              {redemptionAmount > 0
                ? ` · -${formatCurrency(redemptionAmount)} ${t("points")}`
                : ""}
            </p>
          ) : null}
        </div>

        {customerName ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {t("Customer")}: <span className="font-medium text-foreground">{customerName}</span>
          </p>
        ) : null}

        {creditSelected && hasCustomerForCredit ? (
          <p className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
            {t("Credit sale will be charged to the customer account")}
          </p>
        ) : null}

        {creditNeedsCustomer ? (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:text-amber-200">
            {t("Select a customer for credit sale")}
          </p>
        ) : null}

        {!useFixedTotal && loyaltyAvailable ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-400/30 dark:bg-amber-400/10">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              <Star className="size-3.5" />
              {t("Loyalty points")}: {loyaltyBalance}
            </p>
            {canRedeemLoyalty ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 shrink-0 rounded-lg px-2.5 text-xs"
                    variant={loyaltyRedemption ? "default" : "outline"}
                    onClick={() => applyRedemption(maxRedeemablePoints)}
                  >
                    {t("Use points")}
                  </Button>
                  <Input
                    type="number"
                    min={minimumLoyaltyRedeemPoints}
                    max={maxRedeemablePoints}
                    value={loyaltyRedemption?.points ?? ""}
                    placeholder={t("Points to redeem")}
                    onChange={(e) => applyRedemption(Number(e.target.value))}
                    className="h-11 min-w-0 flex-1 rounded-lg bg-background px-2 text-end text-sm tabular-nums"
                    inputMode="numeric"
                  />
                  {loyaltyRedemption ? (
                    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-lg" onClick={() => setLoyaltyRedemption(null)} aria-label={t("No points")}>
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
            ) : null}
            {loyaltyRedemption ? (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                {loyaltyRedemption.points} {t("points")} = -
                {formatCurrency(loyaltyRedemption.amount)}
              </p>
            ) : !canRedeemLoyalty ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {t("Minimum redemption")} {minimumLoyaltyRedeemPoints} {t("points")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {t("Max")} {maxRedeemablePoints} {t("points")} (
                {formatCurrency(
                  Math.round(maxRedeemablePoints * (loyaltyRedemptionRate ?? 0) * 100) / 100
                )}
                )
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{t("Method")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              const next = !splitMode;
              setSplitMode(next);
              if (next) {
                const seedMethod =
                  methods.find((m) => m.id !== "credit")?.id ?? methods[0]?.id ?? "cash";
                setSplits([{ method: seedMethod, amount: total }]);
                if (paymentMethod === "credit") setPaymentMethod(seedMethod);
              } else {
                setSplits([]);
              }
            }}
          >
            {splitMode ? t("Single payment") : t("Split")}
          </Button>
        </div>
        {splitMode && creditEnabled ? (
          <p className="mb-2 text-xs text-muted-foreground">
            {t("Pay part now and charge the rest to the customer account.")}
          </p>
        ) : null}
        {!splitMode ? (
        <div
          className={cn(
            "mb-2.5 grid gap-1.5",
            methods.length <= 2
              ? "grid-cols-2"
              : methods.length === 3
                ? "grid-cols-3"
                : methods.length === 4
                  ? "grid-cols-4"
                  : "grid-cols-3 sm:grid-cols-5"
          )}
        >
          {methods.map(({ id, label, icon: Icon }) => {
            const selected = paymentMethod === id;
            const tone =
              id === "cash"
                ? "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700"
                : id === "card"
                  ? "border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
                  : id === "wallet"
                    ? "border-violet-300 bg-violet-600 text-white hover:bg-violet-700"
                    : id === "credit"
                      ? "border-amber-300 bg-amber-500 text-amber-950 hover:bg-amber-400"
                      : "border-slate-300 bg-slate-700 text-white hover:bg-slate-800";
            const methodLabel = t(label);
            return (
              <button
                key={id}
                type="button"
                aria-label={methodLabel}
                onClick={() => setPaymentMethod(id)}
                className={cn(
                  "flex h-11 min-h-11 flex-col items-center justify-center gap-0 rounded-lg border-2 px-1 text-[11px] font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 sm:flex-row sm:gap-1.5 sm:px-1.5 sm:text-xs",
                  tone,
                  selected && "ring-2 ring-offset-2 ring-foreground/30"
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="truncate">{methodLabel}</span>
              </button>
            );
          })}
        </div>
        ) : (
          <div className="mb-3 grid gap-2">
            {syncedSplits.map((payment, index) => (
              <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem_2.75rem] items-center gap-1.5">
                <div className="scrollbar-none flex min-w-0 touch-pan-x flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5">
                  {methods.map(({ id, label, icon: Icon }) => {
                    const selected = payment.method === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-label={t(label)}
                        aria-pressed={selected}
                        onClick={() => updateSplit(index, { method: id })}
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payment.amount || ""}
                  onChange={(e) => updateSplit(index, { amount: Number(e.target.value) })}
                  className="h-11 min-w-0 rounded-xl px-2 text-end tabular-nums"
                  inputMode="decimal"
                  aria-label={`${t("Payment amount")} ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  aria-label={t("Delete payment")}
                  onClick={() => setSplits((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span
                className={
                  remaining === 0 && overpaid === 0
                    ? "text-muted-foreground"
                    : "text-amber-700 dark:text-amber-300"
                }
              >
                {overpaid > 0
                  ? `${t("Overpaid")} ${formatCurrency(overpaid)}`
                  : `${t("Remaining")} ${formatCurrency(remaining)}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {creditEnabled && hasCustomerForCredit && remaining > 0 && !hasCreditSplit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={addCreditRemainder}
                  >
                    {t("Charge remainder")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={remaining <= 0}
                  onClick={() => addSplit()}
                >
                  <Plus className="size-4" />
                  {t("Add payment")}
                </Button>
              </div>
            </div>
          </div>
        )}

        </div>

        <div className="shrink-0 border-t border-border/50 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2.5">
          <Button
            className="h-12 w-full rounded-xl text-sm font-semibold"
            disabled={!canComplete}
            onClick={complete}
          >
            {loading
              ? t("Processing…")
              : creditSelected && creditAmount > 0 && creditAmount + 0.001 < total
                ? `${t("Complete")} · ${formatCurrency(total)} · ${t("Credit sale")} ${formatCurrency(creditAmount)}`
                : creditSelected
                  ? `${t("Credit sale")} · ${formatCurrency(total)}`
                  : `${t("Complete")} · ${formatCurrency(total)}`}
          </Button>
          {creditNeedsCustomer ? (
            <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
              {t("Select a customer for credit sale")}
            </p>
          ) : null}
          {splitMode && !canComplete && !loading && !disabled && overpaid === 0 && remaining > 0 ? (
            <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
              {t("Split amounts must equal total")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
