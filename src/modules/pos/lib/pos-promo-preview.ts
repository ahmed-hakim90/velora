import {
  evaluatePromotions,
  type EvaluatePromotionsResult,
  type PromotionRuleInput,
} from "@/modules/promotions/lib/evaluate-promotions";
import type { CartLine } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export interface ProductOfferPreview {
  name: string;
  originalPrice: number;
  finalPrice: number;
}

export function previewPosPromotions(input: {
  rules: PromotionRuleInput[];
  cart: CartLine[];
  storeId?: string | null;
  saleMode?: SalesMode;
  couponCode?: string | null;
}): EvaluatePromotionsResult {
  return evaluatePromotions({
    rules: input.rules,
    lines: input.cart.map((line, index) => ({
      line_key: line.id || String(index),
      product_id: line.productId,
      category_id: line.categoryId ?? null,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    })),
    storeId: input.storeId,
    saleMode: input.saleMode ?? "retail",
    couponCode: input.couponCode,
  });
}

export function previewProductOffer(input: {
  rules: PromotionRuleInput[];
  productId: string;
  categoryId?: string | null;
  unitPrice: number;
  storeId?: string | null;
  saleMode?: SalesMode;
  now?: Date;
}): ProductOfferPreview | null {
  const now = input.now ?? new Date();
  const result = evaluatePromotions({
    rules: input.rules,
    lines: [{
      line_key: input.productId,
      product_id: input.productId,
      category_id: input.categoryId ?? null,
      quantity: 1,
      unit_price: input.unitPrice,
    }],
    storeId: input.storeId,
    saleMode: input.saleMode ?? "retail",
    now,
  });
  const line = result.lines[0];
  if (!line || line.line_total >= input.unitPrice) return null;

  const application = result.applications.find(
    (entry) => entry.level === "item" && entry.line_key === input.productId,
  );
  const scheduled = input.rules
    .filter((rule) => rule.rule_type === "scheduled_sale_price")
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => {
      const scopeMatches =
        rule.scope_type === "all" ||
        (rule.scope_type === "product" && rule.scope_ids.includes(input.productId)) ||
        (rule.scope_type === "category" &&
          Boolean(input.categoryId && rule.scope_ids.includes(input.categoryId)));
      return rule.is_active &&
        !rule.coupon_code?.trim() &&
        scopeMatches &&
        (!rule.starts_at || new Date(rule.starts_at) <= now) &&
        (!rule.ends_at || new Date(rule.ends_at) >= now) &&
        (!rule.store_ids?.length || Boolean(input.storeId && rule.store_ids.includes(input.storeId))) &&
        (!rule.sale_modes?.length || rule.sale_modes.includes(input.saleMode ?? "retail")) &&
        (rule.usage_limit_total == null || rule.usage_count < rule.usage_limit_total) &&
        Number(rule.config.sale_price) === line.list_unit_price;
    });

  const name = application?.rule_name ?? scheduled?.name;
  return name
    ? { name, originalPrice: input.unitPrice, finalPrice: line.line_total }
    : null;
}
