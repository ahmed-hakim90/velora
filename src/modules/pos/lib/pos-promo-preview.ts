import {
  evaluatePromotions,
  type EvaluatePromotionsResult,
  type PromotionRuleInput,
} from "@/modules/promotions/lib/evaluate-promotions";
import type { CartLine } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export interface ProductOfferPreview {
  name: string;
  color: string;
  originalPrice: number;
  finalPrice: number;
  conditional?: boolean;
}

export interface PosPromotionNudge {
  lineKey: string;
  ruleId: string;
  ruleName: string;
  kind: "bogo" | "quantity";
  quantityNeeded: number;
  discountPercent: number | null;
}

function activeAutomaticRule(input: {
  rule: PromotionRuleInput;
  productId: string;
  categoryId?: string | null;
  storeId?: string | null;
  saleMode?: SalesMode;
  now: Date;
}) {
  const { rule } = input;
  const scopeMatches =
    rule.scope_type === "all" ||
    (rule.scope_type === "product" && rule.scope_ids.includes(input.productId)) ||
    (rule.scope_type === "category" && Boolean(input.categoryId && rule.scope_ids.includes(input.categoryId)));
  return rule.is_active &&
    !rule.coupon_code?.trim() &&
    scopeMatches &&
    (!rule.starts_at || new Date(rule.starts_at) <= input.now) &&
    (!rule.ends_at || new Date(rule.ends_at) >= input.now) &&
    (!rule.store_ids?.length || Boolean(input.storeId && rule.store_ids.includes(input.storeId))) &&
    (!rule.sale_modes?.length || rule.sale_modes.includes(input.saleMode ?? "retail")) &&
    (rule.usage_limit_total == null || rule.usage_count < rule.usage_limit_total);
}

export function getPosPromotionNudges(input: {
  rules: PromotionRuleInput[];
  cart: CartLine[];
  storeId?: string | null;
  saleMode?: SalesMode;
  now?: Date;
}): PosPromotionNudge[] {
  const now = input.now ?? new Date();
  const nudges: PosPromotionNudge[] = [];
  for (const line of input.cart) {
    const candidates = input.rules
      .filter((rule) => (rule.rule_type === "bogo" || rule.rule_type === "qty_threshold") && activeAutomaticRule({
        rule,
        productId: line.productId,
        categoryId: line.categoryId,
        storeId: input.storeId,
        saleMode: input.saleMode,
        now,
      }))
      .sort((a, b) => b.priority - a.priority);
    const rule = candidates[0];
    if (!rule) continue;
    const groupSize = rule.rule_type === "bogo"
      ? Math.max(1, Math.floor(Number(rule.config.buy_qty ?? 1))) + Math.max(1, Math.floor(Number(rule.config.get_qty ?? 1)))
      : Math.max(0, Number(rule.config.min_qty ?? 0));
    if (!Number.isFinite(groupSize) || groupSize <= 0) continue;
    const remainder = line.quantity % groupSize;
    if (remainder <= 1e-9) continue;
    nudges.push({
      lineKey: line.id,
      ruleId: rule.id,
      ruleName: rule.name,
      kind: rule.rule_type === "bogo" ? "bogo" : "quantity",
      quantityNeeded: Math.round((groupSize - remainder) * 1000) / 1000,
      discountPercent: rule.rule_type === "bogo"
        ? Math.min(100, Math.max(0, Number(rule.config.get_percent ?? 100)))
        : null,
    });
  }
  return nudges;
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
  if (!line) return null;

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

  const conditional = input.rules
    .filter((rule) => rule.rule_type === "bogo" || rule.rule_type === "qty_threshold")
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => activeAutomaticRule({
      rule,
      productId: input.productId,
      categoryId: input.categoryId,
      storeId: input.storeId,
      saleMode: input.saleMode,
      now,
    }));
  const name = application?.rule_name ?? scheduled?.name ?? conditional?.name;
  const matchedRule = application
    ? input.rules.find((rule) => rule.id === application.promotion_rule_id)
    : scheduled ?? conditional;
  const color = typeof matchedRule?.config.color === "string"
    ? matchedRule.config.color
    : "#047857";
  if (!name) return null;
  const offer: ProductOfferPreview = {
    name,
    color,
    originalPrice: input.unitPrice,
    finalPrice: line.line_total,
  };
  if (line.line_total >= input.unitPrice) offer.conditional = true;
  return offer;
}
