"use client";

import { useState, useTransition } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import {
  discardHeldCartAction,
  resumeHeldCartAction,
} from "@/modules/pos/actions/held-cart.actions";
import { getCartSubtotal, usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";

export function PosHeldCartsBar() {
  const { t } = useTranslation();
  const heldCarts = usePosStore((s) => s.heldCarts);
  const resumeHeldCart = usePosStore((s) => s.resumeHeldCart);
  const removeHeldCart = usePosStore((s) => s.removeHeldCart);
  const reconcileHeldCartId = usePosStore((s) => s.reconcileHeldCartId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heldDeleteId, setHeldDeleteId] = useState<string | null>(null);
  const [discardPending, startDiscardTransition] = useTransition();

  if (heldCarts.length === 0) return null;

  function handleResumeHeldCart(id: string) {
    const state = usePosStore.getState();
    const target = state.heldCarts.find((held) => held.id === id);
    if (!target) return;
    if (target.id.startsWith("temp-hold-") && !target.failedCheckout) {
      toast.error(t("The held invoice is still saving. Try again shortly."));
      return;
    }

    // Failed checkout holds are local-only — restore cart without server resume.
    if (target.failedCheckout) {
      const ok = resumeHeldCart(id, null);
      if (!ok) {
        toast.error(t("Held invoice not found"));
        return;
      }
      setPickerOpen(false);
      playPosSuccessSound();
      toast.success(t("Invoice restored — review it and try payment again"));
      return;
    }

    const snapshot = {
      cart: [...state.cart],
      customer: state.customer,
      customerLoyaltyBalance: state.customerLoyaltyBalance,
      loyaltyRedemption: state.loyaltyRedemption,
      discountAmount: state.discountAmount,
      couponCode: state.couponCode,
      salesMode: state.salesMode,
      paymentMethod: state.paymentMethod,
      paymentSplits: [...state.paymentSplits],
      heldCarts: [...state.heldCarts],
    };

    const parkCurrent =
      state.cart.length > 0
        ? {
            name: state.customer?.name,
            cart: [...state.cart],
            customer: state.customer,
            discountAmount: state.discountAmount,
            couponCode: state.couponCode,
            salesMode: state.salesMode,
          }
        : null;

    const parkedLocal =
      parkCurrent && parkCurrent.cart.length > 0
        ? {
            id: `temp-hold-${crypto.randomUUID()}`,
            name:
              parkCurrent.name?.trim() ||
              parkCurrent.customer?.name ||
              `${t("Held")} ${state.heldCarts.length + 1}`,
            cart: parkCurrent.cart,
            customer: parkCurrent.customer,
            discountAmount: parkCurrent.discountAmount,
            couponCode: parkCurrent.couponCode,
            salesMode: parkCurrent.salesMode,
            createdAt: new Date().toISOString(),
          }
        : null;

    const ok = resumeHeldCart(id, parkedLocal);
    if (!ok) {
      toast.error(t("Held invoice not found"));
      return;
    }

    setPickerOpen(false);

    void resumeHeldCartAction({
      resumeId: id,
      parkCurrent,
    }).then((result) => {
      if (!result.success) {
        usePosStore.setState(snapshot);
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      playPosSuccessSound();
      toast.success(t("Invoice resumed"));
      if (parkedLocal && result.parked) {
        reconcileHeldCartId(parkedLocal.id, result.parked);
      }
    });
  }

  function closePickerIfEmpty() {
    if (usePosStore.getState().heldCarts.length === 0) {
      setPickerOpen(false);
    }
  }

  function handleDiscardHeldCart(id: string) {
    if (id.startsWith("temp-hold-")) {
      removeHeldCart(id);
      closePickerIfEmpty();
      return;
    }
    startDiscardTransition(async () => {
      const result = await discardHeldCartAction(id);
      if (!result.success) {
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      removeHeldCart(id);
      closePickerIfEmpty();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative h-11 shrink-0 justify-center gap-1.5 rounded-xl border-orange-200 bg-orange-50 px-2.5 text-sm font-semibold text-orange-950 hover:bg-orange-100 max-lg:size-11 max-lg:px-0 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20"
        onClick={() => setPickerOpen(true)}
        aria-label={`${t("Held invoices")}: ${heldCarts.length}`}
      >
        <Clock3 className="size-4 shrink-0" />
        <span className="truncate max-lg:sr-only">{t("Held invoices")}</span>
        <span className="rounded-full bg-orange-700 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums max-lg:absolute max-lg:-end-1 max-lg:-top-1 dark:bg-orange-400 dark:text-orange-950">
          {heldCarts.length}
        </span>
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[94dvh] max-w-lg overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-lg">
          <DialogHeader className="border-b border-border/70 px-3 py-3 text-start">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-800 dark:text-orange-200">
                <Clock3 className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">{t("Held invoices")}</DialogTitle>
                <DialogDescription className="truncate text-xs">
                  {t("Choose an invoice to resume. Your current cart will be held automatically.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ul className="max-h-[min(76dvh,620px)] space-y-1.5 overflow-y-auto px-2.5 py-2.5 sm:px-3">
            {heldCarts.map((held) => {
              const itemCount = held.cart.length;
              const subtotal = getCartSubtotal(held.cart);
              const saving = held.id.startsWith("temp-hold-") && !held.failedCheckout;
              const failed = Boolean(held.failedCheckout);
              return (
                <li key={held.id}>
                  <div
                    className={
                      failed
                        ? "flex items-stretch gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-1"
                        : "flex items-stretch gap-1 rounded-lg border border-border/70 bg-background p-1"
                    }
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
                      onClick={() => handleResumeHeldCart(held.id)}
                      disabled={saving || discardPending}
                    >
                      <p className="truncate text-sm font-semibold">{held.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {saving
                          ? t("Saving…")
                          : failed
                            ? held.failureMessage || t("Tap to restore and try again")
                            : [
                                held.customer?.name,
                                `${itemCount} ${t(itemCount === 1 ? "item" : "items")}`,
                                formatCurrency(subtotal),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                      </p>
                      {!saving && held.createdAt ? (
                        <p className="text-[10px] text-muted-foreground/80">
                          {formatDateTime(held.createdAt)}
                        </p>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 self-center rounded-lg text-muted-foreground hover:text-destructive"
                      aria-label={`${t("Delete")} ${held.name}`}
                      disabled={discardPending}
                      onClick={() => setHeldDeleteId(held.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(heldDeleteId)}
        onOpenChange={(open) => {
          if (!open) setHeldDeleteId(null);
        }}
        title={t("Delete held invoice?")}
        description={t("This held invoice will be deleted permanently.")}
        confirmLabel={t("Delete")}
        destructive
        onConfirm={() => {
          if (heldDeleteId) handleDiscardHeldCart(heldDeleteId);
          setHeldDeleteId(null);
        }}
      />
    </>
  );
}
