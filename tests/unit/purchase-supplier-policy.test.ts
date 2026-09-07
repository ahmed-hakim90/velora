import { describe, expect, it } from "vitest";

import {
  canEditPurchaseSupplier,
  purchaseDocumentRequiresSupplier,
} from "@/modules/purchases/lib/purchase-supplier-policy";

describe("purchase supplier policy", () => {
  it("requires an explicit supplier except on a purchase request", () => {
    expect(purchaseDocumentRequiresSupplier("purchase_request")).toBe(false);
    expect(purchaseDocumentRequiresSupplier("purchase_order")).toBe(true);
    expect(purchaseDocumentRequiresSupplier("purchase_invoice")).toBe(true);
    expect(purchaseDocumentRequiresSupplier("purchase_return")).toBe(true);
  });

  it("allows corrections only before inventory or accounting effects", () => {
    expect(canEditPurchaseSupplier("purchase_invoice", "draft")).toBe(true);
    expect(canEditPurchaseSupplier("purchase_order", "sent")).toBe(false);
    expect(canEditPurchaseSupplier("purchase_order", "partial_invoiced")).toBe(false);
    expect(canEditPurchaseSupplier("purchase_invoice", "received")).toBe(false);
    expect(canEditPurchaseSupplier("purchase_return", "posted")).toBe(false);
  });

  it("keeps sourcing flexible through the open request workflow", () => {
    expect(canEditPurchaseSupplier("purchase_request", "submitted")).toBe(true);
    expect(canEditPurchaseSupplier("purchase_request", "approved")).toBe(true);
    expect(canEditPurchaseSupplier("purchase_request", "rejected")).toBe(false);
  });
});
