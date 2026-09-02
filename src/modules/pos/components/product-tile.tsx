"use client";

import Image from "next/image";
import { Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { resolveDisplayPriceRange } from "@/modules/products/lib/display-price-range";
import type { POSProduct } from "@/modules/pos/services/catalog.service";
import { firstGrapheme } from "@/lib/first-grapheme";
import { useTranslation } from "@/lib/i18n/use-translation";

const BADGE_LABELS = {
  in_stock: "In stock",
  low: "Low",
  out: "Out",
  untracked: null,
} as const;

interface ProductTileProps {
  product: POSProduct;
  onAdd: () => void;
  disabled?: boolean;
  /** Product imagery is opt-in in the POS to keep the default catalog dense. */
  showImage?: boolean;
  /** When false (e.g. supermarket), treat orphan variants as a single sell price. */
  showVariants?: boolean;
  /**
   * When true, out-of-stock tiles stay clickable (feature flag prevent_negative_stock off).
   * Badge still shows "نفد" so the cashier sees the shortage.
   */
  allowNegativeStock?: boolean;
}

export function ProductTile({
  product,
  onAdd,
  disabled,
  showImage = false,
  showVariants = true,
  allowNegativeStock = false,
}: ProductTileProps) {
  const { t, language } = useTranslation();
  const badgeLabel = BADGE_LABELS[product.stockBadge];
  const outOfStock = product.stockBadge === "out";
  const blockOutOfStock = outOfStock && !allowNegativeStock;
  const variantPrices = product.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price));
  const showVariantPrice =
    showVariants && product.hasVariants && variantPrices.length > 0;
  const { amount: displayPrice, rangeLabel: priceRange } =
    resolveDisplayPriceRange({
      variantPrices:
        showVariantPrice || product.hasVariants ? variantPrices : [],
      baseAmount: product.base_price,
      showRange: showVariantPrice,
      rangeSeparator: language === "ar" ? "arabic" : "en-dash",
    });
  const stockLabel = badgeLabel
    ? product.stockBadge === "out" && allowNegativeStock
      ? t("Out of stock — sale allowed")
      : t(badgeLabel)
    : null;
  const accessibleLabel = [
    product.name,
    formatCurrency(displayPrice),
    stockLabel,
    showVariants && product.hasVariants
      ? `${product.variants.length} ${t("Variants")}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled || blockOutOfStock}
      aria-label={accessibleLabel}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl bg-card text-start text-card-foreground shadow-none ring-1 ring-border/65 transition duration-150 hover:ring-primary/35 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-[14px]",
        showImage
          ? "min-h-[108px] sm:min-h-[124px]"
          : "min-h-[84px] sm:min-h-[96px]",
      )}
    >
      {showImage ? (
        <div
          className="relative flex aspect-[16/9] min-h-[50px] w-full items-center justify-center overflow-hidden bg-muted/70 sm:min-h-[58px]"
          style={{
            backgroundImage: `linear-gradient(145deg, ${product.categoryColor}22, ${product.categoryColor}44)`,
          }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt=""
              fill
              sizes="(min-width: 1280px) 11vw, (min-width: 768px) 18vw, (min-width: 640px) 22vw, (min-width: 350px) 31vw, 48vw"
              unoptimized
              className="object-cover transition duration-200 group-hover:scale-[1.025] motion-reduce:transition-none"
            />
          ) : null}
          {product.image_url ? (
            <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
          ) : null}
          <span
            className={cn(
              "text-2xl font-bold opacity-30 transition group-hover:scale-105 motion-reduce:transition-none sm:text-3xl",
              product.image_url && "opacity-0",
            )}
            style={{ color: product.categoryColor }}
          >
            {firstGrapheme(product.name, "?")}
          </span>
          {badgeLabel ? (
            <Badge
              variant={
                product.stockBadge === "low"
                  ? "outline"
                  : product.stockBadge === "out"
                    ? "destructive"
                    : "secondary"
              }
              className={cn(
                "absolute end-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] shadow-sm backdrop-blur max-[390px]:end-1 max-[390px]:top-1 max-[390px]:px-1 max-[390px]:text-[9px]",
                product.stockBadge === "in_stock" &&
                  "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200",
                product.stockBadge === "low" &&
                  "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
              )}
            >
              <span className="sr-only">{t(badgeLabel)}: </span>
              {product.stockQuantity ?? "—"}
            </Badge>
          ) : null}
          {showVariants && product.hasVariants ? (
            <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur max-[390px]:start-1 max-[390px]:top-1 max-[390px]:px-1 max-[390px]:text-[9px]">
              <Layers3 className="size-3 max-[390px]:size-2.5" />
              {product.variants.length}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-0.5 p-1.5 sm:p-2">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-card-foreground sm:text-[15px]">
          {product.name}
        </p>
        <div className="min-w-0 pt-0.5">
          {showVariantPrice ? (
            <p className="text-[10px] text-muted-foreground max-sm:hidden">
              {priceRange ? t("From") : t("Price")}
            </p>
          ) : null}
          <p className="truncate text-[13px] font-bold tabular-nums text-foreground sm:text-[15px]">
            {formatCurrency(displayPrice)}
            {priceRange ? (
              <span className="ms-0.5 text-[10px] font-normal text-muted-foreground">
                {priceRange}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground max-sm:hidden">
          <p className="min-w-0 truncate">{product.categoryName}</p>
          {!showImage && showVariants && product.hasVariants ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 font-medium">
              <Layers3 className="size-3" aria-hidden />
              {product.variants.length}
            </span>
          ) : null}
        </div>
        {!showImage && badgeLabel ? (
          <div className="mt-auto flex justify-end pt-1">
            <Badge
              variant={
                product.stockBadge === "low"
                  ? "outline"
                  : product.stockBadge === "out"
                    ? "destructive"
                    : "secondary"
              }
              className={cn(
                "max-w-[55%] shrink-0 truncate rounded-full px-1.5 py-0 text-[9px] shadow-none sm:text-[10px]",
                product.stockBadge === "in_stock" &&
                  "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200",
                product.stockBadge === "low" &&
                  "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
              )}
            >
              <span className="sr-only">{t(badgeLabel)}: </span>
              {product.stockQuantity ?? "—"}
            </Badge>
          </div>
        ) : null}
      </div>
    </button>
  );
}
