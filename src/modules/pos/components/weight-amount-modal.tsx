"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  parseScaleSettings,
} from "@/modules/pos/lib/scale-device-hook";
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

function formatWeightPreview(quantityKg: number, unit: string, kgLabel: string, gramLabel: string): string {
  if (unit === "kg" || unit === "gram") {
    const grams = Math.round(quantityKg * 1000);
    return `${quantityKg.toFixed(3)} ${kgLabel} ≈ ${grams} ${gramLabel}`;
  }
  return `${quantityKg.toFixed(3)} ${unit}`;
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
  const scaleConfig = parseScaleSettings(scaleEnabled, scaleSettings);

  const resetKey = open && product ? `${product.id}:${product.supports_amount_sale === true}` : "";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open && product) {
      setMode(product.supports_amount_sale === true ? "by_amount" : "by_weight");
      setWeight("");
      setAmount("");
    }
  }

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
    const match = KG_WEIGHT_PRESETS.find((preset) => Math.abs(preset.kg - quantity) < 0.0005);
    return match?.kg ?? null;
  }, [showKgPresets, quantity]);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const validUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0;
  const hasEntry = mode === "by_weight" ? weight.trim() !== "" : amount.trim() !== "";
  const validationMessage = !validUnitPrice
    ? t("This product needs a valid price before it can be sold")
    : hasEntry && !validQuantity
      ? t("Enter a value greater than zero")
      : null;
  const total = amountFromQuantity(validQuantity ? quantity : 0, validUnitPrice ? unitPrice : 0);

  function applyWeightPreset(kg: number) {
    setMode("by_weight");
    setWeight(formatWeightPresetValue(kg));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(94dvh,100%)] overflow-y-auto rounded-2xl p-2.5 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md sm:p-4">
        <DialogHeader className="pe-7">
          <DialogTitle className="truncate text-base sm:text-lg">{product?.name ?? t("Sell by weight")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 sm:space-y-2.5">
          <div className="inline-flex w-full rounded-xl border p-1">
            <Button
              size="sm"
              variant={mode === "by_weight" ? "default" : "ghost"}
              className="h-11 flex-1 rounded-lg"
              onClick={() => setMode("by_weight")}
            >
              {t("By weight")}
            </Button>
            {allowAmount ? (
              <Button
                size="sm"
                variant={mode === "by_amount" ? "default" : "ghost"}
                className="h-11 flex-1 rounded-lg"
                onClick={() => setMode("by_amount")}
              >
                {t("By amount")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Price per unit")}: {formatCurrency(unitPrice)} / {t(unit)}
          </p>
          {scaleConfig.enabled && mode === "by_weight" ? (
            <p className="text-xs text-muted-foreground">
              {t("Enter weight manually. USB scale reading is not enabled on this device.")}
            </p>
          ) : null}
          {mode === "by_weight" ? (
            <div className="space-y-2">
              {showKgPresets ? (
                <div className="space-y-2">
                  <Label>{t("Quick select")}</Label>
                  <div className="grid grid-cols-5 gap-1.5 max-[390px]:grid-cols-3">
                    {KG_WEIGHT_PRESETS.map((preset) => {
                      const selected = selectedPresetKg === preset.kg;
                      return (
                        <Button
                          key={preset.id}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "h-11 rounded-lg px-1 text-xs font-semibold tabular-nums",
                            selected && "shadow-sm"
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
              <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
                <Label className="text-xs" htmlFor="pos-weight-input">
                  {showKgPresets ? t("Other weight (kg)") : `${t("Weight")} (${t(unit)})`}
                </Label>
                <Input
                  id="pos-weight-input"
                  type="number"
                  step="0.001"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-11 rounded-lg text-end text-sm font-semibold tabular-nums"
                  inputMode="decimal"
                  aria-invalid={Boolean(validationMessage)}
                  aria-describedby={validationMessage ? "pos-weight-validation" : undefined}
                  autoFocus={!showKgPresets}
                  placeholder={showKgPresets ? t("Example: 0.350") : undefined}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
              <Label className="text-xs" htmlFor="pos-amount-input">{t("Customer requested amount")}</Label>
              <Input
                id="pos-amount-input"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 rounded-lg text-end text-sm font-semibold tabular-nums"
                inputMode="decimal"
                aria-invalid={Boolean(validationMessage)}
                aria-describedby={validationMessage ? "pos-weight-validation" : undefined}
                autoFocus
              />
            </div>
          )}
          {validationMessage ? (
            <p id="pos-weight-validation" className="text-xs text-destructive" role="alert">
              {validationMessage}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("Quantity")}: {validQuantity ? formatWeightPreview(quantity, unit, t("kg"), t("gram")) : "—"}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("Total")}</p>
            <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(total)}
            </p>
          </div>
          <Button
            className="h-12 w-full rounded-xl text-sm font-semibold"
            disabled={!validQuantity || !validUnitPrice}
            onClick={() =>
              onConfirm({
                quantity,
                unitPrice,
                saleInputMode: mode,
                enteredAmount: mode === "by_amount" ? Number(amount || 0) : undefined,
              })
            }
          >
            {t("Add to cart")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
