import { beforeEach, describe, expect, it, vi } from "vitest";
import * as posting from "@/modules/accounting/services/gl-posting.service";
import * as audit from "@/lib/repositories/audit.repository";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
vi.mock("@/lib/repositories/audit.repository");
vi.mock("@/modules/system/services/settings.service");

const cases = [
  ["safePostSaleJournal", "postSaleJournal", { orderId: "entity" }],
  ["safePostExpenseJournal", "postExpenseJournal", { expenseId: "entity" }],
  ["safePostPurchaseJournal", "postPurchaseJournal", { purchaseId: "entity" }],
  ["safePostCustomsCertificateJournal", "postCustomsCertificateJournal", { costId: "entity" }],
  ["safePostCustomerPaymentJournal", "postCustomerPaymentJournal", { paymentId: "entity" }],
  ["safePostSupplierPaymentJournal", "postSupplierPaymentJournal", { paymentId: "entity" }],
  ["safePostSaleReversalJournal", "postSaleReversalJournal", { orderId: "entity" }],
  ["safePostWasteJournal", "postWasteJournal", { wasteId: "entity" }],
  ["safePostCreditNoteJournal", "postCreditNoteJournal", { creditNoteId: "entity" }],
  ["safePostPurchaseReturnJournal", "postPurchaseReturnJournal", { purchaseReturnId: "entity" }],
  ["safePostStockCountJournal", "postStockCountJournal", { countId: "entity" }],
  ["safePostSessionVarianceJournal", "postSessionVarianceJournal", { sessionId: "entity" }],
  ["safePostCogsAdjustmentJournal", "postCogsAdjustmentJournal", { orderId: "entity" }],
] as const;
describe("authentication failures after a committed business operation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(isFeatureEnabled).mockRejectedValue(new Error("Not authenticated"));
  });
  it.each(cases)("%s records the failure without failing the business response", async (method, label, identity) => {
    await expect(posting[method]({ ...identity, storeId: "store", createdBy: "actor" } as never)).resolves.toBeNull();
    expect(audit.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "gl.posting_failed", entityId: "entity", storeId: "store",
      metadata: expect.objectContaining({ label, error: "Not authenticated" }),
    }));
  });
  it("keeps the sale successful even when the expired session also prevents audit writing", async () => {
    vi.mocked(audit.insertAuditLog).mockRejectedValue(new Error("Not authenticated"));
    await expect(posting.safePostSaleJournal({ orderId: "entity", storeId: "store" } as never)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith("[gl-posting] audit write failed", expect.any(Error));
  });
  it("distinguishes a disabled feature from an authentication failure", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    await expect(posting.safePostSaleJournal({ orderId: "entity", storeId: "store" } as never)).resolves.toBeNull();
    expect(audit.insertAuditLog).not.toHaveBeenCalled();
  });
});
