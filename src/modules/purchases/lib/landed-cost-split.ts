import { roundMoney } from "@/lib/money";

/**
 * Invoice `extra_cost` is the supplier add-on on the commercial invoice
 * (freight printed on the invoice). Certificate costs are customs/port/agent
 * fees. Both capitalize to inventory; entering the same economic amount on
 * both double-counts landed cost. Legitimate split: freight on invoice +
 * customs on the certificate.
 */
export const EXTRA_COST_INVOICE_HINT =
  "Supplier extra cost on the commercial invoice. Record customs, port, and agent fees on the customs certificate without duplicating costs.";

export const CERTIFICATE_COST_HINT =
  "Costs entered here are capitalized into inventory. If shipping is on the supplier invoice, keep it there and do not enter it again here.";

export function sumLinkedInvoiceExtraCost(
  invoices: { extra_cost: number }[]
): number {
  return roundMoney(
    invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.extra_cost), 0)
  );
}
