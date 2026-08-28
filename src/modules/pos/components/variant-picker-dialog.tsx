"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/Velora/status-pill";
import { formatCurrency } from "@/lib/format";
import type { POSProduct, POSVariant } from "@/modules/pos/services/catalog.service";
import { useTranslation } from "@/lib/i18n/use-translation";

interface VariantPickerDialogProps {
  open: boolean;
  product: POSProduct | null;
  onClose: () => void;
  onSelect: (product: POSProduct, variant: POSVariant) => void;
  /** When true, out-of-stock variants stay selectable (prevent_negative_stock off). */
  allowNegativeStock?: boolean;
}

export function VariantPickerDialog({
  open,
  product,
  onClose,
  onSelect,
  allowNegativeStock = false,
}: VariantPickerDialogProps) {
  const { t } = useTranslation();
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(92dvh,100%)] flex-col gap-0 overflow-hidden p-0 max-sm:max-w-[calc(100%-0.5rem)] sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-3 py-2.5 text-start sm:px-4 sm:py-3">
          <DialogTitle className="truncate pe-7 text-base sm:text-lg">{product.name}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{t("Choose a size or option before adding to cart")}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-1 overflow-y-auto overscroll-y-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-1.5 sm:p-3 sm:pb-3">
          {product.variants.map((variant) => {
            const isOutOfStock = variant.stockBadge === "out";
            const blockOutOfStock = isOutOfStock && !allowNegativeStock;

            return (
              <Button
                key={variant.id}
                variant="outline"
                disabled={blockOutOfStock}
                className="h-auto min-h-11 justify-between rounded-lg border-border/70 bg-card px-2.5 py-1.5 text-start transition active:scale-[0.99] hover:border-primary/35 hover:bg-primary/5 disabled:opacity-50 sm:px-3 sm:py-2"
                onClick={() => {
                  onSelect(product, variant);
                  onClose();
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{variant.name}</span>
                  {variant.stockBadge !== "untracked" ? (
                    <span className="mt-0.5 block">
                      <StatusPill
                        label={
                          variant.stockBadge === "out"
                            ? allowNegativeStock
                              ? t("Out of stock — sale allowed")
                              : t("Unavailable")
                            : variant.stockBadge === "low"
                              ? t("Limited stock")
                              : t("Available")
                        }
                        variant={
                          variant.stockBadge === "out"
                            ? "warning"
                            : variant.stockBadge === "low"
                              ? "info"
                              : "success"
                        }
                      />
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs font-bold tabular-nums text-foreground">
                  {formatCurrency(variant.price)}
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
