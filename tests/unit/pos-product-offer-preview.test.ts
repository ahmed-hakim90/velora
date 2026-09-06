import { describe, expect, it } from "vitest";
import { previewProductOffer } from "@/modules/pos/lib/pos-promo-preview";
import type { PromotionRuleInput } from "@/modules/promotions/lib/evaluate-promotions";

function categoryRule(): PromotionRuleInput {
  return {
    id: "offer-1",
    name: "خصم المشروبات",
    is_active: true,
    rule_type: "percent_off_item",
    priority: 10,
    starts_at: null,
    ends_at: null,
    store_ids: null,
    sale_modes: ["retail"],
    coupon_code: null,
    stackable_with_cart: false,
    min_subtotal: 0,
    scope_type: "category",
    scope_ids: ["drinks"],
    config: { percent: 20, color: "#4338ca" },
    usage_limit_total: null,
    usage_count: 0,
  };
}

describe("previewProductOffer", () => {
  it("shows an automatic category offer at its immediate sale price", () => {
    expect(previewProductOffer({
      rules: [categoryRule()],
      productId: "cola",
      categoryId: "drinks",
      unitPrice: 50,
      saleMode: "retail",
    })).toEqual({
      name: "خصم المشروبات",
      color: "#4338ca",
      originalPrice: 50,
      finalPrice: 40,
    });
  });

  it("does not advertise a coupon-gated offer as automatic", () => {
    expect(previewProductOffer({
      rules: [{ ...categoryRule(), coupon_code: "SAVE20" }],
      productId: "cola",
      categoryId: "drinks",
      unitPrice: 50,
    })).toBeNull();
  });
});
