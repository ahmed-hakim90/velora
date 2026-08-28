import type { POSProduct, POSVariant } from "@/modules/pos/services/catalog.service";

export function findPosProductByBarcode(
  products: POSProduct[],
  barcode: string
): { product: POSProduct; variant: POSVariant | null } | null {
  const normalized = barcode.trim().toLowerCase();
  if (!normalized) return null;

  const matches = (value: string | null | undefined) =>
    value?.trim().toLowerCase() === normalized;

  for (const product of products) {
    if (!product.hasVariants && (matches(product.barcode) || matches(product.sku))) {
      return { product, variant: null };
    }
    for (const variant of product.variants) {
      if (matches(variant.barcode) || matches(variant.sku)) {
        return { product, variant };
      }
    }
    if (matches(product.barcode) || matches(product.sku)) {
      return { product, variant: null };
    }
  }
  return null;
}
