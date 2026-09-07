import type { PurchaseInvoice } from "@/lib/types";

type PurchaseDocumentKind = NonNullable<PurchaseInvoice["document_kind"]>;

/** Purchase requests may be prepared before sourcing; every other purchase document needs a supplier. */
export function purchaseDocumentRequiresSupplier(kind: PurchaseDocumentKind): boolean {
  return kind !== "purchase_request";
}

/**
 * A supplier can be corrected only while the whole document is editable.
 * Sent orders must be explicitly reopened as drafts before any field changes.
 */
export function canEditPurchaseSupplier(
  kind: PurchaseDocumentKind,
  status: PurchaseInvoice["status"]
): boolean {
  if (status === "draft") return true;
  if (kind === "purchase_request") {
    return status === "submitted" || status === "approved";
  }
  return false;
}
