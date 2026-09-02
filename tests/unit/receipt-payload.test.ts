import { describe, expect, it } from "vitest";
import { buildReceiptPayloadFromOrder } from "@/modules/pos/utils/receipt-payload";
import type { OrderWithDetails } from "@/modules/orders/services/order.service";

const branding = {
  orgName: "Velora",
  orgLogoUrl: null,
  currency: "EGP",
  storeName: "Main",
  storeAddress: null,
  storePhone: null,
  receiptHeader: "",
  receiptFooter: "",
};

describe("saved order receipt payload", () => {
  it("preserves modifiers and measurement details from the original sale", () => {
    const order = {
      id: "order-1",
      store_id: "store-1",
      session_id: "session-1",
      order_number: "SF-1",
      customer_id: null,
      status: "completed",
      subtotal: 50,
      discount: 0,
      tax: 0,
      total: 50,
      payment_status: "paid",
      created_by: "cashier-1",
      created_at: "2026-09-02T18:00:00.000Z",
      items: [
        {
          id: "line-1",
          order_id: "order-1",
          product_id: "product-1",
          variant_id: null,
          quantity: 0.25,
          unit_price: 200,
          modifiers: [{ name: "Extra sauce", price: 5 }],
          line_total: 50,
          unit_cost: 0,
          line_cost: 0,
          sale_unit: "kg",
          base_quantity: 0.25,
          sale_input_mode: "by_weight",
          tier_id: "tier-1",
          wholesale_applied: true,
          line_note: null,
          productName: "Weighted item",
          variantName: "Large",
          sku: null,
        },
      ],
      payments: [
        {
          id: "pay-1",
          order_id: "order-1",
          method: "cash",
          amount: 50,
          reference: null,
        },
      ],
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      customerTaxId: null,
      storeName: "Main",
    } as OrderWithDetails;

    const receipt = buildReceiptPayloadFromOrder(order, branding);

    expect(receipt.lines[0]).toMatchObject({
      name: "Weighted item · Large",
      modifiers: [{ name: "Extra sauce", price: 5 }],
      saleUnit: "kg",
      saleInputMode: "by_weight",
      tierId: "tier-1",
      wholesaleApplied: true,
    });
    expect(receipt.orderStatus).toBe("completed");
  });
});
