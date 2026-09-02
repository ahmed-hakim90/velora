"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Scale, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { POSProduct } from "@/modules/pos/services/catalog.service";
import {
  formatWeightPresetValue,
  KG_WEIGHT_PRESETS,
} from "@/modules/pos/lib/weight-presets";
import { amountFromQuantity, quantityFromAmount } from "@/lib/units";
import { parseScaleSettings } from "@/modules/pos/lib/scale-device-hook";
import { useTranslation } from "@/lib/i18n/use-translation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: POSProduct | null;
  /** Paired terminal scale registry (supermarket). */
  scaleEnabled?: boolean;
  scaleSettings?: Record<string, unknown> | null;
  onConfirm: (input: {
    quantity: number;
    unitPrice: number;
    saleInputMode: "by_weight" | "by_amount";
    enteredAmount?: number;
  }) => void;
}

function formatWeightPreview(
  quantity: number,
  unit: string,
  kgLabel: string,
  gramLabel: string,
): string {
  if (unit === "kg") {
    const grams = Math.round(quantity * 1000);
    return `${quantity.toFixed(3)} ${kgLabel} ≈ ${grams} ${gramLabel}`;
  }
  if (unit === "gram") return `${Number(quantity.toFixed(3))} ${gramLabel}`;
  return `${Number(quantity.toFixed(3))} ${unit}`;
}

export function WeightAmountModal({
  open,
  onOpenChange,
  product,
  scaleEnabled,
  scaleSettings,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const allowAmount = product?.supports_amount_sale === true;
  const [mode, setMode] = useState<"by_weight" | "by_amount">("by_weight");
  const [weight, setWeight] = useState("");
  const [amount, setAmount] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const scaleConfig = parseScaleSettings(scaleEnabled, scaleSettings);

  const productId = product?.id;
  useEffect(() => {
    if (!open || !productId) return;

    setMode(allowAmount ? "by_amount" : "by_weight");
    setWeight("");
    setAmount("");
  }, [allowAmount, open, productId]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (mode === "by_amount") amountInputRef.current?.focus();
      else weightInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;

    let frame = 0;
    function keepActiveInputVisible() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const activeInput =
          mode === "by_amount"
            ? amountInputRef.current
            : weightInputRef.current;
        activeInput?.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest",
        });
      });
    }

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", keepActiveInputVisible);
    window.addEventListener("resize", keepActiveInputVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener("resize", keepActiveInputVisible);
      window.removeEventListener("resize", keepActiveInputVisible);
    };
  }, [mode, open]);

  const unitPrice =
    (product?.base_price ?? 0) > 0
      ? (product?.base_price ?? 0)
      : (product?.variants[0]?.price ?? 0);
  const unit = product?.sale_unit ?? "kg";
  /** Presets are defined in kg; only show when the sale unit is kg. */
  const showKgPresets = mode === "by_weight" && unit === "kg";
  const quantity = useMemo(() => {
    if (mode === "by_weight") return Number(weight || 0);
    return quantityFromAmount(Number(amount || 0), unitPrice);
  }, [mode, weight, amount, unitPrice]);
  const selectedPresetKg = useMemo(() => {
    if (!showKgPresets || quantity <= 0) return null;
    const match = KG_WEIGHT_PRESETS.find(
      (preset) => Math.abs(preset.kg - quantity) < 0.0005,
    );
    return match?.kg ?? null;
  }, [showKgPresets, quantity]);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const validUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0;
  const hasEntry =
    mode === "by_weight" ? weight.trim() !== "" : amount.trim() !== "";
  const validationMessage = !validUnitPrice
    ? t("This product needs a valid price before it can be sold")
    : hasEntry && !validQuantity
      ? t("Enter a value greater than zero")
      : null;
  const total = amountFromQuantity(
    validQuantity ? quantity : 0,
    validUnitPrice ? unitPrice : 0,
  );

  function applyWeightPreset(kg: number) {
    setMode("by_weight");
    setWeight(formatWeightPresetValue(kg));
  }

  function handleConfirm() {
    if (!validQuantity || !validUnitPrice) return;
    onConfirm({
      quantity,
      unitPrice,
      saleInputMode: mode,
      enteredAmount: mode === "by_amount" ? Number(amount || 0) : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94dvh,100%)] flex-col gap-0 overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pe-11 text-start">
          <DialogTitle className="truncate text-lg font-bold">
            {product?.name ?? t("Sell by weight")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t("Price per unit")}:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(unitPrice)} / {t(unit)}
            </span>
          </p>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <div className="min-h-0 flex-1 scroll-py-4 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-3">
            <div
              className="inline-flex w-full rounded-xl border bg-muted/35 p-1"
              role="group"
              aria-label={t("Sale method")}
            >
              <Button
                type="button"
                size="sm"
                variant={mode === "by_weight" ? "default" : "ghost"}
                className="h-11 flex-1 gap-2 rounded-lg font-semibold"
                onClick={() => setMode("by_weight")}
                aria-pressed={mode === "by_weight"}
              >
                <Scale className="size-4" aria-hidden />
                {t("By weight")}
              </Button>
              {allowAmount ? (
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "by_amount" ? "default" : "ghost"}
                  className="h-11 flex-1 gap-2 rounded-lg font-semibold"
                  onClick={() => setMode("by_amount")}
                  aria-pressed={mode === "by_amount"}
                >
                  <Banknote className="size-4" aria-hidden />
                  {t("By amount")}
                </Button>
              ) : null}
            </div>
            {scaleConfig.enabled && mode === "by_weight" ? (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {t(
                  "Enter weight manually. USB scale reading is not enabled on this device.",
                )}
              </p>
            ) : null}
            {mode === "by_weight" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label
                    className="text-sm font-semibold"
                    htmlFor="pos-weight-input"
                  >
                    {showKgPresets
                      ? t("Weight in kilograms")
                      : `${t("Weight")} (${t(unit)})`}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={weightInputRef}
                      id="pos-weight-input"
                      type="number"
                      step={unit === "gram" ? "1" : "0.001"}
                      min="0"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      onFocus={(event) =>
                        event.currentTarget.scrollIntoView({
                          block: "center",
                          inline: "nearest",
                        })
                      }
                      className="h-14 rounded-xl pe-14 text-end text-xl font-bold tabular-nums"
                      inputMode="decimal"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-invalid={Boolean(validationMessage)}
                      aria-describedby={
                        validationMessage ? "pos-weight-validation" : undefined
                      }
                      placeholder={
                        showKgPresets ? t("Example: 0.350") : undefined
                      }
                    />
                    <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      {t(unit)}
                    </span>
                  </div>
                </div>
                {showKgPresets ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {t("Quick select")}
                    </Label>
                    <div className="grid grid-cols-5 gap-1.5 max-[390px]:grid-cols-3">
                      {KG_WEIGHT_PRESETS.map((preset) => {
                        const selected = selectedPresetKg === preset.kg;
                        return (
                          <Button
                            key={preset.id}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            className={cn(
                              "h-12 rounded-lg px-1 text-sm font-bold tabular-nums",
                              selected && "shadow-sm",
                            )}
                            onClick={() => applyWeightPreset(preset.kg)}
                            aria-pressed={selected}
                          >
                            {preset.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label
                  className="text-sm font-semibold"
                  htmlFor="pos-amount-input"
                >
                  {t("Customer requested amount")}
                </Label>
                <div className="relative">
                  <Input
                    ref={amountInputRef}
                    id="pos-amount-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={(event) =>
                      event.currentTarget.scrollIntoView({
                        block: "center",
                        inline: "nearest",
                      })
                    }
                    className="h-14 rounded-xl pe-14 text-end text-xl font-bold tabular-nums"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-invalid={Boolean(validationMessage)}
                    aria-describedby={
                      validationMessage ? "pos-weight-validation" : undefined
                    }
                  />
                  <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    {t("EGP")}
                  </span>
                </div>
              </div>
            )}
            {validationMessage ? (
              <p
                id="pos-weight-validation"
                className="text-xs text-destructive"
                role="alert"
              >
                {validationMessage}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{t("Quantity")}</p>
                <p className="mt-1 truncate text-sm font-bold tabular-nums text-foreground">
                  {validQuantity
                    ? formatWeightPreview(quantity, unit, t("kg"), t("gram"))
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/8 px-3 py-2.5">
                <p className="text-xs text-primary">{t("Total")}</p>
                <p className="mt-1 truncate text-lg font-bold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl px-5"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-xl text-sm font-bold"
              disabled={!validQuantity || !validUnitPrice}
            >
              <ShoppingCart className="size-4" aria-hidden />
              {t("Add to cart")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
