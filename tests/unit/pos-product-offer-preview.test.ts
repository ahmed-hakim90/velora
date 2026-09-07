import { describe, expect, it } from "vitest";
import { getPosPromotionNudges, previewProductOffer } from "@/modules/pos/lib/pos-promo-preview";
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

  it("advertises a buy-and-get offer before the second piece is added", () => {
    expect(previewProductOffer({
      rules: [{ ...categoryRule(), rule_type: "bogo", name: "الثانية خصم 50%", config: { buy_qty: 1, get_qty: 1, get_percent: 50 } }],
      productId: "cola",
      categoryId: "drinks",
      unitPrice: 50,
    })).toMatchObject({
      name: "الثانية خصم 50%",
      originalPrice: 50,
      finalPrice: 50,
      conditional: true,
    });
  });

  it("prompts for the missing discounted piece and clears at a complete pair", () => {
    const offer = { ...categoryRule(), rule_type: "bogo" as const, name: "الثانية خصم 50%", config: { buy_qty: 1, get_qty: 1, get_percent: 50 } };
    const cartLine = {
      id: "line-cola-base",
      productId: "cola",
      variantId: null,
      name: "كولا",
      quantity: 1,
      unitPrice: 50,
      categoryId: "drinks",
      modifiers: [],
      lineTotal: 50,
      imageUrl: null,
    };
    expect(getPosPromotionNudges({ rules: [offer], cart: [cartLine] })).toMatchObject([{
      quantityNeeded: 1,
      discountPercent: 50,
      kind: "bogo",
    }]);
    expect(getPosPromotionNudges({
      rules: [offer],
      cart: [{ ...cartLine, quantity: 2, lineTotal: 100 }],
    })).toEqual([]);
  });
});
